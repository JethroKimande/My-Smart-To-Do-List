// To-Do List Application JavaScript
class TodoApp {
    constructor() {
        this.tasks = [];
        this.currentEditId = null;
        this.currentFilter = 'all';
        this.currentSort = 'priority';
        this.currentView = 'all';
        this.chatHistory = [];
        this.chatOpen = false;
        this.userPatterns = [];
        this.taskSuggestions = [];
        this.browserFeatures = {};
        this.requestIdleCallback = null;
        this.operationLocks = new Map();
        this.renderDebounceTimeout = null;
        this.virtualScroll = {
            enabled: true,
            threshold: 75,
            itemHeight: 128,
            buffer: 6,
            lastStart: -1,
            lastEnd: -1,
            lastRenderedLength: 0,
            itemMeasured: false,
            rafId: null,
            recalcTimeout: null,
            viewportHeight: 0,
            filteredTasks: [],
            active: false,
            elements: {
                scrollContainer: null,
                topSpacer: null,
                bottomSpacer: null,
                content: null
            }
        };

        this.init();
    }

    init() {
        this.loadTasksFromStorage();
        this.detectBrowserFeatures();
        this.applyBrowserFeatureFallbacks();
        this.bindEvents();
        this.setupVirtualScrolling();
        this.renderTasks(true);
        this.updateStatistics();
        this.initializeAI();
        this.checkElementExistence();
    }

    checkElementExistence() {
        const elementsToCheck = [
            { id: 'task-form', description: 'Task submission form' },
            { id: 'edit-form', description: 'Task edit form' },
            { id: 'filter-priority', description: 'Priority filter dropdown' },
            { id: 'sort-tasks', description: 'Task sorting dropdown' },

            // Filter buttons
            { id: 'show-all', description: 'Show all tasks button' },
            { id: 'show-pending', description: 'Show pending tasks button' },
            { id: 'show-completed', description: 'Show completed tasks button' },

            // Edit modal elements
            { id: 'cancel-edit', description: 'Cancel edit button' },
            { id: 'edit-modal', description: 'Edit task modal' },
            { id: 'edit-task-input', description: 'Edit task input field' },

            // Chat elements
            { id: 'ai-chat-toggle', description: 'AI chat toggle button' },
            { id: 'chat-close', description: 'Chat close button' },
            { id: 'chat-form', description: 'Chat submission form' },
            { id: 'chat-input', description: 'Chat input field' },
            { id: 'chat-messages', description: 'Chat messages container' },
            { id: 'typing-indicator', description: 'Typing indicator element' },

            // Task input elements
            { id: 'task-input', description: 'Task text input field' },
            { id: 'priority-select', description: 'Task priority selector' },
            { id: 'due-date', description: 'Task due date input' }
        ];

        const selectorsToCheck = [
            { selector: '.quick-prompt', description: 'Quick prompt buttons' },
            { selector: '.quick-action-btn', description: 'Quick action buttons' },
            { selector: '.task-item', description: 'Task item elements' }
        ];

        const missingElements = [];
        const missingSelectors = [];

        // Check individual elements by ID
        elementsToCheck.forEach((element) => {
            const el = document.getElementById(element.id);
            if (!el) {
                missingElements.push(element);
                console.warn(`❌ Missing element: #${element.id} - ${element.description}`);
            } else {
                console.log(`✅ Found element: #${element.id} - ${element.description}`);
            }
        });

        // Check selectors
        selectorsToCheck.forEach((selector) => {
            const elements = document.querySelectorAll(selector.selector);
            if (elements.length === 0) {
                missingSelectors.push(selector);
                console.warn(`❌ Missing elements: ${selector.selector} - ${selector.description}`);
            } else {
                console.log(`✅ Found ${elements.length} elements: ${selector.selector} - ${selector.description}`);
            }
        });

        // Summary
        if (missingElements.length === 0 && missingSelectors.length === 0) {
            console.log('🎉 All referenced elements found! No missing elements detected.');
        } else {
            console.error(`⚠️ Found ${missingElements.length} missing elements and ${missingSelectors.length} missing selectors.`);
            console.error('Missing elements:', missingElements.map((e) => `#${e.id}`));
            console.error('Missing selectors:', missingSelectors.map((s) => s.selector));
        }

        return {
            missingElements: missingElements.length,
            missingSelectors: missingSelectors.length,
            totalChecked: elementsToCheck.length + selectorsToCheck.length
        };
    }

    detectBrowserFeatures() {
        if (typeof window === 'undefined') {
            this.browserFeatures = {};
            return;
        }

        const features = {
            intersectionObserver: 'IntersectionObserver' in window,
            resizeObserver: 'ResizeObserver' in window,
            requestIdleCallback: 'requestIdleCallback' in window,
            requestAnimationFrame: 'requestAnimationFrame' in window,
            passiveEvents: false,
            localStorage: false,
            prefersReducedMotion: false,
            virtualScrollReady: false
        };

        try {
            const passiveTest = Object.defineProperty({}, 'passive', {
                get() {
                    features.passiveEvents = true;
                }
            });
            window.addEventListener('test-passive', () => {}, passiveTest);
            window.removeEventListener('test-passive', () => {}, passiveTest);
        } catch (error) {
            features.passiveEvents = false;
        }

        try {
            const testKey = '__todo_feature_test__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            features.localStorage = true;
        } catch (error) {
            features.localStorage = false;
        }

        if (typeof window.matchMedia === 'function') {
            const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            features.prefersReducedMotion = !!reducedMotionQuery.matches;
        }

        features.virtualScrollReady = features.requestAnimationFrame && features.resizeObserver;

        this.browserFeatures = features;

        if (window && window.console && typeof window.console.info === 'function') {
            console.info('[TodoApp] Browser feature support detected:', features);
        }
    }

    applyBrowserFeatureFallbacks() {
        if (typeof window === 'undefined') {
            return;
        }

        if (!this.browserFeatures || Object.keys(this.browserFeatures).length === 0) {
            this.browserFeatures = {};
        }

        const reducedMotion = this.browserFeatures.prefersReducedMotion;
        if (reducedMotion && typeof document !== 'undefined') {
            document.documentElement.classList.add('prefers-reduced-motion');
            this.virtualScroll.buffer = Math.max(2, this.virtualScroll.buffer - 2);
        }

        if (!this.browserFeatures.virtualScrollReady) {
            this.virtualScroll.enabled = false;
            console.warn('[TodoApp] Virtual scrolling disabled due to limited browser support.');
        }

        if (!this.browserFeatures.passiveEvents) {
            console.warn('[TodoApp] Passive event listeners are not supported; scroll performance may be affected.');
        }

        if (!this.browserFeatures.localStorage) {
            console.warn('[TodoApp] localStorage is unavailable; tasks will only persist for this session.');
        }

        if (typeof window.requestIdleCallback === 'function') {
            this.requestIdleCallback = window.requestIdleCallback.bind(window);
        } else {
            this.requestIdleCallback = (callback) => {
                const start = Date.now();
                return window.setTimeout(() => {
                    callback({
                        didTimeout: false,
                        timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
                    });
                }, 1);
            };
        }
    }

    setupVirtualScrolling() {
        const scrollContainer = document.getElementById('tasks-scroll-container');
        const topSpacer = document.getElementById('virtual-spacer-top');
        const bottomSpacer = document.getElementById('virtual-spacer-bottom');
        const content = document.getElementById('tasks-container');

        this.virtualScroll.elements = {
            scrollContainer,
            topSpacer,
            bottomSpacer,
            content
        };

        if (!this.virtualScroll.enabled) {
            return;
        }

        if (!scrollContainer) {
            this.virtualScroll.enabled = false;
            return;
        }

        const scrollHandler = this.onVirtualScroll.bind(this);
        const resizeHandler = this.scheduleVirtualRecalc.bind(this);
        const listenerOptions = this.browserFeatures.passiveEvents ? { passive: true } : false;

        scrollContainer.addEventListener('scroll', scrollHandler, listenerOptions);
        window.addEventListener('resize', resizeHandler);

        this.virtualScroll.scrollHandler = scrollHandler;
        this.virtualScroll.resizeHandler = resizeHandler;

        this.virtualScroll.viewportHeight = scrollContainer.clientHeight || this.virtualScroll.viewportHeight || 600;
    }

    acquireOperationLock(name, timeout = 4000) {
        if (!this.operationLocks) {
            this.operationLocks = new Map();
        }

        if (this.operationLocks.has(name)) {
            return false;
        }

        const timer = setTimeout(() => {
            this.releaseOperationLock(name);
        }, timeout);

        this.operationLocks.set(name, timer);
        return true;
    }

    releaseOperationLock(name) {
        if (!this.operationLocks) return;

        const timer = this.operationLocks.get(name);
        if (timer) {
            clearTimeout(timer);
        }

        this.operationLocks.delete(name);
    }

    runTaskMutation(callback, options = {}) {
        const { silent = false, message, onLocked } = options;

        if (!this.acquireOperationLock('taskMutation')) {
            if (!silent) {
                this.notifyConcurrentAction(message);
            }

            if (typeof onLocked === 'function') {
                return onLocked();
            }

            return undefined;
        }

        try {
            return callback();
        } finally {
            this.releaseOperationLock('taskMutation');
        }
    }

    notifyConcurrentAction(customMessage) {
        const message = customMessage || 'Another task update is still processing. Please wait a moment and try again.';

        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn(`[TodoApp] ${message}`);
        }

