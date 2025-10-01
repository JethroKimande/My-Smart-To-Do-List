const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

let dom;

const waitForTimers = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

function loadTodoApp() {
  const modulePath = path.join(__dirname, '..', 'app.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function stubBrowserAPIs(window) {
  window.scrollTo = () => {};
  global.scrollTo = () => {};

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  global.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

  if (!window.IntersectionObserver) {
    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.IntersectionObserver = MockIntersectionObserver;
  }

  if (!window.ResizeObserver) {
    class MockResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = MockResizeObserver;
  }

  global.IntersectionObserver = window.IntersectionObserver;
  global.ResizeObserver = window.ResizeObserver;

  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; }
    });
  }

  if (!window.localStorage) {
    const storage = new Map();
    window.localStorage = {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
      clear: () => storage.clear()
    };
  }

  global.fetch = () => Promise.reject(new Error('Network calls are disabled during tests'));
  global.confirm = () => true;
}

function setupDom() {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  dom = new JSDOM(html, {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.localStorage = dom.window.localStorage;
  global.CustomEvent = dom.window.CustomEvent;

  stubBrowserAPIs(dom.window);

  const TodoApp = loadTodoApp();

  TodoApp.prototype.initializeAI = async function initializeAIMock() {
    this.aiEnabled = false;
  };

  TodoApp.prototype.detectBrowserFeatures = function detectBrowserFeaturesMock() {
    this.browserFeatures = {
      intersectionObserver: false,
      resizeObserver: false,
      requestIdleCallback: false,
      requestAnimationFrame: true,
      passiveEvents: false,
      localStorage: true,
      prefersReducedMotion: false,
      virtualScrollReady: false
    };
  };

  TodoApp.prototype.announceToScreenReader = function announceMock() {};
  TodoApp.prototype.notifyConcurrentAction = function notifyMock(message) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(`[TodoApp] ${message}`);
    }
  };

  return new TodoApp();
}

function teardownDom() {
  if (dom) {
    dom.window.close();
  }
  dom = undefined;
}

test('empty state messaging handles empty and filtered lists', { concurrency: false }, async () => {
  const app = setupDom();
  try {
    app.renderTasks(true);

    const emptyState = document.getElementById('empty-state');
    assert.ok(emptyState, 'empty state element should exist');
    assert.equal(emptyState.classList.contains('hidden'), false);
    assert.equal(emptyState.dataset.state, 'empty');
    assert.equal(emptyState.querySelector('h3').textContent, 'No tasks yet');

    const taskInput = document.getElementById('task-input');
    const prioritySelect = document.getElementById('priority-select');
    const dueDateInput = document.getElementById('due-date');

    taskInput.value = 'Document new edge cases';
    prioritySelect.value = 'medium';
    dueDateInput.value = '';
    app.addTask();

    app.currentFilter = 'high';
    document.getElementById('filter-priority').value = 'high';
    app.renderTasks(true);

    assert.equal(emptyState.dataset.state, 'filtered');
    assert.equal(emptyState.querySelector('h3').textContent, 'No tasks found');
    assert.ok(emptyState.querySelector('p').textContent.includes('Try adjusting'));
  } finally {
    await waitForTimers(400);
    teardownDom();
  }
});

test('rejects invalid due dates on task creation', { concurrency: false }, async () => {
  const app = setupDom();
  let dueDateInput;
  let prototypeDescriptor;
  try {
    const taskInput = document.getElementById('task-input');
    const prioritySelect = document.getElementById('priority-select');
    dueDateInput = document.getElementById('due-date');

    prototypeDescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(dueDateInput), 'value');
    let storedValue = '';
    Object.defineProperty(dueDateInput, 'value', {
      configurable: true,
      enumerable: true,
      get() {
        return storedValue;
      },
      set(val) {
        storedValue = val;
      }
    });

    taskInput.value = 'Task with an impossible due date';
    prioritySelect.value = 'high';
    dueDateInput.value = '2024-13-40';
    app.addTask();

    assert.equal(app.tasks.length, 0);
    assert.equal(dueDateInput.getAttribute('aria-invalid'), 'true');

    dueDateInput.value = '2024-12-31';
    taskInput.value = 'Task with a valid due date';
    app.addTask();

    assert.equal(app.tasks.length, 1);
    assert.equal(dueDateInput.getAttribute('aria-invalid'), null);
  } finally {
    await waitForTimers(400);
    if (dueDateInput) {
      if (prototypeDescriptor) {
        Object.defineProperty(dueDateInput, 'value', prototypeDescriptor);
      } else {
        delete dueDateInput.value;
      }
    }
    teardownDom();
  }
});

test('task mutation lock prevents concurrent updates', { concurrency: false }, async () => {
  const app = setupDom();
  try {
    const taskInput = document.getElementById('task-input');
    const prioritySelect = document.getElementById('priority-select');
    const dueDateInput = document.getElementById('due-date');

    taskInput.value = 'Locked task attempt';
    prioritySelect.value = 'medium';
    dueDateInput.value = '';

    assert.equal(app.acquireOperationLock('taskMutation'), true);

    app.addTask();
    assert.equal(app.tasks.length, 0, 'task should not be added while lock is held');

    const validateResult = app.validateAndAddTask({
      text: 'Second task blocked by lock',
      priority: 'low',
      dueDate: '2024-10-10'
    });
    assert.deepEqual(validateResult, { success: false, reason: 'locked', task: null });

    app.releaseOperationLock('taskMutation');
    app.addTask();

    assert.equal(app.tasks.length, 1);
    assert.equal(app.tasks[0].text, 'Locked task attempt');
  } finally {
    await waitForTimers(400);
    teardownDom();
  }
});

test('validateAndAddTask guards against invalid dates and duplicates', { concurrency: false }, async () => {
  const app = setupDom();
  try {
    const invalidDateResult = app.validateAndAddTask({
      text: 'Schedule quarterly review',
      priority: 'high',
      dueDate: '2024-02-31'
    });

    assert.deepEqual(invalidDateResult, { success: false, reason: 'invalid-date', task: null });

    const validResult = app.validateAndAddTask({
      text: 'Schedule quarterly review',
      priority: 'high',
      dueDate: '2024-02-20'
    });
    assert.equal(validResult.success, true);
    assert.ok(validResult.task);

    const duplicateResult = app.validateAndAddTask({
      text: 'Schedule quarterly review',
      priority: 'high',
      dueDate: '2024-02-20'
    });
    assert.deepEqual(duplicateResult, { success: false, reason: 'duplicate', task: null });
  } finally {
    await waitForTimers(400);
    teardownDom();
  }
});