        if (typeof document !== 'undefined' && typeof this.announceToScreenReader === 'function') {
            this.announceToScreenReader(message);
        }
    }

    setTaskListBusy(isBusy) {
        const busyValue = isBusy ? 'true' : 'false';
        const { scrollContainer, content } = this.virtualScroll.elements;

        if (scrollContainer) {
            scrollContainer.setAttribute('aria-busy', busyValue);
        }

        if (content) {
            content.setAttribute('aria-busy', busyValue);
        }
    }

    scheduleVirtualRecalc() {
        if (!this.virtualScroll.enabled) return;
        if (this.virtualScroll.recalcTimeout) return;

        this.virtualScroll.recalcTimeout = setTimeout(() => {
            this.virtualScroll.recalcTimeout = null;
            const { scrollContainer } = this.virtualScroll.elements;
            if (scrollContainer) {
                this.virtualScroll.viewportHeight = scrollContainer.clientHeight || this.virtualScroll.viewportHeight;
            }
            if (this.virtualScroll.active) {
                this.renderVirtualizedTasks(true);
            }
        }, 120);
    }

    onVirtualScroll() {
        if (!this.virtualScroll.active || !this.virtualScroll.enabled) return;
        if (this.virtualScroll.rafId) return;

        this.virtualScroll.rafId = window.requestAnimationFrame(() => {
            this.virtualScroll.rafId = null;
            this.renderVirtualizedTasks();
        });
    }

    shouldUseVirtualization(filteredTasks) {
        const { scrollContainer } = this.virtualScroll.elements;
        return this.virtualScroll.enabled && scrollContainer && filteredTasks.length > this.virtualScroll.threshold;
    }

    renderTasksStandard(filteredTasks) {
        const { content, topSpacer, bottomSpacer } = this.virtualScroll.elements;
        const container = content || document.getElementById('tasks-container');

        if (!container) return;

        if (topSpacer) topSpacer.style.height = '0px';
        if (bottomSpacer) bottomSpacer.style.height = '0px';

        const total = filteredTasks.length;
        const tasksHTML = filteredTasks
            .map((task, index) => this.generateAccessibleTaskHTML(task, index, total))
            .join('');

        container.innerHTML = tasksHTML;
        container.setAttribute('role', 'feed');
        container.setAttribute('aria-label', `${total} tasks displayed`);

        this.bindTaskEvents();
        this.addTaskKeyboardNavigation();
        this.setTaskListBusy(false);
    }

    renderVirtualizedTasks(force = false) {
        const { scrollContainer, topSpacer, bottomSpacer, content } = this.virtualScroll.elements;
        const tasks = this.virtualScroll.filteredTasks || [];

        if (!scrollContainer || !content || tasks.length === 0) {
            this.renderTasksStandard(tasks);
            return;
        }

        const itemHeight = this.virtualScroll.itemHeight;
        const buffer = this.virtualScroll.buffer;
        const viewportHeight = this.virtualScroll.viewportHeight || scrollContainer.clientHeight || 600;
        const scrollTop = scrollContainer.scrollTop;

        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
        const endIndex = Math.min(tasks.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + buffer);

        if (!force && startIndex === this.virtualScroll.lastStart && endIndex === this.virtualScroll.lastEnd) {
            return;
        }

        this.virtualScroll.lastStart = startIndex;
        this.virtualScroll.lastEnd = endIndex;

        const visibleTasks = tasks.slice(startIndex, endIndex);

        if (!this.virtualScroll.itemMeasured && visibleTasks.length > 0) {
            this.measureVirtualItemHeight(visibleTasks[0]);
            if (!force) {
                this.renderVirtualizedTasks(true);
                return;
            }
        }

        const total = tasks.length;
        const tasksHTML = visibleTasks
            .map((task, index) => this.generateAccessibleTaskHTML(task, startIndex + index, total))
            .join('');

        content.innerHTML = tasksHTML;
        content.setAttribute('role', 'feed');
        content.setAttribute('aria-label', `${total} tasks displayed (virtualized view)`);

        if (topSpacer) topSpacer.style.height = `${startIndex * this.virtualScroll.itemHeight}px`;
        if (bottomSpacer) bottomSpacer.style.height = `${Math.max(0, (total - endIndex) * this.virtualScroll.itemHeight)}px`;

        this.bindTaskEvents();
        this.addTaskKeyboardNavigation();
        this.setTaskListBusy(false);
    }

    generateAccessibleTaskHTML(task, index, total) {
        const taskHTML = this.createTaskHTML(task);
        const safeText = this.sanitizePlainText(task.text || '');
        return taskHTML.replace('<div class="task-item"',
            `<div class="task-item" role="article" aria-label="Task ${index + 1} of ${total}: ${safeText}" tabindex="0"`);
    }

    measureVirtualItemHeight(sampleTask) {
        if (!sampleTask) return;

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.pointerEvents = 'none';
        tempContainer.style.width = '100%';
        tempContainer.innerHTML = this.createTaskHTML(sampleTask);
        document.body.appendChild(tempContainer);

        const taskElement = tempContainer.querySelector('.task-item');
        if (taskElement) {
            const rect = taskElement.getBoundingClientRect();
            if (rect.height > 0) {
                this.virtualScroll.itemHeight = rect.height + 12;
                this.virtualScroll.itemMeasured = true;
            }
        }

        document.body.removeChild(tempContainer);
    }

    bindEvents() {
        // Form submission for adding new tasks
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // Edit form submission
        document.getElementById('edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditTask();
        });

        // Filter and sort controls
        document.getElementById('filter-priority').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.renderTasks();
        });

        document.getElementById('sort-tasks').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderTasks();
        });

        // View filter buttons
        document.getElementById('show-all').addEventListener('click', () => {
            this.currentView = 'all';
            this.updateViewButtons();
            this.renderTasks();
        });

        document.getElementById('show-pending').addEventListener('click', () => {
            this.currentView = 'pending';
            this.updateViewButtons();
            this.renderTasks();
        });

        document.getElementById('show-completed').addEventListener('click', () => {
            this.currentView = 'completed';
            this.updateViewButtons();
            this.renderTasks();
        });

        // Modal controls
        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('edit-modal').addEventListener('click', (e) => {
            if (e.target.id === 'edit-modal') {
                this.closeEditModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
                this.closeChatInterface();
            }
        });

        // AI Chat event listeners
        this.bindChatEvents();
    }

    bindChatEvents() {
        // Remove existing event listeners to prevent duplicates
        this.removeChatEventListeners();

        // Chat toggle button
        document.getElementById('ai-chat-toggle').addEventListener('click', () => {
            this.toggleChatInterface();
        });

        // Chat close button
        document.getElementById('chat-close').addEventListener('click', () => {
            this.closeChatInterface();
        });

        // Chat form submission
        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleChatInput();
        });

        // Quick prompt buttons
        document.querySelectorAll('.quick-prompt').forEach(button => {
            button.addEventListener('click', (e) => {
                const prompt = e.target.dataset.prompt;
                document.getElementById('chat-input').value = prompt;
                this.handleChatInput();
            });

            // Keyboard accessibility
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.click();
                }
            });
        });

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            });

            // Keyboard accessibility
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.click();
                }
            });
        });

        // Enhanced keyboard navigation
        document.getElementById('chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' && e.target.value === '') {
                this.navigateChatHistory('up');
                e.preventDefault();
            } else if (e.key === 'ArrowDown' && e.target.value === '') {
                this.navigateChatHistory('down');
                e.preventDefault();
            }
        });
    }

    removeChatEventListeners() {
        // Clone and replace elements to remove all event listeners
        const chatForm = document.getElementById('chat-form');
        if (chatForm) {
            const newChatForm = chatForm.cloneNode(true);
            chatForm.parentNode.replaceChild(newChatForm, chatForm);
        }

        const chatToggle = document.getElementById('ai-chat-toggle');
        if (chatToggle) {
            const newChatToggle = chatToggle.cloneNode(true);
            chatToggle.parentNode.replaceChild(newChatToggle, chatToggle);
        }

        const chatClose = document.getElementById('chat-close');
        if (chatClose) {
            const newChatClose = chatClose.cloneNode(true);
            chatClose.parentNode.replaceChild(newChatClose, chatClose);
        }

        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            const newChatInput = chatInput.cloneNode(true);
            chatInput.parentNode.replaceChild(newChatInput, chatInput);
        }

        // Remove listeners from quick prompt buttons
        document.querySelectorAll('.quick-prompt').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });

        // Remove listeners from quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });
    }

    addTask() {
        return this.runTaskMutation(() => {
            const taskInput = document.getElementById('task-input');
            const prioritySelect = document.getElementById('priority-select');
            const dueDateInput = document.getElementById('due-date');

            if (!taskInput || !prioritySelect || !dueDateInput) {
                console.error('Required form elements missing for adding a task.');
                return;
            }

            const rawTaskData = {
                text: taskInput.value,
                priority: prioritySelect.value,
                dueDate: dueDateInput.value
            };

            const sanitizedTask = this.sanitizeTaskData(rawTaskData);
            const dueDateProvided = typeof rawTaskData.dueDate === 'string'
                ? rawTaskData.dueDate.trim().length > 0
                : rawTaskData.dueDate !== null && rawTaskData.dueDate !== undefined;
            const dueDateInvalid = dueDateProvided && !sanitizedTask.dueDate;

            if (!sanitizedTask.text) {
                if (typeof taskInput.setCustomValidity === 'function') {
                    taskInput.setCustomValidity('Task description cannot be empty.');
                    taskInput.reportValidity();
                }
                taskInput.setAttribute('aria-invalid', 'true');
                this.announceToScreenReader('Task text cannot be empty.');
                taskInput.focus();
                return;
            }

            taskInput.removeAttribute('aria-invalid');
            if (typeof taskInput.setCustomValidity === 'function') {
                taskInput.setCustomValidity('');
            }

            if (dueDateInvalid) {
                dueDateInput.setAttribute('aria-invalid', 'true');
                if (typeof dueDateInput.setCustomValidity === 'function') {
                    dueDateInput.setCustomValidity('Please provide a valid due date.');
                    dueDateInput.reportValidity();
                }
                this.announceToScreenReader('Please enter a valid due date.');
                dueDateInput.focus();
                return;
            }

            dueDateInput.removeAttribute('aria-invalid');
            if (typeof dueDateInput.setCustomValidity === 'function') {
                dueDateInput.setCustomValidity('');
            }

            const task = {
                id: Date.now().toString(),
                text: sanitizedTask.text,
                priority: sanitizedTask.priority,
                dueDate: sanitizedTask.dueDate,
                category: sanitizedTask.category,
                completed: false,
                createdAt: new Date().toISOString()
            };

            this.tasks.push(task);
            this.saveTasksToStorage();
            this.debouncedRender();
            this.updateStatistics();

            // Reset form
            taskInput.value = '';
            dueDateInput.value = '';
            prioritySelect.value = 'medium';

            // Focus back to input
            taskInput.focus();
        }, {
            message: 'Another task update is already underway. Please wait a moment.'
        });
    }

    deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        this.runTaskMutation(() => {
            const initialLength = this.tasks.length;
            this.tasks = this.tasks.filter(task => task.id !== taskId);

            if (this.tasks.length === initialLength) {
                this.announceToScreenReader('Task could not be found to delete.');
                return;
            }

            this.saveTasksToStorage();
            this.renderTasks();
            this.updateStatistics();
        }, {
            message: 'Another deletion is currently running. Please wait before deleting again.'
        });
    }

    // New function for AI-driven precise deletion by ID
    deleteTaskById(taskId, options = {}) {
        const { silent = true } = options;

        return this.runTaskMutation(() => {
            const taskIndex = this.tasks.findIndex(task => task.id === taskId);

            if (taskIndex === -1) {
                return {
                    success: false,
                    message: `I couldn't find a task with ID "${taskId}". Could you check the task ID?`
                };
            }

            const deletedTask = this.tasks.splice(taskIndex, 1)[0];
            this.saveTasksToStorage();
            this.debouncedRender();

            return {
                success: true,
                taskName: deletedTask.text,
                taskId: taskId
            };
        }, {
            silent,
            onLocked: () => ({
                success: false,
                message: 'A task update is currently running. Please try again in a moment.'
            })
        });
    }

    toggleTask(taskId) {
        return this.runTaskMutation(() => {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) {
                if (taskId) {
                    this.announceToScreenReader('Task could not be found.');
                }
                return;
            }

            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;

            this.saveTasksToStorage();
            this.renderTasks();
            this.updateStatistics();
        }, {
            message: 'A task update is already pending. Please wait before toggling another task.'
        });
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.currentEditId = taskId;
        
        // Populate edit form
        document.getElementById('edit-task-input').value = task.text;
        document.getElementById('edit-priority-select').value = task.priority;
        document.getElementById('edit-due-date').value = task.dueDate || '';

        // Show modal
        this.openEditModal();
    }

    saveEditTask() {
        return this.runTaskMutation(() => {
            const task = this.tasks.find(t => t.id === this.currentEditId);
            if (!task) {
                return;
            }

            const taskInput = document.getElementById('edit-task-input');
            const prioritySelect = document.getElementById('edit-priority-select');
            const dueDateInput = document.getElementById('edit-due-date');

            if (!taskInput || !prioritySelect || !dueDateInput) {
                console.error('Edit form elements missing.');
                return;
            }

            const rawDueDate = dueDateInput.value;

            const sanitizedTask = this.sanitizeTaskData({
                ...task,
                text: taskInput.value,
                priority: prioritySelect.value,
                dueDate: rawDueDate
            });

            const dueDateProvided = typeof rawDueDate === 'string' && rawDueDate.trim().length > 0;
            const dueDateInvalid = dueDateProvided && !sanitizedTask.dueDate;

            if (!sanitizedTask.text) {
                if (typeof taskInput.setCustomValidity === 'function') {
                    taskInput.setCustomValidity('Task description cannot be empty.');
                    taskInput.reportValidity();
                }
                taskInput.setAttribute('aria-invalid', 'true');
                this.announceToScreenReader('Task text cannot be empty.');
                taskInput.focus();
                return;
            }

            taskInput.removeAttribute('aria-invalid');
            if (typeof taskInput.setCustomValidity === 'function') {
                taskInput.setCustomValidity('');
            }

            if (dueDateInvalid) {
                dueDateInput.setAttribute('aria-invalid', 'true');
                if (typeof dueDateInput.setCustomValidity === 'function') {
                    dueDateInput.setCustomValidity('Please provide a valid due date.');
                    dueDateInput.reportValidity();
                }
                this.announceToScreenReader('Please enter a valid due date.');
                dueDateInput.focus();
                return;
            }

            dueDateInput.removeAttribute('aria-invalid');
            if (typeof dueDateInput.setCustomValidity === 'function') {
                dueDateInput.setCustomValidity('');
            }

            task.text = sanitizedTask.text;
            task.priority = sanitizedTask.priority;
            task.dueDate = sanitizedTask.dueDate;
            if (sanitizedTask.category) {
                task.category = sanitizedTask.category;
            }
            task.updatedAt = new Date().toISOString();

            this.saveTasksToStorage();
            this.renderTasks(true);
            this.updateStatistics();
            this.closeEditModal();
        }, {
            message: 'Another task edit is in progress. Please wait.'
        });
    }

    openEditModal() {
        const modal = document.getElementById('edit-modal');
        modal.classList.remove('hidden');
        modal.classList.add('modal-enter');
        document.getElementById('edit-task-input').focus();
    }

    closeEditModal() {
        const modal = document.getElementById('edit-modal');
        modal.classList.add('hidden');
        modal.classList.remove('modal-enter');
        this.currentEditId = null;
    }

    updateViewButtons() {
        const buttons = document.querySelectorAll('#show-all, #show-pending, #show-completed');
        const activeButton = document.getElementById(`show-${this.currentView}`);

        buttons.forEach((button) => {
            const isActive = button === activeButton;
            if (isActive) {
                button.classList.remove('bg-gray-200', 'text-gray-700');
                button.classList.add('bg-blue-600', 'text-white');
            } else {
                button.classList.remove('bg-blue-600', 'text-white');
                button.classList.add('bg-gray-200', 'text-gray-700');
            }
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    getFilteredTasks() {
        let filteredTasks = [...this.tasks];

        // Filter by completion status
        if (this.currentView === 'pending') {
            filteredTasks = filteredTasks.filter(task => !task.completed);
        } else if (this.currentView === 'completed') {
            filteredTasks = filteredTasks.filter(task => task.completed);
        }

        // Filter by priority
        if (this.currentFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.priority === this.currentFilter);
        }

        // Sort tasks
        return this.sortTasks(filteredTasks);
    }

    sortTasks(tasks) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };

        return tasks.sort((a, b) => {
            switch (this.currentSort) {
                case 'priority':
                    // First sort by completion status (incomplete first)
                    if (a.completed !== b.completed) {
                        return a.completed ? 1 : -1;
                    }
                    // Then by priority
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                
                case 'date':
                    // First sort by completion status (incomplete first)
                    if (a.completed !== b.completed) {
                        return a.completed ? 1 : -1;
                    }
                    // Then by due date (null dates go to end)
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                
                default:
                    return 0;
            }
        });
    }

    renderTasks(force = false) {
        const { scrollContainer, topSpacer, bottomSpacer, content } = this.virtualScroll.elements;
        const container = content || document.getElementById('tasks-container');
        const emptyState = document.getElementById('empty-state');
        const filteredTasks = this.getFilteredTasks();

        if (!container) return;

        this.virtualScroll.filteredTasks = filteredTasks;
        this.setTaskListBusy(true);

        if (filteredTasks.length === 0) {
            container.innerHTML = '';
            if (topSpacer) topSpacer.style.height = '0px';
            if (bottomSpacer) bottomSpacer.style.height = '0px';
            if (scrollContainer) {
                scrollContainer.scrollTop = 0;
                scrollContainer.classList.add('hidden');
                scrollContainer.setAttribute('aria-hidden', 'true');
            }
            if (emptyState) {
                const titleEl = emptyState.querySelector('h3');
                const descriptionEl = emptyState.querySelector('p');
                const noTasksRemain = this.tasks.length === 0;
                if (titleEl && descriptionEl) {
                    if (noTasksRemain) {
                        titleEl.textContent = 'No tasks yet';
                        descriptionEl.textContent = 'Add your first task to get started!';
                    } else {
                        titleEl.textContent = 'No tasks found';
                        descriptionEl.textContent = 'Try adjusting your filters or add a new task.';
                    }
                }
                emptyState.dataset.state = noTasksRemain ? 'empty' : 'filtered';
                emptyState.classList.remove('hidden');
                emptyState.setAttribute('role', 'status');
                emptyState.setAttribute('aria-live', 'polite');
                emptyState.setAttribute('aria-hidden', 'false');
            }
            this.virtualScroll.active = false;
            this.virtualScroll.lastRenderedLength = 0;
            this.setTaskListBusy(false);
            return;
        }

        if (emptyState) {
            emptyState.classList.add('hidden');
            emptyState.setAttribute('aria-hidden', 'true');
        }

        if (scrollContainer) {
            scrollContainer.classList.remove('hidden');
            scrollContainer.setAttribute('aria-hidden', 'false');
            if (!this.virtualScroll.viewportHeight) {
                this.virtualScroll.viewportHeight = scrollContainer.clientHeight || 600;
            }
        }

        const lengthChanged = filteredTasks.length !== this.virtualScroll.lastRenderedLength || force;
        if (lengthChanged) {
            this.virtualScroll.itemMeasured = false;
            this.virtualScroll.lastStart = -1;
            this.virtualScroll.lastEnd = -1;
        }
        this.virtualScroll.lastRenderedLength = filteredTasks.length;

        if (this.shouldUseVirtualization(filteredTasks)) {
            this.virtualScroll.active = true;
            this.renderVirtualizedTasks(force || lengthChanged);
        } else {
            this.virtualScroll.active = false;
            this.renderTasksStandard(filteredTasks);
        }
    }

    addTaskKeyboardNavigation() {
        const taskItems = document.querySelectorAll('.task-item');
        taskItems.forEach((item, index) => {
            item.addEventListener('keydown', (e) => {
                switch(e.key) {
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        const checkbox = item.querySelector('.task-checkbox');
                        if (checkbox) checkbox.click();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        if (index > 0) taskItems[index - 1].focus();
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        if (index < taskItems.length - 1) taskItems[index + 1].focus();
                        break;
                    case 'Delete':
                        e.preventDefault();
                        const deleteBtn = item.querySelector('.btn-delete');
                        if (deleteBtn) deleteBtn.click();
                        break;
                    case 'e':
                    case 'E':
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            const editBtn = item.querySelector('.btn-edit');
                            if (editBtn) editBtn.click();
                        }
                        break;
                }
            });
        });
    }

    createTaskHTML(task) {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const today = new Date();
        const isOverdue = dueDate && dueDate < today && !task.completed;
        const isDueSoon = dueDate && dueDate <= new Date(today.getTime() + 24 * 60 * 60 * 1000) && dueDate >= today && !task.completed;

        let taskClasses = 'task-item';
        if (task.completed) taskClasses += ' completed';
        if (isOverdue) taskClasses += ' overdue';
        else if (isDueSoon) taskClasses += ' due-soon';

        const priorityClass = `priority-${task.priority}`;
        const dueDateDisplay = dueDate ? 
            `<div class="due-date ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}">
                <i class="fas fa-calendar-alt"></i>
                <span>Due: ${this.formatDate(dueDate)}</span>
            </div>` : '';

        return `
            <div class="${taskClasses}" data-task-id="${task.id}">
                <div class="flex items-start gap-4">
                    <div class="flex-shrink-0 mt-1">
                        <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="todoApp.toggleTask('${task.id}')"></div>
                    </div>
                    
                    <div class="flex-grow">
                        <div class="flex items-start justify-between mb-2">
                            <p class="task-text text-gray-800 font-medium">${this.escapeHtml(task.text)}</p>
                            <div class="flex items-center gap-2 ml-4">
                                <span class="priority-badge ${priorityClass}">${task.priority}</span>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <div class="text-sm text-gray-500">
                                ${dueDateDisplay}
                                <div class="text-xs mt-1">
                                    Created: ${this.formatDate(new Date(task.createdAt))}
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2 task-actions">
                                <button class="btn-action btn-edit" onclick="todoApp.editTask('${task.id}')" title="Edit task">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-action btn-delete" onclick="todoApp.deleteTask('${task.id}')" title="Delete task">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindTaskEvents() {
        // Event listeners are bound via onclick in the HTML for simplicity
        // In a production app, you might want to use event delegation
    }

    updateStatistics() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const pending = total - completed;
        const overdue = this.tasks.filter(task => {
            if (task.completed || !task.dueDate) return false;
            return new Date(task.dueDate) < new Date();
        }).length;

        // Update with accessibility announcements
        const updates = [
            { element: document.getElementById('total-tasks'), value: total, label: 'total tasks' },
            { element: document.getElementById('pending-tasks'), value: pending, label: 'pending tasks' },
            { element: document.getElementById('completed-tasks'), value: completed, label: 'completed tasks' },
            { element: document.getElementById('overdue-tasks'), value: overdue, label: 'overdue tasks' }
        ];

        updates.forEach(({ element, value, label }) => {
            const oldValue = parseInt(element.textContent) || 0;
            element.textContent = value;
            element.setAttribute('aria-label', `${value} ${label}`);
            
            if (oldValue !== value) {
                element.classList.add('updating');
                setTimeout(() => element.classList.remove('updating'), 300);
                
                // Announce significant changes
                if (Math.abs(oldValue - value) > 0 && value > 0) {
                    this.announceToScreenReader(`${label} updated to ${value}`);
                }
            }
        });
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.className = 'sr-only';
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    stripHTML(value) {
        if (typeof value !== 'string') return '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = value;
        return tempDiv.textContent || tempDiv.innerText || '';
    }

    sanitizePlainText(value, options = {}) {
        const { preserveNewlines = false } = options;
        const safeValue = value !== undefined && value !== null ? value : '';
        const raw = this.stripHTML(safeValue);

        if (preserveNewlines) {
            return raw
                .replace(/\r/g, '')
                .replace(/[ \t]+/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        return raw.replace(/\s+/g, ' ').trim();
    }

    sanitizeUserMessage(value) {
        return this.sanitizePlainText(value, { preserveNewlines: false });
    }

    sanitizeAIResponseText(value) {
        return this.sanitizePlainText(value, { preserveNewlines: true });
    }

    getSafePriority(value) {
        const allowed = ['low', 'medium', 'high'];
        const normalized = typeof value === 'string' ? value.toLowerCase() : '';
        return allowed.includes(normalized) ? normalized : 'medium';
    }

    normalizeDueDate(value) {
        if (!value) return null;

        let dateObj = null;
        if (value instanceof Date) {
            if (isNaN(value.getTime())) {
                return null;
            }
            dateObj = new Date(value.getTime());
        } else if (typeof value === 'number') {
            dateObj = new Date(value);
            if (isNaN(dateObj.getTime())) {
                return null;
            }
        } else if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoMatch) {
                const year = Number(isoMatch[1]);
                const month = Number(isoMatch[2]);
                const day = Number(isoMatch[3]);
                const candidate = new Date(Date.UTC(year, month - 1, day));

                if (
                    candidate.getUTCFullYear() !== year ||
                    candidate.getUTCMonth() + 1 !== month ||
                    candidate.getUTCDate() !== day
                ) {
                    return null;
                }

                dateObj = candidate;
            } else {
                const parsed = new Date(trimmed);
                if (isNaN(parsed.getTime())) {
                    return null;
                }
                dateObj = parsed;
            }
        }

        if (!dateObj || isNaN(dateObj.getTime())) {
            return null;
        }

        return new Date(dateObj.getTime()).toISOString().split('T')[0];
    }

    sanitizeTaskData(taskData = {}) {
        const sanitizedText = this.sanitizePlainText(taskData.text || '');
        const priority = this.getSafePriority(taskData.priority);
        const dueDate = this.normalizeDueDate(taskData.dueDate);
        const category = this.sanitizePlainText(taskData.category || 'general');

        return {
            ...taskData,
            text: sanitizedText,
            priority,
            dueDate,
            category
        };
    }

    sanitizeSuggestionList(suggestions) {
        if (!Array.isArray(suggestions)) return [];
        return suggestions
            .map(item => this.sanitizePlainText(item || ''))
            .filter(Boolean);
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Unified response formatting for task operations
    formatTaskResponse(tasks, operation = 'added') {
        if (!tasks || tasks.length === 0) {
            return operation === 'added'
                ? "That task already exists in your list. Would you like to update it or add something else?"
                : "No tasks were found for that operation.";
        }

        if (tasks.length === 1) {
            const task = tasks[0];
            const dueText = task.dueDate ? ` due on ${this.formatDate(new Date(task.dueDate))}` : '';
            return `✅ I've ${operation} "${task.text}" to your tasks with ${task.priority} priority${dueText}.`;
        } else {
            let response = `✅ I've ${operation} ${tasks.length} tasks to your list:\n\n`;
            tasks.forEach((task, index) => {
                const dueText = task.dueDate ? ` - Due: ${this.formatDate(new Date(task.dueDate))}` : '';
                response += `${index + 1}. ${task.text} (${task.priority} priority)${dueText}\n`;
            });
            return response;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    saveTasksToStorage() {
        try {
            localStorage.setItem('todoAppTasks', JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Error saving tasks to localStorage:', error);
        }
    }

    loadTasksFromStorage() {
        try {
            const stored = localStorage.getItem('todoAppTasks');
            if (stored) {
                this.tasks = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading tasks from localStorage:', error);
            this.tasks = [];
        }
    }

    // Utility methods for potential future enhancements
    exportTasks() {
        const dataStr = JSON.stringify(this.tasks, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'todo-tasks.json';
        link.click();
    }

    importTasks(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedTasks = JSON.parse(e.target.result);
                if (Array.isArray(importedTasks)) {
                    this.tasks = importedTasks;
                    this.saveTasksToStorage();
                    this.renderTasks();
                    this.updateStatistics();
                    alert('Tasks imported successfully!');
                }
            } catch (error) {
                alert('Error importing tasks. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }

    clearCompletedTasks() {
        if (!confirm('Are you sure you want to delete all completed tasks?')) {
            return;
        }

        this.runTaskMutation(() => {
            const completedCount = this.tasks.filter(task => task.completed).length;

            if (completedCount === 0) {
                this.announceToScreenReader('There are no completed tasks to clear.');
                return;
            }

            this.tasks = this.tasks.filter(task => !task.completed);
            this.saveTasksToStorage();
            this.renderTasks();
            this.updateStatistics();
            this.announceToScreenReader(`${completedCount} completed task${completedCount > 1 ? 's' : ''} cleared.`);
        }, {
            message: 'Task updates are still processing. Please wait before clearing completed tasks again.'
        });
    }

    clearAllTasks() {
        if (!confirm('Are you sure you want to delete ALL tasks? This action cannot be undone.')) {
            return;
        }

        this.runTaskMutation(() => {
            if (this.tasks.length === 0) {
                this.announceToScreenReader('Your task list is already empty.');
                return;
            }

            const removedCount = this.tasks.length;
            this.tasks = [];
            this.saveTasksToStorage();
            this.renderTasks();
            this.updateStatistics();
            this.announceToScreenReader(`${removedCount} task${removedCount > 1 ? 's' : ''} removed. Your list is now empty.`);
        }, {
            message: 'Another task update is running. Please wait before clearing all tasks.'
        });
    }
    
    // Unified task creation method with consistent structure
    createTask(taskData, createdBy = 'user') {
        const sanitizedTask = this.sanitizeTaskData(taskData);

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: sanitizedTask.text,
            priority: sanitizedTask.priority || 'medium',
            dueDate: sanitizedTask.dueDate || null,
            category: sanitizedTask.category || 'general',
            completed: false,
            createdAt: new Date().toISOString(),
            createdBy
        };
    }

    // Unified method to validate and add tasks
    validateAndAddTask(taskData, createdBy = 'user') {
        return this.runTaskMutation(() => {
            const sanitizedTaskData = this.sanitizeTaskData(taskData);

            if (!sanitizedTaskData.text) {
                return { success: false, reason: 'invalid', task: null };
            }

            const originalDueDate = taskData ? taskData.dueDate : undefined;
            const dueDateProvided = (() => {
                if (originalDueDate === null || originalDueDate === undefined) return false;
                if (typeof originalDueDate === 'string') {
                    return originalDueDate.trim().length > 0;
                }
                return true;
            })();
            const dueDateInvalid = dueDateProvided && sanitizedTaskData.dueDate === null;

            if (dueDateInvalid) {
                return { success: false, reason: 'invalid-date', task: null };
            }

            // Check for duplicates
            if (this.isTaskDuplicate(sanitizedTaskData)) {
                return { success: false, reason: 'duplicate', task: null };
            }

            // Create the task
            const task = this.createTask(sanitizedTaskData, createdBy);

            // Add to tasks array and save
            this.tasks.push(task);
            this.saveTasksToStorage();

            return { success: true, task: task };
        }, {
            silent: true,
            onLocked: () => ({ success: false, reason: 'locked', task: null })
        });
    }

    // Legacy method for backward compatibility - now uses unified approach
    addTaskFromAI(taskData) {
        const result = this.validateAndAddTask(taskData, 'ai');
        return result.success ? result.task : null;
    }

    // Helper method to check if a task is a duplicate considering all properties
    isTaskDuplicate(newTaskData) {
        return this.tasks.some(existingTask => {
            // Compare text (case-insensitive, trimmed)
            const textMatch = existingTask.text.toLowerCase().trim() === newTaskData.text.toLowerCase().trim();
            
            // Compare priority (normalize to lowercase)
            const priorityMatch = (existingTask.priority || 'medium').toLowerCase() === (newTaskData.priority || 'medium').toLowerCase();
            
            // Compare due dates (normalize date strings)
            const normalizeDate = (date) => {
                if (!date) return null;
                if (typeof date === 'string') {
                    // Try to parse and normalize the date
                    const parsed = new Date(date);
                    return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
                }
                return date;
            };
            
            const existingDate = normalizeDate(existingTask.dueDate);
            const newDate = normalizeDate(newTaskData.dueDate);
            const dateMatch = existingDate === newDate;
            
            // Task is duplicate only if ALL properties match
            return textMatch && priorityMatch && dateMatch;
        });
    }
    
    markTaskComplete(userMessage) {
        return this.runTaskMutation(() => {
            const message = (userMessage || '').toLowerCase();

            // Try to find task by searching for keywords
            for (const task of this.tasks.filter(t => !t.completed)) {
                const taskWords = task.text.toLowerCase().split(' ');
                const messageWords = message.split(' ');
                const matches = taskWords.filter(word => messageWords.includes(word));

                if (matches.length >= 2) {
                    task.completed = true;
                    task.completedAt = new Date().toISOString();
                    this.saveTasksToStorage();
                    return { success: true, taskName: task.text };
                }
            }

            return {
                success: false,
                message: "I couldn't find a specific task to mark as complete. Could you be more specific?"
            };
        }, {
            silent: true,
            onLocked: () => ({
                success: false,
                message: 'Another task update is currently running. Please try again shortly.'
            })
        });
    }
    
    deleteTaskByName(userMessage) {
        const message = userMessage.toLowerCase();
        
        // Check if user provided a task ID (format: "delete task id:12345" or "delete id:12345")
        const idMatch = message.match(/id:([a-zA-Z0-9]+)/);
        if (idMatch) {
            return this.deleteTaskById(idMatch[1]);
        }
        
        // Find all matching tasks by name
        const matchingTasks = [];
        for (let i = 0; i < this.tasks.length; i++) {
            const task = this.tasks[i];
            const taskWords = task.text.toLowerCase().split(' ');
            const messageWords = message.split(' ');
            const matches = taskWords.filter(word => messageWords.includes(word));
            
            if (matches.length >= 2) {
                matchingTasks.push({
                    index: i,
                    task: task,
                    matchCount: matches.length
                });
            }
        }
        
        if (matchingTasks.length === 0) {
            return { 
                success: false, 
                message: "I couldn't find a specific task to delete. Could you be more specific or use 'delete id:TASK_ID' format?" 
            };
        }
        
        if (matchingTasks.length === 1) {
            // Only one match, delete it
            const taskToDelete = matchingTasks[0];
            const taskName = taskToDelete.task.text;
            this.tasks.splice(taskToDelete.index, 1);
            this.saveTasksToStorage();
            this.debouncedRender();
            return { success: true, taskName: taskName };
        }
        
        // Multiple matches, provide options
        let response = `I found ${matchingTasks.length} tasks that match. Please specify which one to delete:\n\n`;
        matchingTasks.forEach((match, idx) => {
            const task = match.task;
            response += `${idx + 1}. "${task.text}" (${task.priority} priority`;
            if (task.dueDate) {
                response += `, due ${this.formatDate(new Date(task.dueDate))}`;
            }
            response += `) - ID: ${task.id}\n`;
        });
        response += `\nYou can delete by saying "delete id:${matchingTasks[0].task.id}" or be more specific with the task details.`;
        
        return { 
            success: false, 
            message: response,
            multipleMatches: true,
            matches: matchingTasks.map(m => ({ id: m.task.id, text: m.task.text, priority: m.task.priority, dueDate: m.task.dueDate }))
        };
    }

    // Kimi AI Integration via Direct API
    async initializeAI() {
        try {
            // Enable AI since we have the API key
            this.aiEnabled = true;
            console.log('Kimi AI initialized with direct API access');

            // Test the connection
            try {
                await this.testKimiConnection();
                console.log('Kimi AI connection verified');
            } catch (testError) {
                console.log('Kimi AI connection test failed, but proceeding:', testError.message);
            }
        } catch (error) {
            console.error('Error initializing Kimi AI:', error);
            this.aiEnabled = false;
        }
    }

    async testKimiConnection() {
        // Quick test to verify API key works
        const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.aiModel,
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            })
        });

        if (!response.ok) {
            throw new Error(`API test failed: ${response.status}`);
        }

        return await response.json();
    }

    async queryKimiAI(userMessage, context = '') {
        if (!this.aiEnabled) {
            return null;
        }

        try {
            // Build context for Kimi AI
            const taskContext = this.buildTaskContext();
            const systemPrompt = this.buildSystemPrompt(taskContext);

            const fullPrompt = `${systemPrompt}

Context: ${context}
User: ${userMessage}

Please respond as Shani, the helpful task assistant. If the user wants to manage tasks, provide a JSON response in this format:
{
    "response": "Your conversational response",
    "action": "add_task|view_tasks|complete_task|delete_task|get_stats|conversation",
    "tasks": [{"text": "task description", "priority": "high|medium|low", "dueDate": "YYYY-MM-DD"}],
    "taskQuery": "specific query for viewing tasks",
    "suggestions": ["suggestion 1", "suggestion 2"]
}

If it's just conversation, only provide a natural response.`;

            // Build conversation history for context
            const messages = [{ role: 'system', content: systemPrompt }];
            
            // Add recent conversation history (last 10 messages to avoid token limits)
            const recentHistory = this.chatHistory.slice(-10);
            recentHistory.forEach(chat => {
                messages.push({
                    role: chat.sender === 'user' ? 'user' : 'assistant',
                    content: chat.message
                });
            });
            
            // Add current user message
            messages.push({ role: 'user', content: userMessage });

            // Make direct API call to MoonshotAI
            const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.aiModel,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.choices && data.choices[0] && data.choices[0].message) {
                return {
                    message: { content: data.choices[0].message.content },
                    content: data.choices[0].message.content
                };
            } else {
                throw new Error('Invalid API response format');
            }

        } catch (error) {
            console.error('Kimi AI query error:', error);
            // Fallback to local processing
            const localResponse = this.processIntelligentResponse(userMessage, context);
            return {
                message: { content: localResponse },
                content: localResponse
            };
        }
    }

    buildSystemPrompt(taskContext) {
        return `You are Shani, an intelligent task management assistant. You help users manage their to-do lists through natural conversation.

Current Task Summary:
${taskContext}

IMPORTANT: This is a CONVERSATION. Previous messages are provided in the chat history. When users ask follow-up questions like "which one", "what about", or refer to something mentioned earlier, understand the context from the conversation history.

Your capabilities:
1. Add tasks with smart priority and due date suggestions
2. View and filter tasks (today, this week, overdue, by priority)
3. Mark tasks as complete or delete them - use task IDs for precise deletion when multiple tasks match
4. Provide task statistics and insights
5. Understand natural language requests
6. Suggest task improvements and organization
7. Maintain conversation context and answer follow-up questions appropriately

Guidelines:
- Be friendly, helpful, and conversational
- Remember what was discussed earlier in the conversation
- When users ask "which one" or similar, refer to items mentioned in previous responses
- For task deletion, if multiple tasks match the description, suggest using the task ID (format: "delete id:TASK_ID")
- Task IDs are shown in brackets [ID: abc123] in the task context
- Understand context and provide relevant suggestions
- Parse natural language for task details (priority, due dates, etc.)
- Suggest realistic due dates based on task type
- Be proactive in offering help and suggestions
- Use emojis appropriately to make responses engaging
- Don't repeat the same greeting or information unless asked

Today's date: ${new Date().toISOString().split('T')[0]}`;
    }

    buildTaskContext() {
        const total = this.tasks.length;
        const pending = this.tasks.filter(t => !t.completed).length;
        const completed = this.tasks.filter(t => t.completed).length;
        const overdue = this.tasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            return new Date(t.dueDate) < new Date();
        }).length;

        const recentTasks = this.tasks
            .filter(t => !t.completed)
            .slice(-5)
            .map(t => `- ${t.text} (${t.priority} priority)${t.dueDate ? ` due ${t.dueDate}` : ''} [ID: ${t.id}]`)
            .join('\n');

        return `Total: ${total}, Pending: ${pending}, Completed: ${completed}, Overdue: ${overdue}
Recent pending tasks:
${recentTasks || 'No pending tasks'}`;
    }

    parseAIResponse(aiResponse) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON found, treat as conversational response
            return {
                response: aiResponse,
                action: 'conversation'
            };
        } catch (error) {
            return {
                response: aiResponse,
                action: 'conversation'
            };
        }
    }

    // Enhanced NLP and AI Intelligence Methods
    initializeNLPPatterns() {
        return {
            taskCreation: {
                verbs: ['add', 'create', 'make', 'new', 'schedule', 'plan', 'remind', 'set up', 'book', 'arrange'],
                timeIndicators: {
                    today: () => new Date(),
                    tomorrow: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; },
                    'next week': () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; },
                    'this weekend': () => { const d = new Date(); const days = 6 - d.getDay(); d.setDate(d.getDate() + days); return d; },
                    'monday': () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); return d; },
                    'friday': () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + 5; d.setDate(diff); return d; }
                },
                priorityKeywords: {
                    high: ['urgent', 'important', 'critical', 'asap', 'priority', 'immediately', 'rush'],
                    medium: ['normal', 'regular', 'standard', 'moderate'],
                    low: ['later', 'someday', 'eventually', 'when possible', 'low priority']
                },
                taskCategories: {
                    work: ['meeting', 'call', 'email', 'report', 'presentation', 'deadline'],
                    personal: ['grocery', 'shopping', 'doctor', 'dentist', 'workout', 'exercise'],
                    home: ['clean', 'laundry', 'dishes', 'vacuum', 'organize', 'repair'],
                    social: ['birthday', 'party', 'dinner', 'visit', 'call mom', 'call dad']
                }
            },
            batchOperations: {
                multiple: ['and', 'also', 'plus', 'additionally', 'then', 'after that'],
                sequence: ['first', 'second', 'third', 'next', 'finally', 'then']
            }
        };
    }

    debouncedRender() {
        clearTimeout(this.renderDebounceTimeout);
        this.renderDebounceTimeout = setTimeout(() => {
            this.renderTasks();
            this.updateStatistics();
        }, 100);
    }

    async enhancedParseTaskFromMessage(message) {
        // Try AI-powered parsing first
        if (this.aiEnabled) {
            try {
                const aiTaskData = await this.parseTasksWithAI(message);
                if (aiTaskData && aiTaskData.length > 0) {
                    return aiTaskData;
                }
            } catch (error) {
                console.error('AI task parsing error:', error);
            }
        }

        // Fallback to local parsing
        return this.parseTasksLocally(message);
    }

    async parseTasksWithAI(message) {
        const systemPrompt = `You are a task parsing assistant. Extract task information from the user's message and return a JSON array of task objects.

Each task object should have:
- text: The cleaned task description
- priority: "low", "medium", or "high" 
- dueDate: ISO date string or null
- category: Inferred category (work, personal, shopping, health, etc.)

Examples:
User: "Add buy groceries tomorrow and workout with high priority"
Response: [
  {"text": "buy groceries", "priority": "medium", "dueDate": "2024-01-15T00:00:00.000Z", "category": "shopping"},
  {"text": "workout", "priority": "high", "dueDate": null, "category": "health"}
]

Only return valid JSON array. If no tasks found, return empty array [].`;

        try {
            const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.aiModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: message }
                    ],
                    temperature: 0.3,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.choices?.[0]?.message?.content || data.content || '';

            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\[.*\]/s);
            if (jsonMatch) {
                const tasks = JSON.parse(jsonMatch[0]);
                return Array.isArray(tasks) ? tasks.map(task => ({
                    text: task.text || '',
                    priority: task.priority || 'medium',
                    dueDate: task.dueDate ? new Date(task.dueDate).getTime() : null,
                    category: task.category || 'general'
                })) : [];
            }
        } catch (error) {
            console.error('AI task parsing failed:', error);
        }

        return [];
    }

    parseTasksLocally(message) {
        const originalMessage = message.toLowerCase();
        let tasks = [];
        
        // Check for batch operations
        const batchKeywords = this.nlpPatterns.batchOperations.multiple;
        const hasBatchOperations = batchKeywords.some(keyword => originalMessage.includes(keyword));
        
        if (hasBatchOperations) {
            tasks = this.parseBatchTasks(message);
        } else {
            const singleTask = this.parseSingleTask(message);
            if (singleTask) tasks.push(singleTask);
        }
        
        return tasks;
    }

    parseBatchTasks(message) {
        const tasks = [];
        const batchKeywords = [...this.nlpPatterns.batchOperations.multiple, ...this.nlpPatterns.batchOperations.sequence];
        
        // Split by batch keywords
        let parts = [message];
        batchKeywords.forEach(keyword => {
            const newParts = [];
            parts.forEach(part => {
                newParts.push(...part.split(new RegExp(`\\s+${keyword}\\s+`, 'i')));
            });
            parts = newParts.filter(p => p.trim());
        });
        
        parts.forEach(part => {
            const task = this.parseSingleTask(part.trim());
            if (task) tasks.push(task);
        });
        
        return tasks;
    }

    parseSingleTask(message) {
        const originalMessage = message;
        let text = message.toLowerCase();
        let priority = 'medium';
        let dueDate = null;
        let category = null;
        
        // Remove command verbs and conversational phrases
        const verbs = [...this.nlpPatterns.taskCreation.verbs, 'i want to', 'i need to', 'i have to', 'can you add', 'could you add', 'please add'];
        verbs.forEach(verb => {
            const regex = new RegExp(`^(${verb})\\s+`, 'i');
            text = text.replace(regex, '').trim();
        });
        
        // Remove common conversational starters
        text = text.replace(/^(i want|i need|i have to|can you|could you|please)\s+/i, '').trim();
        
        // Extract priority
        Object.entries(this.nlpPatterns.taskCreation.priorityKeywords).forEach(([level, keywords]) => {
            keywords.forEach(keyword => {
                if (originalMessage.toLowerCase().includes(keyword)) {
                    priority = level;
                    text = text.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '').trim();
                }
            });
        });
        
        // Extract due date with enhanced parsing
        Object.entries(this.nlpPatterns.taskCreation.timeIndicators).forEach(([timePhrase, dateFunc]) => {
            if (originalMessage.toLowerCase().includes(timePhrase)) {
                dueDate = dateFunc().toISOString().split('T')[0];
                text = text.replace(new RegExp(`\\b${timePhrase}\\b`, 'gi'), '').trim();
            }
        });
        
        // Detect category
        Object.entries(this.nlpPatterns.taskCreation.taskCategories).forEach(([cat, keywords]) => {
            keywords.forEach(keyword => {
                if (text.includes(keyword)) {
                    category = cat;
                }
            });
        });
        
        // Clean up text
        text = text.replace(/\b(with|priority|task)\b/gi, '').trim();
        text = text.replace(/^(to\s+)?/, '').trim();
        
        if (text.length < 2) return null;
        
        // Store user pattern for learning
        this.learnUserPattern({ text, priority, dueDate, category, originalMessage });
        
        return { text, priority, dueDate, category };
    }

    learnUserPattern(taskData) {
        this.userPatterns.push({
            ...taskData,
            timestamp: new Date().toISOString(),
            frequency: this.userPatterns.filter(p => p.text.includes(taskData.text.split(' ')[0])).length + 1
        });
        
        // Keep only last 50 patterns for performance
        if (this.userPatterns.length > 50) {
            this.userPatterns = this.userPatterns.slice(-50);
        }
        
        this.generateTaskSuggestions();
    }

    async generateTaskSuggestions() {
        // Try AI-powered suggestions first
        if (this.aiEnabled) {
            try {
                const aiSuggestions = await this.generateAITaskSuggestions();
                if (aiSuggestions && aiSuggestions.length > 0) {
                    this.taskSuggestions = this.sanitizeSuggestionList(aiSuggestions);
                    return;
                }
            } catch (error) {
                console.error('AI suggestion generation failed:', error);
            }
        }

        // Fallback to pattern-based suggestions
        this.generateLocalTaskSuggestions();
    }

    async generateAITaskSuggestions() {
        const context = this.buildTaskContext();
        const currentTime = new Date();
        const timeContext = {
            dayOfWeek: currentTime.toLocaleDateString('en-US', { weekday: 'long' }),
            timeOfDay: currentTime.getHours() < 12 ? 'morning' : currentTime.getHours() < 17 ? 'afternoon' : 'evening',
            date: currentTime.toLocaleDateString()
        };

        const systemPrompt = `You are a smart task suggestion assistant. Based on the user's task history and current context, suggest 3-5 relevant tasks they might want to add.

Current context:
- Day: ${timeContext.dayOfWeek}
- Time: ${timeContext.timeOfDay}
- Date: ${timeContext.date}

User's task patterns:
${context.recentTasks}
${context.commonCategories}

Return only a JSON array of strings with task suggestions. Keep suggestions concise and actionable.
Example: ["Review weekly goals", "Plan weekend activities", "Check email"]`;

        try {
            const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.aiModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: 'What tasks should I consider adding based on my patterns?' }
                    ],
                    temperature: 0.7,
                    max_tokens: 300
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.choices?.[0]?.message?.content || data.content || '';

            // Try to extract JSON array from the response
            const jsonMatch = aiResponse.match(/\[.*\]/s);
            if (jsonMatch) {
                const suggestions = JSON.parse(jsonMatch[0]);
                return Array.isArray(suggestions) ? this.sanitizeSuggestionList(suggestions.slice(0, 5)) : [];
            }
        } catch (error) {
            console.error('AI task suggestions failed:', error);
        }

        return [];
    }

    generateLocalTaskSuggestions() {
        const commonTasks = this.userPatterns
            .reduce((acc, pattern) => {
                const key = pattern.text.split(' ')[0];
                acc[key] = (acc[key] || 0) + pattern.frequency;
                return acc;
            }, {});
        
        const suggestions = Object.entries(commonTasks)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([task]) => task);

        this.taskSuggestions = this.sanitizeSuggestionList(suggestions);
    }

    // Enhanced Local AI Processing Methods (No Authentication Required)
    processIntelligentResponse(userMessage, taskContext) {
        const message = userMessage.toLowerCase();
        const currentTime = new Date();
        
        // Intelligent task creation detection
        if (this.containsAny(message, ['add', 'create', 'new task', 'schedule', 'remind me to', 'i need to', 'i want to'])) {
            const taskResults = this.parseTasksLocally(userMessage);
            if (taskResults.length > 0) {
                const tasks = taskResults.map(task => ({
                    text: task.text,
                    priority: task.priority,
                    dueDate: task.dueDate || this.suggestDueDate(task.text)
                }));
                
                const response = tasks.length === 1 
                    ? `✅ I've added "${tasks[0].text}" to your tasks with ${tasks[0].priority} priority${tasks[0].dueDate ? ` due on ${this.formatDate(new Date(tasks[0].dueDate))}` : ''}.`
                    : `✅ I've added ${tasks.length} tasks to your list:\n${tasks.map((t, i) => `${i + 1}. ${t.text} (${t.priority} priority)`).join('\n')}`;
                
                return JSON.stringify({
                    response,
                    action: 'add_task',
                    tasks: tasks,
                    suggestions: this.getContextualSuggestions(userMessage)
                });
            }
        }
        
        // Task viewing queries
        if (this.containsAny(message, ['show', 'list', 'what', 'view', 'display'])) {
            if (this.containsAny(message, ['today', 'due today'])) {
                return JSON.stringify({
                    response: this.getTasksForToday(),
                    action: 'view_tasks',
                    taskQuery: 'today'
                });
            } else if (this.containsAny(message, ['overdue', 'late'])) {
                return JSON.stringify({
                    response: this.getOverdueTasks(),
                    action: 'view_tasks',
                    taskQuery: 'overdue'
                });
            } else if (this.containsAny(message, ['completed', 'done'])) {
                return JSON.stringify({
                    response: this.getCompletedTasks(),
                    action: 'view_tasks',
                    taskQuery: 'completed'
                });
            } else {
                return JSON.stringify({
                    response: this.getAllTasksSummary(),
                    action: 'view_tasks',
                    taskQuery: 'all'
                });
            }
        }
        
        // Task completion
        if (this.containsAny(message, ['complete', 'done', 'finished', 'mark as complete'])) {
            return JSON.stringify({
                response: this.intelligentTaskCompletion(userMessage),
                action: 'complete_task'
            });
        }

        // Task deletion
        if (this.containsAny(message, ['delete', 'remove', 'trash', 'clear'])) {
            return JSON.stringify({
                response: "Let me take care of that deletion for you.",
                action: 'delete_task',
                suggestions: this.getContextualSuggestions(userMessage)
            });
        }
        
        // Statistics and insights
        if (this.containsAny(message, ['stats', 'statistics', 'summary', 'how many'])) {
            return JSON.stringify({
                response: this.getIntelligentStatistics(),
                action: 'get_stats',
                suggestions: ['Review overdue tasks', 'Plan this week', 'Add more tasks']
            });
        }
        
        // Conversational responses
        if (this.containsAny(message, ['hello', 'hi', 'hey', 'good morning', 'good afternoon'])) {
            const greeting = this.getIntelligentGreeting();
            return JSON.stringify({
                response: greeting,
                action: 'conversation',
                suggestions: this.getTimeBasedSuggestions()
            });
        }
        
        // Default intelligent response
        return JSON.stringify({
            response: this.getContextualHelpResponse(userMessage),
            action: 'conversation',
            suggestions: this.getContextualSuggestions(userMessage)
        });
    }

    processIntelligentTaskParsing(message) {
        // Enhanced task parsing with intelligent pattern recognition
        const taskData = this.parseTasksLocally(message);
        
        if (taskData.length > 0) {
            return taskData.map(task => ({
                text: task.text,
                priority: task.priority || this.inferPriority(task.text),
                dueDate: task.dueDate || this.inferDueDate(task.text),
                category: task.category || this.inferCategory(task.text)
            }));
        }
        
        return [];
    }

    getContextualSuggestions(userMessage) {
        const currentHour = new Date().getHours();
        const dayOfWeek = new Date().getDay();
        
        // Morning suggestions
        if (currentHour < 12) {
            return ['Plan your day', 'Review priorities', 'Check calendar'];
        }
        // Afternoon suggestions
        else if (currentHour < 17) {
            return ['Follow up on tasks', 'Schedule tomorrow', 'Take a break'];
        }
        // Evening suggestions
        else {
            return ['Wrap up today', 'Plan tomorrow', 'Review completed tasks'];
        }
    }

    getTimeBasedSuggestions() {
        const currentHour = new Date().getHours();
        const isWeekend = [0, 6].includes(new Date().getDay());
        
        if (isWeekend) {
            return ['Plan next week', 'Personal projects', 'Family time'];
        } else if (currentHour < 9) {
            return ['Daily standup', 'Check emails', 'Review priorities'];
        } else if (currentHour > 17) {
            return ['Wrap up work', 'Plan tomorrow', 'Personal tasks'];
        } else {
            return ['Focus time', 'Team check-ins', 'Progress review'];
        }
    }

    getIntelligentGreeting() {
        const currentHour = new Date().getHours();
        const pendingTasks = this.tasks.filter(t => !t.completed).length;
        const overdueTasks = this.tasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            return new Date(t.dueDate) < new Date();
        }).length;
        
        let greeting = '';
        if (currentHour < 12) greeting = 'Good morning!';
        else if (currentHour < 17) greeting = 'Good afternoon!';
        else greeting = 'Good evening!';
        
        if (overdueTasks > 0) {
            greeting += ` You have ${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''} that need attention.`;
        } else if (pendingTasks > 0) {
            greeting += ` You have ${pendingTasks} pending task${pendingTasks > 1 ? 's' : ''} to work on.`;
        } else {
            greeting += ' Your task list is all caught up! Great job! 🎉';
        }
        
        return greeting;
    }

    getContextualHelpResponse(userMessage) {
        const message = userMessage.toLowerCase();
        
        if (message.includes('help')) {
            return "I'm here to help you manage your tasks! I can:\n• Add new tasks: 'Add buy groceries tomorrow'\n• Show tasks: 'What's due today?'\n• Mark complete: 'Mark exercise as done'\n• Get insights: 'Show my statistics'\n\nJust tell me what you need in natural language!";
        }
        
        return "I understand you want to work with your tasks. Could you be more specific? For example:\n• 'Add a new task...'\n• 'Show me tasks...'\n• 'Mark ... as complete'\n\nWhat would you like to do?";
    }

    getIntelligentStatistics() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const overdue = this.tasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            return new Date(t.dueDate) < new Date();
        }).length;
        
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        let insight = '';
        if (completionRate >= 80) {
            insight = ' Excellent progress! 🌟';
        } else if (completionRate >= 60) {
            insight = ' Good momentum! Keep it up! 💪';
        } else if (completionRate >= 40) {
            insight = ' Making progress! Consider prioritizing. 📈';
        } else {
            insight = ' Time to focus and tackle some tasks! 🎯';
        }
        
        return `📊 Task Statistics:\n• Total: ${total}\n• Completed: ${completed} (${completionRate}%)\n• Pending: ${pending}\n• Overdue: ${overdue}\n\n${insight}`;
    }

    intelligentTaskCompletion(userMessage) {
        // Try to find the task to complete based on user message
        const message = userMessage.toLowerCase();
        const words = message.split(' ');
        
        for (const task of this.tasks.filter(t => !t.completed)) {
            const taskWords = task.text.toLowerCase().split(' ');
            const commonWords = words.filter(word => taskWords.includes(word));
            
            if (commonWords.length >= 2) {
                task.completed = true;
                task.completedAt = new Date().toISOString();
                this.saveTasksToStorage();
                this.debouncedRender();
                return `✅ Marked "${task.text}" as completed! Great job!`;
            }
        }
        
        return "I couldn't find a specific task to mark as complete. Could you be more specific about which task you finished?";
    }

    suggestDueDate(taskText) {
        const text = taskText.toLowerCase();
        const today = new Date();
        
        // Intelligent date suggestions based on task content
        if (text.includes('grocery') || text.includes('shopping')) {
            // Suggest weekend for shopping
            const weekend = new Date(today);
            const daysUntilSaturday = 6 - today.getDay();
            weekend.setDate(today.getDate() + daysUntilSaturday);
            return weekend.toISOString().split('T')[0];
        }
        
        if (text.includes('workout') || text.includes('exercise')) {
            // Suggest next day for workout
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        }
        
        if (text.includes('meeting') || text.includes('call')) {
            // Suggest next weekday
            const nextWeekday = new Date(today);
            let daysToAdd = 1;
            if (today.getDay() === 5) daysToAdd = 3; // Friday -> Monday
            if (today.getDay() === 6) daysToAdd = 2; // Saturday -> Monday
            nextWeekday.setDate(today.getDate() + daysToAdd);
            return nextWeekday.toISOString().split('T')[0];
        }
        
        return null;
    }

    handleQuickAction(action) {
        const actions = {
            'show-pending': () => this.addChatMessage('ai', this.getTasksForToday()),
            'show-completed': () => this.addChatMessage('ai', this.getCompletedTasks()),
            'show-overdue': () => this.addChatMessage('ai', this.getOverdueTasks()),
            'show-stats': () => this.addChatMessage('ai', this.getTaskStatistics())
        };
        
        if (actions[action]) {
            actions[action]();
        }
    }

    navigateChatHistory(direction) {
        const userMessages = this.chatHistory
            .filter(msg => msg.sender === 'user')
            .map(msg => msg.message);
        
        if (userMessages.length === 0) return;
        
        this.chatHistoryIndex = this.chatHistoryIndex || -1;
        
        if (direction === 'up') {
            this.chatHistoryIndex = Math.min(this.chatHistoryIndex + 1, userMessages.length - 1);
        } else {
            this.chatHistoryIndex = Math.max(this.chatHistoryIndex - 1, -1);
        }
        
        const chatInput = document.getElementById('chat-input');
        if (this.chatHistoryIndex >= 0) {
            chatInput.value = userMessages[userMessages.length - 1 - this.chatHistoryIndex];
        } else {
            chatInput.value = '';
        }
    }

    // AI Chat Interface Methods
    toggleChatInterface() {
        if (this.chatOpen) {
            this.closeChatInterface();
        } else {
            this.openChatInterface();
        }
    }

    openChatInterface() {
        const chatContainer = document.getElementById('ai-chat-container');
        const chatToggle = document.getElementById('ai-chat-toggle');
        const chatToggleButton = chatToggle ? chatToggle.querySelector('button') : null;
        
        chatContainer.classList.remove('hidden');
        setTimeout(() => {
            chatContainer.classList.add('show');
        }, 10);

        chatContainer.setAttribute('aria-hidden', 'false');
        if (chatToggleButton) {
            chatToggleButton.setAttribute('aria-expanded', 'true');
            chatToggleButton.setAttribute('aria-pressed', 'true');
        }
        
        chatToggle.style.display = 'none';
        this.chatOpen = true;
        
        // Focus on chat input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);
    }

    showTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    // Helper methods for task queries
    getTasksForToday() {
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = this.tasks.filter(task => {
            if (!task.dueDate) return false;
            return task.dueDate === today && !task.completed;
        });

        if (todayTasks.length === 0) {
            return "📅 You have no tasks due today. Great job staying on top of things!";
        }

        return `📅 Tasks due today (${todayTasks.length}):\n\n${todayTasks.map((task, index) => 
            `${index + 1}. ${task.text} (${task.priority} priority)`
        ).join('\n')}`;
    }

    getTasksForTomorrow() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDate = tomorrow.toISOString().split('T')[0];
        
        const tomorrowTasks = this.tasks.filter(task => {
            if (!task.dueDate) return false;
            return task.dueDate === tomorrowDate && !task.completed;
        });

        if (tomorrowTasks.length === 0) {
            return "📅 You have no tasks due tomorrow.";
        }

        return `📅 Tasks due tomorrow (${tomorrowTasks.length}):\n\n${tomorrowTasks.map((task, index) => 
            `${index + 1}. ${task.text} (${task.priority} priority)`
        ).join('\n')}`;
    }

    getTasksThisWeek() {
        const today = new Date();
        const weekFromNow = new Date();
        weekFromNow.setDate(today.getDate() + 7);
        
        const thisWeekTasks = this.tasks.filter(task => {
            if (!task.dueDate || task.completed) return false;
            const dueDate = new Date(task.dueDate);
            return dueDate >= today && dueDate <= weekFromNow;
        });

        if (thisWeekTasks.length === 0) {
            return "📅 You have no tasks due this week.";
        }

        return `📅 Tasks due this week (${thisWeekTasks.length}):\n\n${thisWeekTasks.map((task, index) => 
            `${index + 1}. ${task.text} - Due: ${this.formatDate(new Date(task.dueDate))} (${task.priority} priority)`
        ).join('\n')}`;
    }

    getOverdueTasks() {
        const today = new Date();
        const overdueTasks = this.tasks.filter(task => {
            if (!task.dueDate || task.completed) return false;
            return new Date(task.dueDate) < today;
        });

        if (overdueTasks.length === 0) {
            return "✅ You have no overdue tasks. Excellent work!";
        }

        return `⚠️ Overdue tasks (${overdueTasks.length}) - these need immediate attention:\n\n${overdueTasks.map((task, index) => 
            `${index + 1}. ${task.text} - Was due: ${this.formatDate(new Date(task.dueDate))} (${task.priority} priority)`
        ).join('\n')}`;
    }

    getCompletedTasks() {
        const completedTasks = this.tasks.filter(task => task.completed);

        if (completedTasks.length === 0) {
            return "📋 No completed tasks yet. Time to get started!";
        }

        const recentCompleted = completedTasks.slice(-10); // Show last 10 completed
        return `✅ Recently completed tasks (${completedTasks.length} total):\n\n${recentCompleted.map((task, index) => 
            `${index + 1}. ${task.text} - Completed: ${task.completedAt ? this.formatDate(new Date(task.completedAt)) : 'Recently'}`
        ).join('\n')}`;
    }

    getAllTasksSummary() {
        const total = this.tasks.length;
        const pending = this.tasks.filter(t => !t.completed).length;
        const completed = this.tasks.filter(t => t.completed).length;

        if (total === 0) {
            return "📋 Your task list is empty. Ready to add some tasks?";
        }

        return `📊 Task Summary:\n• Total tasks: ${total}\n• Pending: ${pending}\n• Completed: ${completed}\n\n${pending > 0 ? 'Would you like to see your pending tasks or add new ones?' : 'All tasks completed! 🎉'}`;
    }

    getHighPriorityTasks() {
        const highPriorityTasks = this.tasks.filter(task => task.priority === 'high' && !task.completed);

        if (highPriorityTasks.length === 0) {
            return "🔥 No high priority tasks pending.";
        }

        return `🔥 High priority tasks (${highPriorityTasks.length}):\n\n${highPriorityTasks.map((task, index) => 
            `${index + 1}. ${task.text}${task.dueDate ? ` - Due: ${this.formatDate(new Date(task.dueDate))}` : ''}`
        ).join('\n')}`;
    }

    getTaskStatistics() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const overdue = this.tasks.filter(t => {
            if (t.completed || !t.dueDate) return false;
            return new Date(t.dueDate) < new Date();
        }).length;
        
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        return `📊 Your Task Statistics:\n\n• Total tasks: ${total}\n• Completed: ${completed} (${completionRate}%)\n• Pending: ${pending}\n• Overdue: ${overdue}\n\n${this.getProductivityInsight(completionRate, overdue)}`;
    }

    getProductivityInsight(completionRate, overdueTasks) {
        if (completionRate >= 80 && overdueTasks === 0) {
            return "🌟 Outstanding productivity! You're crushing your goals!";
        } else if (completionRate >= 60) {
            return "💪 Good progress! Keep up the momentum!";
        } else if (overdueTasks > 3) {
            return "⚡ Consider focusing on overdue tasks first to get back on track.";
        } else {
            return "🎯 You've got this! Break down large tasks into smaller ones for better progress.";
        }
    }

    getGreetingResponse() {
        const greetings = [
            "Hello! I'm Shani, ready to help you manage your tasks! 😊",
            "Hi there! What can I help you accomplish today?",
            "Hey! Let's get your tasks organized. What's on your mind?",
            "Greetings! I'm here to help you stay productive. How can I assist?",
            "Hello! Ready to tackle your to-do list together? 🚀"
        ];
        
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    getCapabilitiesResponse(userMessage) {
        return "I can help you with many things! 🤖\n\n• **Add tasks**: 'Add buy groceries tomorrow with high priority'\n• **View tasks**: 'What's due today?' or 'Show overdue tasks'\n• **Complete tasks**: 'Mark workout as done'\n• **Delete tasks**: 'Remove grocery shopping'\n• **Get insights**: 'Show my statistics' or 'How am I doing?'\n\nI understand natural language, so just tell me what you need!";
    }

    // Utility helper methods
    containsAny(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }

    inferPriority(taskText) {
        const text = taskText.toLowerCase();
        if (this.containsAny(text, ['urgent', 'asap', 'critical', 'important', 'immediately'])) {
            return 'high';
        }
        if (this.containsAny(text, ['later', 'someday', 'eventually', 'when possible'])) {
            return 'low';
        }
        return 'medium';
    }

    inferDueDate(taskText) {
        const text = taskText.toLowerCase();
        const today = new Date();
        
        if (this.containsAny(text, ['today'])) {
            return today.toISOString().split('T')[0];
        }
        if (this.containsAny(text, ['tomorrow'])) {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        }
        if (this.containsAny(text, ['next week'])) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            return nextWeek.toISOString().split('T')[0];
        }
        
        return null;
    }

    inferCategory(taskText) {
        const text = taskText.toLowerCase();
        
        if (this.containsAny(text, ['meeting', 'call', 'email', 'work', 'office', 'project'])) {
            return 'work';
        }
        if (this.containsAny(text, ['grocery', 'shopping', 'buy', 'store', 'market'])) {
            return 'shopping';
        }
        if (this.containsAny(text, ['doctor', 'dentist', 'appointment', 'health', 'medicine'])) {
            return 'health';
        }
        if (this.containsAny(text, ['workout', 'exercise', 'gym', 'run', 'fitness'])) {
            return 'fitness';
        }
        if (this.containsAny(text, ['clean', 'laundry', 'dishes', 'home', 'house'])) {
            return 'home';
        }
        
        return 'personal';
    }

    closeChatInterface() {
        const chatContainer = document.getElementById('ai-chat-container');
        const chatToggle = document.getElementById('ai-chat-toggle');
        const chatToggleButton = chatToggle ? chatToggle.querySelector('button') : null;
        
        chatContainer.classList.remove('show');
        chatContainer.setAttribute('aria-hidden', 'true');
        if (chatToggleButton) {
            chatToggleButton.setAttribute('aria-expanded', 'false');
            chatToggleButton.setAttribute('aria-pressed', 'false');
        }
        setTimeout(() => {
            chatContainer.classList.add('hidden');
            chatToggle.style.display = 'block';
            if (chatToggleButton) {
                chatToggleButton.focus();
            }
        }, 300);
        
        this.chatOpen = false;
    }

    async handleChatInput() {
        if (this.chatProcessing) return;

        const chatInput = document.getElementById('chat-input');
        const userMessage = chatInput.value.trim();

        if (!userMessage) return;

        this.chatProcessing = true;

        // Add user message to chat
        this.addChatMessage('user', userMessage);

        // Clear input
        chatInput.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        // Process with Kimi AI or fallback to local processing
        try {
            await this.processAIQuery(userMessage);
        } catch (error) {
            console.error('Chat processing error:', error);
            this.hideTypingIndicator();
            this.addChatMessage('ai', 'Sorry, I encountered an error processing your request. Please try again.');
        } finally {
            this.chatProcessing = false;
        }
    }

    addChatMessage(sender, message, timestamp = new Date()) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        messageDiv.setAttribute('role', 'log');
        messageDiv.setAttribute('aria-live', 'polite');
        
        const timeString = this.formatChatTime(timestamp);
        const senderLabel = sender === 'user' ? 'You' : 'Shani';
        const safeMessage = sender === 'user'
            ? this.sanitizeUserMessage(message)
            : this.sanitizeAIResponseText(message);
        
        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="flex justify-end">
                    <div>
                        <div class="message-content" aria-label="Message from ${senderLabel} at ${timeString}">
                            ${this.escapeHtml(safeMessage)}
                        </div>
                        <div class="message-timestamp text-right">${timeString}</div>
                    </div>
                </div>
            `;
        } else {
            // Enhanced AI message with better formatting
            const formattedMessage = this.formatAIMessage(safeMessage);
            messageDiv.innerHTML = `
                <div class="flex items-start gap-2">
                    <div class="assistant-avatar-wrapper flex-shrink-0 mt-1" aria-hidden="true">
                        <img src="images/shani_img.png" alt="" role="presentation" class="assistant-avatar w-8 h-8" />
                    </div>
                    <div class="flex-1">
                        <div class="message-content" aria-label="Message from ${senderLabel} at ${timeString}">
                            ${formattedMessage}
                        </div>
                        <div class="message-timestamp">${timeString}</div>
                    </div>
                </div>
            `;
        }
        
        chatMessages.appendChild(messageDiv);
        
        // Smooth scroll with animation
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
        
        // Announce to screen readers
        const announcement = document.createElement('div');
        announcement.className = 'sr-only';
        announcement.setAttribute('aria-live', 'assertive');
        announcement.textContent = `${senderLabel} says: ${safeMessage}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
        
        // Store in chat history
        this.chatHistory.push({
            sender,
            message: safeMessage,
            timestamp: timestamp.toISOString()
        });
    }

    formatAIMessage(message) {
        // Enhanced formatting for AI messages
        const safeMessage = this.sanitizeAIResponseText(message);
        let formatted = safeMessage;
        
        // Convert line breaks to proper HTML
        formatted = formatted.replace(/\n\n/g, '</p><p>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Wrap in paragraph if it contains breaks
        if (formatted.includes('<br>') || formatted.includes('</p>')) {
            formatted = `<p>${formatted}</p>`;
        }
        
        // Format bullet points
        formatted = formatted.replace(/^•\s/gm, '<span class="inline-block w-4">•</span>');
        
        // Format numbers in lists
        formatted = formatted.replace(/^(\d+)\.\s/gm, '<span class="inline-block w-6 font-semibold text-purple-600">$1.</span>');
        
        // Format emojis to be more accessible
        formatted = formatted.replace(/📅/g, '<span role="img" aria-label="calendar">📅</span>');
        formatted = formatted.replace(/✅/g, '<span role="img" aria-label="check mark">✅</span>');
        formatted = formatted.replace(/🎉/g, '<span role="img" aria-label="celebration">🎉</span>');
        formatted = formatted.replace(/⚠️/g, '<span role="img" aria-label="warning">⚠️</span>');
        formatted = formatted.replace(/🔥/g, '<span role="img" aria-label="fire">🔥</span>');
        formatted = formatted.replace(/📊/g, '<span role="img" aria-label="chart">📊</span>');
        
        return formatted;
    }

    showTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        indicator.innerHTML = `
            <div class="flex items-center gap-2 text-gray-500 text-sm px-4 pb-2">
                <div class="assistant-avatar-wrapper flex-shrink-0">
                    <img src="images/shani_img.png" alt="" role="presentation" class="assistant-avatar w-7 h-7" />
                </div>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
                <span>Shani is thinking...</span>
            </div>
        `;
        indicator.classList.remove('hidden');
        indicator.setAttribute('aria-live', 'polite');
        indicator.setAttribute('aria-label', 'AI assistant is typing');
    }

    hideTypingIndicator() {
        document.getElementById('typing-indicator').classList.add('hidden');
    }

    async processAIQuery(userMessage) {
        this.hideTypingIndicator();
        
        // Prevent duplicate processing
        if (this.processingQuery) {
            return;
        }
        this.processingQuery = true;
        
        try {
            // Try Kimi AI first if available
            if (this.aiEnabled) {
                try {
                    const aiResponse = await this.queryKimiAI(userMessage);
                    if (aiResponse) {
                        await this.handleKimiResponse(userMessage, aiResponse);
                        return;
                    }
                } catch (error) {
                    console.error('Kimi AI processing error:', error);
                    // Fall back to local processing
                }
            }
            
            // Fallback to local AI processing
            await this.processLocalAI(userMessage);
        } finally {
            this.processingQuery = false;
        }
    }

    async handleKimiResponse(userMessage, aiResponse) {
        const responseContent = aiResponse.message?.content || aiResponse.content || '';
        const parsedResponse = this.parseAIResponse(responseContent);
        parsedResponse.response = this.sanitizeAIResponseText(parsedResponse.response || responseContent);
        parsedResponse.tasks = Array.isArray(parsedResponse.tasks)
            ? parsedResponse.tasks.map(task => this.sanitizeTaskData(task))
            : [];
        parsedResponse.suggestions = this.sanitizeSuggestionList(parsedResponse.suggestions || []);
        let actionTaken = false;

        // Handle the AI response based on action type
        switch (parsedResponse.action) {
            case 'add_task':
                if (parsedResponse.tasks && parsedResponse.tasks.length > 0) {
                    const addedTasks = [];

                    parsedResponse.tasks.forEach(taskData => {
                        // Enhance task with AI suggestions
                        if (!taskData.dueDate) {
                            taskData.dueDate = this.suggestDueDate(taskData.text);
                        }

                        // Use unified validation and addition
                        const result = this.validateAndAddTask(taskData, 'ai');
                        if (result.success) {
                            addedTasks.push(result.task);
                        }
                    });

                    actionTaken = addedTasks.length > 0;
                }
                break;
                
            case 'complete_task':
                const completionResult = this.markTaskComplete(userMessage);
                if (completionResult.success) {
                    actionTaken = true;
                }
                break;
                
            case 'delete_task':
                const deletionResult = this.deleteTaskByName(userMessage);
                if (deletionResult.success) {
                    actionTaken = true;
                    parsedResponse.response = this.sanitizeAIResponseText(`🗑️ Deleted "${deletionResult.taskName}" from your tasks.`);
                } else if (deletionResult.message) {
                    parsedResponse.response = this.sanitizeAIResponseText(deletionResult.message);
                }
                break;
                
            case 'view_tasks':
                // The AI response should already contain the task information
                break;
                
            case 'get_stats':
                // The AI response should already contain the statistics
                break;
        }

        // Add AI response to chat
        this.addChatMessage('ai', parsedResponse.response);

        // Show suggestions if provided
        if (parsedResponse.suggestions && parsedResponse.suggestions.length > 0) {
            const suggestionsText = this.sanitizeAIResponseText(`💡 Smart Suggestions:\n${parsedResponse.suggestions.map(s => `• ${s}`).join('\n')}`);
            setTimeout(() => {
                this.addChatMessage('ai', suggestionsText);
            }, 1000);
        }

        // Update UI if action was taken
        if (actionTaken) {
            this.debouncedRender();
        }
    }

    async processLocalAI(userMessage) {
        // Original local AI logic as fallback
        const lowercaseMessage = userMessage.toLowerCase();
        let response = '';
        let actionTaken = false;

        // Enhanced Task Creation with batch processing (including conversational patterns)
        if (this.containsAny(lowercaseMessage, [...this.nlpPatterns.taskCreation.verbs, 'i want to', 'i need to', 'i have to', 'can you add', 'could you add', 'please add'])) {
            const taskResults = await this.enhancedParseTaskFromMessage(userMessage);
            if (taskResults.length > 0) {
                // Process tasks with unified validation and creation
                const newTasks = [];
                taskResults.forEach(taskResult => {
                    // Auto-suggest due date if not provided
                    if (!taskResult.dueDate) {
                        const suggestedDate = this.suggestDueDate(taskResult.text);
                        if (suggestedDate) {
                            taskResult.dueDate = suggestedDate;
                        }
                    }

                    // Use unified validation and addition
                    const result = this.validateAndAddTask(taskResult, 'ai');
                    if (result.success) {
                        newTasks.push(result.task);
                    }
                });

                // Use unified response formatting
                response = this.formatTaskResponse(newTasks, 'added');

                if (newTasks.length > 0) {
                    actionTaken = true;
                }
            }
        }
        
        // Task Query Patterns
        else if (this.containsAny(lowercaseMessage, ['what', 'show', 'list', 'display', 'view', 'tell me', 'can you show', 'i want to see', 'let me see'])) {
            if (this.containsAny(lowercaseMessage, ['today', 'due today'])) {
                response = this.getTasksForToday();
            } else if (this.containsAny(lowercaseMessage, ['tomorrow', 'due tomorrow'])) {
                response = this.getTasksForTomorrow();
            } else if (this.containsAny(lowercaseMessage, ['this week', 'week', 'upcoming'])) {
                response = this.getTasksThisWeek();
            } else if (this.containsAny(lowercaseMessage, ['overdue', 'late'])) {
                response = this.getOverdueTasks();
            } else if (this.containsAny(lowercaseMessage, ['completed', 'done', 'finished'])) {
                response = this.getCompletedTasks();
            } else if (this.containsAny(lowercaseMessage, ['high priority', 'important', 'urgent'])) {
                response = this.getHighPriorityTasks();
            } else {
                response = this.getAllTasksSummary();
            }
        }
        
        // Other patterns remain the same...
        else if (this.containsAny(lowercaseMessage, ['complete', 'done', 'finished', 'mark as complete', 'check off'])) {
            const completionResult = this.markTaskComplete(userMessage);
            if (completionResult.success) {
                response = `✅ Great job! I've marked "${completionResult.taskName}" as completed.`;
                actionTaken = true;
            } else {
                response = completionResult.message;
            }
        }
        else if (this.containsAny(lowercaseMessage, ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'])) {
            response = this.getIntelligentGreeting();
        }
        else if (this.containsAny(lowercaseMessage, ['kimi', 'ai', 'assistant'])) {
            const responses = [
                "I'm Shani, your intelligent task assistant! What can I help you organize today?",
                "Hello! I'm here to make managing your tasks easier. What would you like to work on?",
                "Hi there! Ready to tackle some tasks together? Just tell me what you need!"
            ];
            response = responses[Math.floor(Math.random() * responses.length)];
        }
        else {
            response = "I'm here to help with your tasks! Try saying things like 'add a task', 'show my tasks', or 'what's due today?'";
        }

        // Add AI response to chat
        this.addChatMessage('ai', response);
        
        // Update UI if action was taken
        if (actionTaken) {
            this.debouncedRender();
        }
    }

    containsAny(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }

    parseTaskFromMessage(message) {
        // Simple natural language parsing for task creation
        let text = message;
        let priority = 'medium';
        let dueDate = null;

        // Remove command words
        text = text.replace(/^(add|create|new task|remind me to?|schedule)/i, '').trim();
        
        // Extract priority
        if (/high|important|urgent|critical/i.test(message)) {
            priority = 'high';
            text = text.replace(/\b(high|important|urgent|critical)\s*(priority)?\b/gi, '').trim();
        } else if (/low|later|someday/i.test(message)) {
            priority = 'low';
            text = text.replace(/\b(low|later|someday)\s*(priority)?\b/gi, '').trim();
        }

        // Extract due date
        const today = new Date();
        if (/today/i.test(message)) {
            dueDate = today.toISOString().split('T')[0];
            text = text.replace(/\btoday\b/gi, '').trim();
        } else if (/tomorrow/i.test(message)) {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            dueDate = tomorrow.toISOString().split('T')[0];
            text = text.replace(/\btomorrow\b/gi, '').trim();
        } else if (/next week/i.test(message)) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            dueDate = nextWeek.toISOString().split('T')[0];
            text = text.replace(/\bnext week\b/gi, '').trim();
        }

        // Clean up text
        text = text.replace(/\bwith\s*(priority)?\b/gi, '').trim();
        text = text.replace(/^(to\s+)?/, '').trim();

        if (text.length < 2) return null;

        return { text, priority, dueDate };
    }

    getTasksForToday() {
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = this.tasks.filter(task => 
            task.dueDate === today && !task.completed
        );
        
        if (todayTasks.length === 0) {
            return "🎉 You have no tasks due today! Enjoy your free time.";
        }
        
        let response = `📅 You have ${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today:\n\n`;
        todayTasks.forEach((task, index) => {
            response += `${index + 1}. ${task.text} (${task.priority} priority)\n`;
        });
        
        return response;
    }

    getTasksForTomorrow() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const tomorrowTasks = this.tasks.filter(task => 
            task.dueDate === tomorrowStr && !task.completed
        );
        
        if (tomorrowTasks.length === 0) {
            return "📅 You have no tasks due tomorrow.";
        }
        
        let response = `📅 You have ${tomorrowTasks.length} task${tomorrowTasks.length > 1 ? 's' : ''} due tomorrow:\n\n`;
        tomorrowTasks.forEach((task, index) => {
            response += `${index + 1}. ${task.text} (${task.priority} priority)\n`;
        });
        
        return response;
    }

    getTasksThisWeek() {
        const today = new Date();
        const weekFromNow = new Date(today);
        weekFromNow.setDate(today.getDate() + 7);
        
        const weekTasks = this.tasks.filter(task => {
            if (!task.dueDate || task.completed) return false;
            const taskDate = new Date(task.dueDate);
            return taskDate >= today && taskDate <= weekFromNow;
        });
        
        if (weekTasks.length === 0) {
            return "📅 You have no tasks due this week.";
        }
        
        let response = `📅 You have ${weekTasks.length} task${weekTasks.length > 1 ? 's' : ''} due this week:\n\n`;
        weekTasks.forEach((task, index) => {
            response += `${index + 1}. ${task.text} (${task.priority} priority) - Due: ${this.formatDate(new Date(task.dueDate))}\n`;
        });
        
        return response;
    }

    getOverdueTasks() {
        const today = new Date();
        const overdueTasks = this.tasks.filter(task => {
            if (!task.dueDate || task.completed) return false;
            return new Date(task.dueDate) < today;
        });
        
        if (overdueTasks.length === 0) {
            return "✅ Great! You have no overdue tasks.";
        }
        
        let response = `⚠️ You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}:\n\n`;
        overdueTasks.forEach((task, index) => {
            const daysOverdue = Math.floor((today - new Date(task.dueDate)) / (1000 * 60 * 60 * 24));
            response += `${index + 1}. ${task.text} (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue)\n`;
        });
        
        return response;
    }

    getCompletedTasks() {
        const completedTasks = this.tasks.filter(task => task.completed);
        
        if (completedTasks.length === 0) {
            return "You haven't completed any tasks yet. Keep going! 💪";
        }
        
        let response = `🎉 You've completed ${completedTasks.length} task${completedTasks.length > 1 ? 's' : ''}:\n\n`;
        completedTasks.slice(-5).forEach((task, index) => {
            response += `${index + 1}. ${task.text}\n`;
        });
        
        if (completedTasks.length > 5) {
            response += `\n...and ${completedTasks.length - 5} more!`;
        }
        
        return response;
    }

    getHighPriorityTasks() {
        const highPriorityTasks = this.tasks.filter(task => 
            task.priority === 'high' && !task.completed
        );
        
        if (highPriorityTasks.length === 0) {
            return "✅ You have no high priority tasks pending.";
        }
        
        let response = `🔥 You have ${highPriorityTasks.length} high priority task${highPriorityTasks.length > 1 ? 's' : ''}:\n\n`;
        highPriorityTasks.forEach((task, index) => {
            response += `${index + 1}. ${task.text}${task.dueDate ? ` (Due: ${this.formatDate(new Date(task.dueDate))})` : ''}\n`;
        });
        
        return response;
    }

    getAllTasksSummary() {
        if (this.tasks.length === 0) {
            return "You don't have any tasks yet. Start by adding your first task! 🚀";
        }
        
        const pending = this.tasks.filter(t => !t.completed).length;
        const completed = this.tasks.filter(t => t.completed).length;
        const highPriority = this.tasks.filter(t => t.priority === 'high' && !t.completed).length;
        
        let response = `📊 Task Summary:\n`;
        response += `• Total tasks: ${this.tasks.length}\n`;
        response += `• Pending: ${pending}\n`;
        response += `• Completed: ${completed}\n`;
        if (highPriority > 0) {
            response += `• High priority: ${highPriority}\n`;
        }
        
        return response;
    }

    markTaskComplete(message) {
        return this.runTaskMutation(() => {
            const normalizedMessage = (message || '').toString();

            // Extract task name from message
            const taskName = this.extractTaskName(normalizedMessage);
            if (!taskName) {
                return {
                    success: false,
                    message: "Could you specify which task you'd like to mark as complete? For example: 'Mark buy groceries as complete'"
                };
            }

            // Find matching task
            const task = this.tasks.find(t =>
                !t.completed && t.text.toLowerCase().includes(taskName.toLowerCase())
            );

            if (!task) {
                return {
                    success: false,
                    message: `I couldn't find a pending task matching "${taskName}". Could you check the task name?`
                };
            }

            // Mark as complete
            task.completed = true;
            task.completedAt = new Date().toISOString();
            this.saveTasksToStorage();

            return {
                success: true,
                taskName: task.text
            };
        }, {
            silent: true,
            onLocked: () => ({
                success: false,
                message: 'Another task update is in progress. Please try again shortly.'
            })
        });
    }

    deleteTaskByName(message) {
        return this.runTaskMutation(() => {
            const normalizedMessage = (message || '').toString();
            const taskName = this.extractTaskName(normalizedMessage);
            if (!taskName) {
                return {
                    success: false,
                    message: "Could you specify which task you'd like to delete? For example: 'Delete buy groceries' or 'Delete id:TASK_ID'"
                };
            }

            // Check if user provided a task ID
            const idMatch = normalizedMessage.toLowerCase().match(/id:([a-zA-Z0-9]+)/);
            if (idMatch) {
                const targetId = idMatch[1];
                const taskIndex = this.tasks.findIndex(t => t.id === targetId);
                if (taskIndex === -1) {
                    return {
                        success: false,
                        message: `I couldn't find a task with ID "${targetId}". Could you double-check it?`
                    };
                }

                const deletedTask = this.tasks.splice(taskIndex, 1)[0];
                this.saveTasksToStorage();
                this.debouncedRender();

                return {
                    success: true,
                    taskName: deletedTask.text,
                    taskId: targetId
                };
            }

            // Find all matching tasks
            const matchingTasks = this.tasks.filter(t =>
                t.text.toLowerCase().includes(taskName.toLowerCase())
            );

            if (matchingTasks.length === 0) {
                return {
                    success: false,
                    message: `I couldn't find a task matching "${taskName}". Could you check the task name or use 'delete id:TASK_ID' format?`
                };
            }

            if (matchingTasks.length === 1) {
                // Only one match, delete it
                const taskIndex = this.tasks.findIndex(t => t.id === matchingTasks[0].id);
                const deletedTask = this.tasks.splice(taskIndex, 1)[0];
                this.saveTasksToStorage();
                this.debouncedRender();

                return {
                    success: true,
                    taskName: deletedTask.text
                };
            }

            // Multiple matches, provide options
            let response = `I found ${matchingTasks.length} tasks matching "${taskName}". Please specify which one:\n\n`;
            matchingTasks.forEach((task, idx) => {
                response += `${idx + 1}. "${task.text}" (${task.priority} priority`;
                if (task.dueDate) {
                    response += `, due ${this.formatDate(new Date(task.dueDate))}`;
                }
                response += `) - ID: ${task.id}\n`;
            });
            response += `\nUse "delete id:${matchingTasks[0].id}" to delete a specific task.`;

            return {
                success: false,
                message: response,
                multipleMatches: true,
                matches: matchingTasks.map(t => ({ id: t.id, text: t.text, priority: t.priority, dueDate: t.dueDate }))
            };
        }, {
            silent: true,
            onLocked: () => ({
                success: false,
                message: 'A task update is currently running. Please try again in a moment.'
            })
        });
    }

    extractTaskName(message) {
        // Remove common command words and extract the task name
        let taskName = message.replace(/^(complete|mark|delete|remove|done|finished|cancel)\s+/i, '');
        taskName = taskName.replace(/\s+(as\s+)?(complete|done|finished)$/i, '');
        return taskName.trim();
    }

    getTaskStatistics() {
        if (this.tasks.length === 0) {
            return "You don't have any tasks to analyze yet. Start by adding your first task! 📊";
        }
        
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const completionRate = Math.round((completed / total) * 100);
        
        const highPriority = this.tasks.filter(t => t.priority === 'high').length;
        const mediumPriority = this.tasks.filter(t => t.priority === 'medium').length;
        const lowPriority = this.tasks.filter(t => t.priority === 'low').length;
        
        const today = new Date();
        const overdue = this.tasks.filter(t => 
            t.dueDate && new Date(t.dueDate) < today && !t.completed
        ).length;
        
        let response = `📊 Your Task Statistics:\n\n`;
        response += `📈 Progress: ${completed}/${total} tasks completed (${completionRate}%)\n`;
        response += `📋 Pending: ${pending} tasks\n\n`;
        response += `🎯 Priority Breakdown:\n`;
        response += `• High: ${highPriority} tasks\n`;
        response += `• Medium: ${mediumPriority} tasks\n`;
        response += `• Low: ${lowPriority} tasks\n`;
        
        if (overdue > 0) {
            response += `\n⚠️ Overdue: ${overdue} tasks need attention`;
        }
        
        return response;
    }

    getHelpMessage() {
        return `🤖 I'm Shani, your AI Task Assistant! Here's what I can help you with:\n\n` +
               `📝 **Add Tasks:**\n` +
               `• "Add buy groceries tomorrow"\n` +
               `• "Create workout session high priority"\n` +
               `• "Remind me to call mom"\n\n` +
               `📋 **View Tasks:**\n` +
               `• "What's due today?"\n` +
               `• "Show me this week's tasks"\n` +
               `• "List high priority tasks"\n\n` +
               `✅ **Manage Tasks:**\n` +
               `• "Mark exercise as complete"\n` +
               `• "Delete grocery shopping"\n\n` +
               `📊 **Get Insights:**\n` +
               `• "Show my statistics"\n` +
               `• "How many tasks are overdue?"\n\n` +
               `💬 **General Chat:**\n` +
               `• I can understand natural conversation!\n` +
               `• Ask me questions about your tasks\n` +
               `• Tell me what you want to accomplish\n\n` +
               `Just type naturally and I'll understand! 🚀`;
    }

    getGreetingResponse() {
        const greetings = [
            "Hello! I'm Shani, your personal task assistant. How can I help you organize your day today?",
            "Hi there! Ready to tackle some tasks? I'm here to help you stay organized and productive!",
            "Hey! Great to see you! What would you like to accomplish today? I can help you manage your tasks.",
            "Hello! I'm Shani, and I'm excited to help you get things done. What's on your mind today?",
            "Hi! How are you doing today? I'm here to help you manage your tasks and stay on top of everything!"
        ];
        
        const currentHour = new Date().getHours();
        let timeGreeting = "";
        
        if (currentHour < 12) {
            timeGreeting = "Good morning! ";
        } else if (currentHour < 17) {
            timeGreeting = "Good afternoon! ";
        } else {
            timeGreeting = "Good evening! ";
        }
        
        return timeGreeting + greetings[Math.floor(Math.random() * greetings.length)];
    }

    getCapabilitiesResponse(userMessage) {
        const message = userMessage.toLowerCase();
        
        if (message.includes('multiple') || message.includes('batch') || message.includes('several')) {
            return "Absolutely! I can handle multiple tasks at once. Try saying something like 'Add workout tomorrow and buy groceries this weekend and call dentist next week' - I'll create all those tasks for you in one go!";
        }
        
        if (message.includes('remind') || message.includes('notification')) {
            return "I can definitely help you set up reminders! Just tell me things like 'Remind me to call mom tomorrow' or 'Add dentist appointment next week' and I'll create tasks with due dates. The app will show you what's due and overdue.";
        }
        
        if (message.includes('smart') || message.includes('intelligent')) {
            return "Yes! I'm quite smart about understanding your requests. I can:\n• Parse natural language commands\n• Suggest due dates based on task types\n• Learn from your patterns\n• Handle multiple tasks in one request\n• Understand different ways of saying the same thing\n\nTry me with any request!";
        }
        
        return "I can do quite a lot! I understand natural language, so you can talk to me normally. I can add tasks, show your schedule, mark things complete, give you statistics, and much more. Want to see my full capabilities? Just ask 'What can you do?' or 'Help'!";
    }

    getContextualResponse(userMessage) {
        const message = userMessage.toLowerCase();
        
        // Check if user is trying to describe something
        if (message.includes('i want') || message.includes('i need') || message.includes('i have to')) {
            return "I'd be happy to help with what you want to do! Could you be more specific? For example:\n• 'I want to add a task for...'\n• 'I need to see what's due...'\n• 'I have to remember to...'\n\nWhat specifically would you like me to help you with?";
        }
        
        // Check for question words
        if (message.includes('what') || message.includes('how') || message.includes('when') || message.includes('where') || message.includes('why')) {
            return "Great question! I'm here to help with task management. You can ask me things like:\n• 'What tasks do I have?'\n• 'How many tasks are overdue?'\n• 'When is my next deadline?'\n\nWhat would you like to know about your tasks?";
        }
        
        // Check for planning words
        if (message.includes('plan') || message.includes('organize') || message.includes('schedule')) {
            return "I love helping with planning and organization! I can help you:\n• Schedule tasks with due dates\n• Organize by priority levels\n• Plan your week or day\n• Keep track of deadlines\n\nWhat would you like to plan or organize?";
        }
        
        return null; // Let the default response handle it
    }

    formatChatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance
    window.todoApp = new TodoApp();
    
    // Set default due date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('due-date').value = today;
    
    // Focus on the task input
    document.getElementById('task-input').focus();
});

// Service Worker registration for offline functionality (optional enhancement)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // This would require creating a service worker file
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered'))
        //     .catch(error => console.log('SW registration failed'));
    });
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TodoApp;
}