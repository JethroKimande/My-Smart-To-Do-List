// To-Do List Application JavaScript
class TodoApp {
    constructor() {
        this.tasks = [];
        this.currentEditId = null;
        this.currentFilter = 'all';
        this.currentCategoryFilter = 'all';
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

        this.aiEnabled = false;
        const browserWindow = typeof window !== 'undefined' ? window : null;
    this.apiKey = browserWindow && (browserWindow.OPENROUTER_API_KEY || browserWindow.KIMI_API_KEY) || API_KEY;
    this.aiModel = 'mistralai/mistral-7b-instruct:free';
        this.aiEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
        this.aiReferer = browserWindow && browserWindow.location ? browserWindow.location.origin : '';
        this.aiTitle = 'My Smart To-Do List';

        this.init();
    }

    init() {
        this.nlpPatterns = this.initializeNLPPatterns();
        this.initializeTheme();
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
            { id: 'category-select', description: 'Task category selector' },
            { id: 'due-date', description: 'Task due date input' },
            { id: 'filter-category', description: 'Category filter dropdown' },
            { id: 'edit-category-select', description: 'Edit task category selector' }
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

        document.getElementById('filter-category').addEventListener('change', (e) => {
            this.currentCategoryFilter = e.target.value;
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
            const categorySelect = document.getElementById('category-select');

            if (!taskInput || !prioritySelect || !dueDateInput) {
                console.error('Required form elements missing for adding a task.');
                return;
            }

            const rawTaskData = {
                text: taskInput.value,
                priority: prioritySelect.value,
                dueDate: dueDateInput.value,
                category: categorySelect ? categorySelect.value : 'general'
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
                category: sanitizedTask.category || 'general',
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
            if (categorySelect) {
                categorySelect.value = 'general';
            }

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

            const wasCompleted = task.completed;
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;

            // Handle recurring task if completed
            if (task.completed && !wasCompleted && task.recurring) {
                const nextTask = this.handleRecurringTask(task);
                if (nextTask) {
                    // Check if next instance doesn't already exist
                    const existsAlready = this.tasks.some(t => 
                        t.text === nextTask.text && 
                        t.dueDate === nextTask.dueDate && 
                        !t.completed &&
                        t.id !== task.id
                    );
                    
                    if (!existsAlready) {
                        this.tasks.push(nextTask);
                        this.announceToScreenReader(`Recurring task completed. Next instance scheduled for ${this.formatDate(new Date(nextTask.dueDate))}.`);
                    }
                }
            }

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
        const editTaskInput = document.getElementById('edit-task-input');
        const editPrioritySelect = document.getElementById('edit-priority-select');
        const editDueDateInput = document.getElementById('edit-due-date');
        const editCategorySelect = document.getElementById('edit-category-select');

        if (editTaskInput) {
            editTaskInput.value = task.text;
        }
        if (editPrioritySelect) {
            editPrioritySelect.value = task.priority;
        }
        if (editDueDateInput) {
            editDueDateInput.value = task.dueDate || '';
        }
        if (editCategorySelect) {
            const normalizedCategory = (task.category || 'general').toLowerCase();
            const optionExists = Array.from(editCategorySelect.options).some(option => option.value === normalizedCategory);
            editCategorySelect.value = optionExists ? normalizedCategory : 'general';
        }

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
            const categorySelect = document.getElementById('edit-category-select');

            if (!taskInput || !prioritySelect || !dueDateInput) {
                console.error('Edit form elements missing.');
                return;
            }

            const rawDueDate = dueDateInput.value;

            const sanitizedTask = this.sanitizeTaskData({
                ...task,
                text: taskInput.value,
                priority: prioritySelect.value,
                dueDate: rawDueDate,
                category: categorySelect ? categorySelect.value : task.category
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
            task.category = sanitizedTask.category || 'general';
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

    // Subtask Management Methods
    addSubtask(taskId) {
        const subtaskText = prompt('Enter subtask description:');
        if (!subtaskText || !subtaskText.trim()) {
            return;
        }

        return this.runTaskMutation(() => {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) {
                this.announceToScreenReader('Parent task not found.');
                return;
            }

            if (!task.subtasks) {
                task.subtasks = [];
            }

            const subtask = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                text: subtaskText.trim(),
                completed: false,
                createdAt: new Date().toISOString()
            };

            task.subtasks.push(subtask);
            task.updatedAt = new Date().toISOString();

            this.saveTasksToStorage();
            this.renderTasks();
            this.announceToScreenReader(`Subtask "${subtask.text}" added.`);
        }, {
            message: 'Another task update is in progress. Please wait.'
        });
    }

    toggleSubtask(taskId, subtaskIndex) {
        return this.runTaskMutation(() => {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task || !task.subtasks || !task.subtasks[subtaskIndex]) {
                this.announceToScreenReader('Subtask not found.');
                return;
            }

            const subtask = task.subtasks[subtaskIndex];
            subtask.completed = !subtask.completed;
            subtask.completedAt = subtask.completed ? new Date().toISOString() : null;
            task.updatedAt = new Date().toISOString();

            this.saveTasksToStorage();
            this.renderTasks();
            
            const status = subtask.completed ? 'completed' : 'marked as pending';
            this.announceToScreenReader(`Subtask "${subtask.text}" ${status}.`);
        }, {
            message: 'Another task update is in progress. Please wait.'
        });
    }

    deleteSubtask(taskId, subtaskIndex) {
        if (!confirm('Are you sure you want to delete this subtask?')) {
            return;
        }

        return this.runTaskMutation(() => {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task || !task.subtasks || !task.subtasks[subtaskIndex]) {
                this.announceToScreenReader('Subtask not found.');
                return;
            }

            const deletedSubtask = task.subtasks.splice(subtaskIndex, 1)[0];
            task.updatedAt = new Date().toISOString();

            this.saveTasksToStorage();
            this.renderTasks();
            this.announceToScreenReader(`Subtask "${deletedSubtask.text}" deleted.`);
        }, {
            message: 'Another task update is in progress. Please wait.'
        });
    }

    // Recurring Tasks Management
    handleRecurringTask(completedTask) {
        if (!completedTask.recurring || !completedTask.completed) {
            return null;
        }

        const nextDueDate = this.calculateNextRecurringDate(completedTask.dueDate, completedTask.recurring);
        if (!nextDueDate) {
            return null;
        }

        // Create the next instance
        const nextTask = {
            ...completedTask,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            dueDate: nextDueDate.toISOString().split('T')[0],
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString(),
            subtasks: completedTask.subtasks ? completedTask.subtasks.map(st => ({
                ...st,
                completed: false,
                completedAt: null
            })) : []
        };

        return nextTask;
    }

    calculateNextRecurringDate(currentDueDate, recurring) {
        if (!currentDueDate || !recurring) {
            return null;
        }

        const current = new Date(currentDueDate);
        const next = new Date(current);

        switch (recurring.type) {
            case 'daily':
                next.setDate(current.getDate() + (recurring.interval || 1));
                break;
            case 'weekly':
                if (recurring.dayOfWeek !== undefined) {
                    // For specific day of week (e.g., every Monday)
                    next.setDate(current.getDate() + 7);
                } else {
                    // Generic weekly
                    next.setDate(current.getDate() + (7 * (recurring.interval || 1)));
                }
                break;
            case 'monthly':
                next.setMonth(current.getMonth() + (recurring.interval || 1));
                break;
            default:
                return null;
        }

        return next;
    }

    processRecurringTasks() {
        const newRecurringTasks = [];
        
        this.tasks.forEach(task => {
            if (task.recurring && task.completed) {
                const nextTask = this.handleRecurringTask(task);
                if (nextTask) {
                    // Check if next instance already exists
                    const existsAlready = this.tasks.some(t => 
                        t.text === nextTask.text && 
                        t.dueDate === nextTask.dueDate && 
                        !t.completed
                    );
                    
                    if (!existsAlready) {
                        newRecurringTasks.push(nextTask);
                    }
                }
            }
        });

        if (newRecurringTasks.length > 0) {
            this.tasks.push(...newRecurringTasks);
            this.saveTasksToStorage();
            return newRecurringTasks;
        }

        return [];
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

        // Filter by category
        if (this.currentCategoryFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => {
                const normalizedCategory = (this.sanitizePlainText(task.category || 'general') || 'general').toLowerCase();
                return normalizedCategory === this.currentCategoryFilter;
            });
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
        const rawCategory = this.sanitizePlainText(task.category || 'general') || 'general';
        const normalizedCategorySlug = rawCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
        const categoryClass = `category-${normalizedCategorySlug}`;
        const categoryLabel = rawCategory.split(' ').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'General';
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
                                <span class="category-badge ${categoryClass}">${this.escapeHtml(categoryLabel)}</span>
                            </div>
                        </div>
                        
                        ${this.generateSubtasksHTML(task)}
                        
                        <div class="flex items-center justify-between">
                            <div class="text-sm text-gray-500">
                                ${dueDateDisplay}
                                <div class="text-xs mt-1">
                                    Created: ${this.formatDate(new Date(task.createdAt))}
                                    ${task.recurring ? `<span class="ml-2 text-blue-600"><i class="fas fa-repeat"></i> ${this.formatRecurring(task.recurring)}</span>` : ''}
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2 task-actions">
                                <button class="btn-action btn-subtask" onclick="todoApp.addSubtask('${task.id}')" title="Add subtask">
                                    <i class="fas fa-plus"></i>
                                </button>
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

    generateSubtasksHTML(task) {
        if (!task.subtasks || task.subtasks.length === 0) {
            return '';
        }

        const subtasksHTML = task.subtasks.map((subtask, index) => {
            return `
                <div class="subtask-item flex items-center gap-2 ml-8 mt-2">
                    <div class="subtask-checkbox ${subtask.completed ? 'checked' : ''}" 
                         onclick="todoApp.toggleSubtask('${task.id}', ${index})">
                    </div>
                    <span class="subtask-text ${subtask.completed ? 'line-through text-gray-500' : 'text-gray-700'}">${this.escapeHtml(subtask.text)}</span>
                    <button class="btn-action btn-delete-subtask ml-auto" 
                            onclick="todoApp.deleteSubtask('${task.id}', ${index})" 
                            title="Delete subtask">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            `;
        }).join('');

        return `
            <div class="subtasks-container mt-3">
                ${subtasksHTML}
            </div>
        `;
    }

    formatRecurring(recurring) {
        if (!recurring) return '';
        
        switch (recurring.type) {
            case 'daily':
                return 'Daily';
            case 'weekly':
                if (recurring.dayOfWeek !== undefined) {
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    return `Every ${days[recurring.dayOfWeek]}`;
                }
                return 'Weekly';
            case 'monthly':
                return 'Monthly';
            default:
                return 'Recurring';
        }
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

    normalizeTextForMatching(value) {
        const plain = this.sanitizePlainText(value || '');
        const lowercase = plain.toLowerCase();
        const withoutPunctuation = lowercase.replace(/[^a-z0-9\s]/g, ' ');
        const stopwords = ['the', 'a', 'an', 'please', 'task', 'event', 'meeting', 'with', 'for', 'at', 'on', 'to', 'of'];
        const tokens = withoutPunctuation
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token.length > 0)
            .map(token => stopwords.includes(token) ? '' : token)
            .filter(Boolean);

        const uniqueTokens = Array.from(new Set(tokens));

        return {
            normalized: uniqueTokens.join(' '),
            tokens: uniqueTokens,
            hasTokens: uniqueTokens.length > 0
        };
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

    parseNaturalLanguageDate(value) {
        if (typeof value !== 'string') return null;

        const text = value.toLowerCase().trim();
        if (!text) return null;

        const normalizeBaseDate = (date) => {
            const normalized = new Date(date.getTime());
            normalized.setHours(12, 0, 0, 0);
            return normalized;
        };

        const today = normalizeBaseDate(new Date());

        if (/\btoday\b/.test(text)) {
            return today;
        }

        if (/\bday\s+after\s+tomorrow\b/.test(text)) {
            const date = new Date(today.getTime());
            date.setDate(date.getDate() + 2);
            return date;
        }

        if (/\btomorrow\b/.test(text)) {
            const date = new Date(today.getTime());
            date.setDate(date.getDate() + 1);
            return date;
        }

        const relativeMatch = text.match(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/);
        if (relativeMatch) {
            const amount = parseInt(relativeMatch[1], 10);
            if (!Number.isNaN(amount)) {
                const date = new Date(today.getTime());
                const unit = relativeMatch[2];
                const multiplier = unit.startsWith('week') ? 7 : 1;
                date.setDate(date.getDate() + amount * multiplier);
                return date;
            }
        }

        const weekdayMatch = text.match(/\b(?:on\s+)?(this|next|upcoming|coming)?\s*(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/);
        if (weekdayMatch) {
            const qualifier = (weekdayMatch[1] || '').trim();
            const weekdayKey = weekdayMatch[2];
            const weekdayMap = {
                sunday: 0, sun: 0,
                monday: 1, mon: 1,
                tuesday: 2, tue: 2, tues: 2,
                wednesday: 3, wed: 3,
                thursday: 4, thu: 4, thur: 4, thurs: 4,
                friday: 5, fri: 5,
                saturday: 6, sat: 6
            };

            const targetDay = weekdayMap[weekdayKey];
            if (targetDay !== undefined) {
                const forceNext = qualifier === 'next' || qualifier === 'upcoming' || qualifier === 'coming';
                let candidate = this.getNextWeekday(targetDay, forceNext);
                candidate = normalizeBaseDate(candidate);

                if (qualifier === 'this' && candidate < today) {
                    candidate.setDate(candidate.getDate() + 7);
                }

                return candidate;
            }
        }

        const monthMap = {
            january: 0, jan: 0,
            february: 1, feb: 1,
            march: 2, mar: 2,
            april: 3, apr: 3,
            may: 4,
            june: 5, jun: 5,
            july: 6, jul: 6,
            august: 7, aug: 7,
            september: 8, sept: 8, sep: 8,
            october: 9, oct: 9,
            november: 10, nov: 10,
            december: 11, dec: 11
        };

        const monthPattern = /\b(?:on\s+)?(?:(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\s*,\s*)?(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?(?:\s+at\s+[0-9:apm\.\s]+)?\b/;
        const monthMatch = text.match(monthPattern);
        if (monthMatch) {
            const [, weekdayQualifier, monthKey, dayRaw, yearRaw] = monthMatch;
            const monthIndex = monthMap[monthKey];
            const day = parseInt(dayRaw, 10);

            if (monthIndex !== undefined && !Number.isNaN(day)) {
                const currentYear = today.getFullYear();
                let year = yearRaw ? parseInt(yearRaw, 10) : currentYear;

                if (!yearRaw) {
                    const tentative = new Date(currentYear, monthIndex, day);
                    if (tentative < today) {
                        year += 1;
                    }
                }

                let candidate = new Date(year, monthIndex, day);
                candidate = normalizeBaseDate(candidate);

                if (weekdayQualifier) {
                    const weekdayMapExtended = {
                        sunday: 0, sun: 0,
                        monday: 1, mon: 1,
                        tuesday: 2, tue: 2, tues: 2,
                        wednesday: 3, wed: 3,
                        thursday: 4, thu: 4, thur: 4, thurs: 4,
                        friday: 5, fri: 5,
                        saturday: 6, sat: 6
                    };

                    const targetDay = weekdayMapExtended[weekdayQualifier];
                    if (targetDay !== undefined && candidate.getDay() !== targetDay) {
                        const offset = (targetDay - candidate.getDay() + 7) % 7;
                        candidate.setDate(candidate.getDate() + offset);
                    }
                }

                return candidate;
            }
        }

        return null;
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
                const naturalDate = this.parseNaturalLanguageDate(trimmed);
                if (naturalDate) {
                    dateObj = naturalDate;
                } else {
                    const parsed = new Date(trimmed);
                    if (isNaN(parsed.getTime())) {
                        return null;
                    }
                    dateObj = parsed;
                }
            }
        }

        if (!dateObj || isNaN(dateObj.getTime())) {
            return null;
        }

        const normalizedDate = new Date(dateObj.getTime());
        normalizedDate.setHours(12, 0, 0, 0);

        return normalizedDate.toISOString().split('T')[0];
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
                const parsedTasks = JSON.parse(stored);
                if (Array.isArray(parsedTasks)) {
                    this.tasks = parsedTasks.map(task => {
                        const existingCategory = task && typeof task.category === 'string' ? task.category : 'general';
                        return {
                            ...task,
                            category: this.sanitizePlainText(existingCategory) || 'general'
                        };
                    });
                }
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
            createdBy,
            // New fields for enhanced functionality
            subtasks: sanitizedTask.subtasks || [],
            recurring: sanitizedTask.recurring || null,
            notes: sanitizedTask.notes || '',
            completedAt: null
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

            const normalizeCategory = (category) => (this.sanitizePlainText(category || 'general') || 'general').toLowerCase();
            const categoryMatch = normalizeCategory(existingTask.category) === normalizeCategory(newTaskData.category);
            
            // Task is duplicate only if ALL properties match
            return textMatch && priorityMatch && dateMatch && categoryMatch;
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

    // Update a task's due date using natural language phrases
    updateTaskDueDate(userMessage) {
        const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        return this.runTaskMutation(() => {
            const originalMessage = (userMessage || '').toString();
            const lowerMessage = originalMessage.toLowerCase();

            const tokens = lowerMessage.split(/\s+/).filter(Boolean);
            let matchedPhrase = null;
            let normalizedDate = null;

            for (let length = Math.min(5, tokens.length); length >= 1 && !normalizedDate; length--) {
                for (let start = 0; start <= tokens.length - length; start++) {
                    const candidate = tokens.slice(start, start + length).join(' ');
                    const parsed = this.parseDatePhrase(candidate);
                    if (parsed) {
                        matchedPhrase = candidate;
                        normalizedDate = parsed;
                        break;
                    }
                }
            }

            if (!normalizedDate) {
                return {
                    success: false,
                    message: "I couldn't understand the new due date. Try using phrases like 'tomorrow', 'next Friday', or a specific date like 2025-01-15."
                };
            }

            const escapedPhrase = escapeRegExp(matchedPhrase);
            const updatePattern = new RegExp(`(?:change|set|update|move|adjust)\\s+(?:the\\s+)?(?:due\\s+date|deadline)(?:\\s+(?:of|for))?\\s+(?<task>.+?)\\s+(?:to|for|by|on)\\s+${escapedPhrase}(?:\\s+deadline|\\s+due\s+date)?\\s*[.!?]?`, 'i');
            const match = originalMessage.match(updatePattern);

            let taskName = match?.groups?.task?.trim();
            if (!taskName) {
                let rough = lowerMessage.replace(matchedPhrase, '').replace(/\b(to|for|by|on)\b\s*$/i, '');
                rough = rough.replace(/(?:change|set|update|move|adjust)\s+(?:the\s+)?(?:due\s+date|deadline)(?:\s+(?:of|for))?/i, '');
                taskName = rough.trim();
            }

            if (!taskName) {
                return {
                    success: false,
                    message: "I couldn't figure out which task to update. Please mention the task name clearly."
                };
            }

            const normalizedTaskName = taskName.toLowerCase();
            const candidates = [];

            this.tasks.forEach(task => {
                const taskText = task.text.toLowerCase();
                if (taskText === normalizedTaskName) {
                    candidates.push({ task, score: 100 });
                    return;
                }

                if (taskText.includes(normalizedTaskName) || normalizedTaskName.includes(taskText)) {
                    candidates.push({ task, score: Math.min(taskText.length, normalizedTaskName.length) });
                    return;
                }

                const taskWords = taskText.split(/\s+/).filter(Boolean);
                const targetWords = normalizedTaskName.split(/\s+/).filter(Boolean);
                const matches = targetWords.filter(word => taskWords.includes(word));
                if (matches.length > 0) {
                    candidates.push({ task, score: matches.length });
                }
            });

            if (candidates.length === 0) {
                return {
                    success: false,
                    message: `I couldn't find a task that matches "${taskName}". Try using the exact task name.`
                };
            }

            candidates.sort((a, b) => b.score - a.score);
            if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
                const suggestions = candidates.slice(0, 3).map(c => `• ${c.task.text}`).join('\n');
                return {
                    success: false,
                    message: `I found multiple tasks that could match:
${suggestions}
Please be more specific or include the task ID.`,
                    multipleMatches: true
                };
            }

            const taskToUpdate = candidates[0].task;
            taskToUpdate.dueDate = normalizedDate;
            taskToUpdate.updatedAt = new Date().toISOString();
            this.saveTasksToStorage();
            this.debouncedRender();

            const friendlyDate = this.formatDate(new Date(normalizedDate));
            return {
                success: true,
                task: taskToUpdate,
                message: `📅 Updated the due date for "${taskToUpdate.text}" to ${friendlyDate}.`
            };
        }, {
            silent: true,
            onLocked: () => ({
                success: false,
                message: 'Another task update is currently in progress. Please try again shortly.'
            })
        });
    }

    // Update a task's priority using natural language phrases
    updateTaskPriority(userMessage) {
        const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        return this.runTaskMutation(() => {
            const originalMessage = (userMessage || '').toString();
            const lowerMessage = originalMessage.toLowerCase();

            const tokens = lowerMessage.split(/\s+/).filter(Boolean);
            let matchedPriorityPhrase = null;
            let normalizedPriority = null;

            for (let length = Math.min(3, tokens.length); length >= 1 && !normalizedPriority; length--) {
                for (let start = 0; start <= tokens.length - length; start++) {
                    const candidate = tokens.slice(start, start + length).join(' ');
                    const parsed = this.parsePriorityWord(candidate);
                    if (parsed) {
                        matchedPriorityPhrase = candidate;
                        normalizedPriority = parsed;
                        break;
                    }
                }
            }

            if (!normalizedPriority) {
                return {
                    success: false,
                    message: "I couldn't understand the new priority. Try using words like high, urgent, normal, or low."
                };
            }

            const escapedPhrase = escapeRegExp(matchedPriorityPhrase);
            const updatePattern = new RegExp(`(?:set|change|update|adjust|make)\\s+(?:the\\s+)?priority(?:\\s+(?:of|for|on))?\\s+(?<task>.+?)\\s+(?:to|as|be|is|become)\\s+${escapedPhrase}(?:\\s+priority)?\\s*[.!?]?`, 'i');
            const match = originalMessage.match(updatePattern);

            let taskName = match?.groups?.task?.trim();
            if (!taskName) {
                let rough = lowerMessage.replace(matchedPriorityPhrase, '').replace(/\b(high|medium|low|urgent|critical|important|asap|normal|regular|standard|later|someday|eventually)\b\s*priority?/g, '');
                rough = rough.replace(/(?:set|change|update|adjust|make)\s+(?:the\s+)?priority(?:\s+(?:of|for|on))?/i, '');
                rough = rough.replace(/\bto\b\s*$/i, '').trim();
                taskName = rough;
            }

            if (!taskName) {
                return {
                    success: false,
                    message: "I couldn't figure out which task to update. Please mention the task name clearly."
                };
            }

            const normalizedTaskName = taskName.toLowerCase();
            const candidates = [];

            this.tasks.forEach(task => {
                const taskText = task.text.toLowerCase();
                if (taskText === normalizedTaskName) {
                    candidates.push({ task, score: 100 });
                    return;
                }

                if (taskText.includes(normalizedTaskName) || normalizedTaskName.includes(taskText)) {
                    candidates.push({ task, score: Math.min(taskText.length, normalizedTaskName.length) });
                    return;
                }

                const taskWords = taskText.split(/\s+/).filter(Boolean);
                const targetWords = normalizedTaskName.split(/\s+/).filter(Boolean);
                const matches = targetWords.filter(word => taskWords.includes(word));
                if (matches.length > 0) {
                    candidates.push({ task, score: matches.length });
                }
            });

            if (candidates.length === 0) {
                return {
                    success: false,
                    message: `I couldn't find a task that matches "${taskName}". Try using the exact task name.`
                };
            }

            candidates.sort((a, b) => b.score - a.score);
            if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
                const suggestions = candidates.slice(0, 3).map(c => `• ${c.task.text}`).join('\n');
                return {
                    success: false,
                    message: `I found multiple tasks that could match:
${suggestions}
Please be more specific or include the task ID.`,
                    multipleMatches: true
                };
            }

            const taskToUpdate = candidates[0].task;
            taskToUpdate.priority = normalizedPriority;
            taskToUpdate.updatedAt = new Date().toISOString();
            this.saveTasksToStorage();
            this.debouncedRender();

            const priorityResponse = normalizedPriority === 'high'
                ? '🔥 high priority'
                : normalizedPriority === 'low'
                    ? '🕒 low priority'
                    : '✨ medium priority';

            return {
                success: true,
                task: taskToUpdate,
                message: `Updated the priority for "${taskToUpdate.text}" to ${priorityResponse}.`
            };
        }, {
            silent: true,
            onLocked: () => ({
                success: false,
                message: 'Another task update is currently in progress. Please try again shortly.'
            })
        });
    }

    getAIEndpoint() {
        return this.aiEndpoint || 'https://openrouter.ai/api/v1/chat/completions';
    }

    getAIModel() {
        if (!this.aiModel) {
            this.aiModel = 'moonshot/kimi-k2';
        }
        return this.aiModel;
    }

    buildAIHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey || ''}`
        };

        const referer = this.aiReferer || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
        if (referer) {
            headers['HTTP-Referer'] = referer;
        }

        if (this.aiTitle) {
            headers['X-Title'] = this.aiTitle;
        }

        return headers;
    }

    // Kimi AI Integration via OpenRouter API
    async initializeAI() {
        try {
            this.aiEndpoint = this.getAIEndpoint();
            this.aiModel = this.getAIModel();
            // Enable AI since we have the API key
            this.aiEnabled = true;
            console.log('Kimi AI initialized via OpenRouter');

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
        const response = await fetch(this.getAIEndpoint(), {
            method: 'POST',
            headers: this.buildAIHeaders(),
            body: JSON.stringify({
                model: this.getAIModel(),
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

            // Make direct API call via OpenRouter
            const response = await fetch(this.getAIEndpoint(), {
                method: 'POST',
                headers: this.buildAIHeaders(),
                body: JSON.stringify({
                    model: this.getAIModel(),
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
                    // Basic time indicators
                    today: () => new Date(),
                    tomorrow: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; },
                    yesterday: () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; },
                    
                    // Week-based indicators
                    'next week': () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; },
                    'this week': () => new Date(),
                    'last week': () => { const d = new Date(); d.setDate(d.getDate() - 7); return d; },
                    'this weekend': () => { const d = new Date(); const days = 6 - d.getDay(); d.setDate(d.getDate() + days); return d; },
                    'next weekend': () => { const d = new Date(); const days = 13 - d.getDay(); d.setDate(d.getDate() + days); return d; },
                    
                    // Specific weekdays (next occurrence)
                    'monday': () => this.getNextWeekday(1),
                    'tuesday': () => this.getNextWeekday(2),
                    'wednesday': () => this.getNextWeekday(3),
                    'thursday': () => this.getNextWeekday(4),
                    'friday': () => this.getNextWeekday(5),
                    'saturday': () => this.getNextWeekday(6),
                    'sunday': () => this.getNextWeekday(0),
                    
                    // Next specific weekdays
                    'next monday': () => this.getNextWeekday(1, true),
                    'next tuesday': () => this.getNextWeekday(2, true),
                    'next wednesday': () => this.getNextWeekday(3, true),
                    'next thursday': () => this.getNextWeekday(4, true),
                    'next friday': () => this.getNextWeekday(5, true),
                    'next saturday': () => this.getNextWeekday(6, true),
                    'next sunday': () => this.getNextWeekday(0, true),
                    
                    // Month-based indicators
                    'next month': () => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return d; },
                    'this month': () => new Date(),
                    'end of month': () => { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d; }
                },
                recurringPatterns: {
                    daily: ['daily', 'every day', 'each day'],
                    weekly: ['weekly', 'every week', 'each week'],
                    monthly: ['monthly', 'every month', 'each month'],
                    weekdays: ['weekdays', 'every weekday', 'monday to friday', 'mon-fri'],
                    weekends: ['weekends', 'every weekend', 'saturday and sunday'],
                    custom: {
                        'every monday': { type: 'weekly', dayOfWeek: 1 },
                        'every tuesday': { type: 'weekly', dayOfWeek: 2 },
                        'every wednesday': { type: 'weekly', dayOfWeek: 3 },
                        'every thursday': { type: 'weekly', dayOfWeek: 4 },
                        'every friday': { type: 'weekly', dayOfWeek: 5 },
                        'every saturday': { type: 'weekly', dayOfWeek: 6 },
                        'every sunday': { type: 'weekly', dayOfWeek: 0 }
                    }
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

    // Helper method for calculating next weekday occurrence
    getNextWeekday(targetDay, forceNext = false) {
        const today = new Date();
        const currentDay = today.getDay();
        let daysAhead = targetDay - currentDay;
        
        // If it's the same day and we don't force next week, return today
        if (daysAhead === 0 && !forceNext) {
            return today;
        }
        
        // If the day has passed this week or we force next week, go to next week
        if (daysAhead <= 0 || forceNext) {
            daysAhead += 7;
        }
        
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysAhead);
        return nextDate;
    }

    // Theme Management
    initializeTheme() {
        // Load saved theme preference or default to light
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        this.bindThemeToggle();
    }

    setTheme(theme) {
        const root = document.documentElement;
        const themeIcon = document.getElementById('theme-icon');
        
        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
            if (themeIcon) {
                themeIcon.className = 'fas fa-sun text-yellow-400';
            }
        } else {
            root.removeAttribute('data-theme');
            if (themeIcon) {
                themeIcon.className = 'fas fa-moon text-gray-700';
            }
        }
        
        // Save preference
        localStorage.setItem('theme', theme);
        this.currentTheme = theme;
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    bindThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
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
            const response = await fetch(this.getAIEndpoint(), {
                method: 'POST',
                headers: this.buildAIHeaders(),
                body: JSON.stringify({
                    model: this.getAIModel(),
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
        let recurring = null;
        
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
        
        // Detect recurring patterns
        const recurringPatterns = this.nlpPatterns.taskCreation.recurringPatterns;
        
        // Check for daily, weekly, monthly patterns
        Object.entries(recurringPatterns).forEach(([type, keywords]) => {
            if (Array.isArray(keywords)) {
                keywords.forEach(keyword => {
                    if (originalMessage.toLowerCase().includes(keyword)) {
                        recurring = { type, interval: 1 };
                        text = text.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '').trim();
                    }
                });
            }
        });
        
        // Check for custom recurring patterns (e.g., "every monday")
        Object.entries(recurringPatterns.custom || {}).forEach(([phrase, config]) => {
            if (originalMessage.toLowerCase().includes(phrase)) {
                recurring = config;
                text = text.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), '').trim();
                
                // Set first occurrence date if it's a weekly recurring task
                if (config.type === 'weekly' && config.dayOfWeek !== undefined && !dueDate) {
                    dueDate = this.getNextWeekday(config.dayOfWeek).toISOString().split('T')[0];
                }
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
        
        return { text, priority, dueDate, category, recurring };
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
            const response = await fetch(this.getAIEndpoint(), {
                method: 'POST',
                headers: this.buildAIHeaders(),
                body: JSON.stringify({
                    model: this.getAIModel(),
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

    startsWithAny(text, keywords) {
        const lowerText = text.toLowerCase().trim();
        return keywords.some(keyword => {
            const lowerKeyword = keyword.toLowerCase();
            // Check if text starts with the keyword followed by whitespace or end of string
            const regex = new RegExp(`^${this.escapeRegExp(lowerKeyword)}(\\s|$)`, 'i');
            return regex.test(lowerText);
        });
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
                        const actionTaken = await this.handleKimiResponse(userMessage, aiResponse);
                        if (actionTaken) {
                            return;
                        }
                        // If the AI responded conversationally without taking action,
                        // fall back to local intent parsing while preserving the reply
                        await this.processLocalAI(userMessage, { skipChatResponse: true });
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
        const normalizeTaskText = (value) => this.sanitizePlainText(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
        let localParsedTasks = [];

        try {
            localParsedTasks = this.parseTasksLocally(userMessage || '').map(task => ({
                textKey: normalizeTaskText(task.text),
                dueDate: this.normalizeDueDate(task.dueDate)
            })).filter(item => item.textKey && item.dueDate);
        } catch (error) {
            console.warn('Local task parsing fallback failed:', error);
            localParsedTasks = [];
        }

        const localTaskDueDateMap = new Map(localParsedTasks.map(item => [item.textKey, item.dueDate]));

        // Handle the AI response based on action type
        switch (parsedResponse.action) {
            case 'add_task':
                if (parsedResponse.tasks && parsedResponse.tasks.length > 0) {
                    const addedTasks = [];

                    parsedResponse.tasks.forEach(taskData => {
                        const taskTextKey = normalizeTaskText(taskData.text);
                        const localDueDate = taskTextKey ? localTaskDueDateMap.get(taskTextKey) : null;
                        if (localDueDate) {
                            taskData.dueDate = localDueDate;
                        }

                        if (taskData.dueDate) {
                            taskData.dueDate = this.normalizeDueDate(taskData.dueDate);
                        }

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
                let deletionResult = null;

                if (Array.isArray(parsedResponse.tasks) && parsedResponse.tasks.length > 0) {
                    for (const taskData of parsedResponse.tasks) {
                        if (taskData.id) {
                            const resultById = this.deleteTaskById(taskData.id, { silent: true });
                            if (resultById && resultById.success) {
                                deletionResult = resultById;
                                break;
                            }
                        }

                        if (!deletionResult && taskData.text) {
                            const fallbackMessage = `delete ${taskData.text}`;
                            const resultByText = this.deleteTaskByName(fallbackMessage);
                            if (resultByText && resultByText.success) {
                                deletionResult = resultByText;
                                break;
                            }
                        }
                    }
                }

                if (!deletionResult) {
                    deletionResult = this.deleteTaskByName(userMessage);
                }

                if (deletionResult && deletionResult.success) {
                    actionTaken = true;
                    parsedResponse.response = this.sanitizeAIResponseText(`🗑️ Deleted "${deletionResult.taskName}" from your tasks.`);
                } else if (deletionResult && deletionResult.message) {
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

        return actionTaken;
    }

    async processLocalAI(userMessage, options = {}) {
        const { skipChatResponse = false } = options;
        // Original local AI logic as fallback with enhanced understanding
        const lowercaseMessage = userMessage.toLowerCase();
        let response = '';
        let actionTaken = false;
        let handled = false;

        const addIntentPhrases = [...this.nlpPatterns.taskCreation.verbs, 'i want to', 'i need to', 'i have to', 'can you add', 'could you add', 'please add'];
        const dueDateChangeVerbs = ['change', 'set', 'update', 'move', 'reschedule', 'adjust'];
        const priorityChangeVerbs = ['set', 'change', 'update', 'adjust', 'make'];

        const wantsDueDateChange = this.containsAny(lowercaseMessage, ['due date', 'deadline']) && this.containsAny(lowercaseMessage, dueDateChangeVerbs);
        if (wantsDueDateChange) {
            const result = this.updateTaskDueDate(userMessage);
            if (result && result.success) {
                response = result.message;
                actionTaken = true;
            } else if (result && result.message) {
                response = result.message;
            } else {
                response = "I couldn't update that due date. Could you include the task name and the new date?";
            }
            handled = true;
        }

        const wantsPriorityChange = !handled && lowercaseMessage.includes('priority') && this.containsAny(lowercaseMessage, priorityChangeVerbs) && !this.containsAny(lowercaseMessage, ['add ', 'add a', 'add the', 'create', 'new task']);
        if (!handled && wantsPriorityChange) {
            const result = this.updateTaskPriority(userMessage);
            if (result && result.success) {
                response = result.message;
                actionTaken = true;
            } else if (result && result.message) {
                response = result.message;
            } else {
                response = "I couldn't update that priority. Could you share the task name and the new priority?";
            }
            handled = true;
        }

        if (!handled && this.containsAny(lowercaseMessage, ['search for', 'search', 'find', 'look for'])) {
            const keywordMatch = userMessage.match(/(?:search|find|look for)\s+(?:tasks?\s+)?(?:for\s+)?(.+)/i);
            const keyword = keywordMatch ? keywordMatch[1].trim().replace(/[.!?]$/, '') : null;
            response = this.searchTasksByKeyword(keyword);
            handled = true;
        }

        if (!handled && (lowercaseMessage.includes('without due date') || lowercaseMessage.includes('no due date') || lowercaseMessage.includes('no deadline'))) {
            response = this.getTasksWithoutDueDate();
            handled = true;
        }

        if (!handled && !this.containsAny(lowercaseMessage, addIntentPhrases) && this.containsAny(lowercaseMessage, ['this weekend', 'weekend'])) {
            response = this.getTasksThisWeekend();
            handled = true;
        }

        if (!handled && !this.containsAny(lowercaseMessage, addIntentPhrases) && this.containsAny(lowercaseMessage, ['next week'])) {
            response = this.getTasksNextWeek();
            handled = true;
        }

        if (!handled) {
            // Enhanced Task Creation with batch processing (including conversational patterns)
            if (this.startsWithAny(lowercaseMessage, addIntentPhrases) || this.containsAny(lowercaseMessage, ['i want to', 'i need to', 'i have to', 'can you add', 'could you add', 'please add'])) {
                const taskResults = await this.enhancedParseTaskFromMessage(userMessage);
                if (taskResults.length > 0) {
                    const newTasks = [];
                    taskResults.forEach(taskResult => {
                        if (!taskResult.dueDate) {
                            const suggestedDate = this.suggestDueDate(taskResult.text);
                            if (suggestedDate) {
                                taskResult.dueDate = suggestedDate;
                            }
                        }

                        const result = this.validateAndAddTask(taskResult, 'ai');
                        if (result.success) {
                            newTasks.push(result.task);
                        }
                    });

                    response = this.formatTaskResponse(newTasks, 'added');
                    if (newTasks.length > 0) {
                        actionTaken = true;
                    }
                }
                handled = true;
            }
            
            // Task Query Patterns with extended coverage
            else if (this.containsAny(lowercaseMessage, ['what', 'show', 'list', 'display', 'view', 'tell me', 'can you show', 'i want to see', 'let me see'])) {
                if (this.containsAny(lowercaseMessage, ['today', 'due today'])) {
                    response = this.getTasksForToday();
                } else if (this.containsAny(lowercaseMessage, ['tomorrow', 'due tomorrow'])) {
                    response = this.getTasksForTomorrow();
                } else if (this.containsAny(lowercaseMessage, ['this weekend', 'weekend'])) {
                    response = this.getTasksThisWeekend();
                } else if (this.containsAny(lowercaseMessage, ['next week'])) {
                    response = this.getTasksNextWeek();
                } else if (this.containsAny(lowercaseMessage, ['this week', 'week', 'upcoming'])) {
                    response = this.getTasksThisWeek();
                } else if (this.containsAny(lowercaseMessage, ['without due date', 'no due date', 'no deadline'])) {
                    response = this.getTasksWithoutDueDate();
                } else if (this.containsAny(lowercaseMessage, ['overdue', 'late'])) {
                    response = this.getOverdueTasks();
                } else if (this.containsAny(lowercaseMessage, ['completed', 'done', 'finished'])) {
                    response = this.getCompletedTasks();
                } else if (this.containsAny(lowercaseMessage, ['high priority', 'important', 'urgent'])) {
                    response = this.getHighPriorityTasks();
                } else {
                    const categoryKeys = Object.keys(this.nlpPatterns?.taskCreation?.taskCategories || {});
                    let matchedCategory = null;
                    for (const category of categoryKeys) {
                        if (this.containsAny(lowercaseMessage, [
                            `${category} task`,
                            `${category} tasks`,
                            `show ${category}`,
                            `show ${category} tasks`,
                            `view ${category} tasks`,
                            `list ${category} tasks`
                        ])) {
                            matchedCategory = category;
                            break;
                        }
                    }

                    if (matchedCategory) {
                        response = this.getTasksByCategory(matchedCategory);
                    } else {
                        response = this.getAllTasksSummary();
                    }
                }
                handled = true;
            }

            // Task completion and other actions
            else if (this.containsAny(lowercaseMessage, ['complete', 'done', 'finished', 'mark as complete', 'check off'])) {
                const completionResult = this.markTaskComplete(userMessage);
                if (completionResult.success) {
                    response = `✅ Great job! I've marked "${completionResult.taskName}" as completed.`;
                    actionTaken = true;
                } else {
                    response = completionResult.message;
                }
                handled = true;
            }
            else if (this.containsAny(lowercaseMessage, ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'])) {
                response = this.getIntelligentGreeting();
                handled = true;
            }
            else if (this.containsAny(lowercaseMessage, ['kimi', 'ai', 'assistant'])) {
                const responses = [
                    "I'm Shani, your intelligent task assistant! What can I help you organize today?",
                    "Hello! I'm here to make managing your tasks easier. What would you like to work on?",
                    "Hi there! Ready to tackle some tasks together? Just tell me what you need!"
                ];
                response = responses[Math.floor(Math.random() * responses.length)];
                handled = true;
            }
        }

        if (!handled) {
            response = "I'm here to help with your tasks! Try saying things like 'add a task', 'show my tasks', or 'what's due today?'";
        }

        if (!skipChatResponse) {
            this.addChatMessage('ai', response);
        }

        if (actionTaken) {
            this.debouncedRender();
        }
    }

    containsAny(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }

    // Convert natural language date phrases into an ISO date string (YYYY-MM-DD)
    parseDatePhrase(datePhrase) {
        if (!datePhrase || typeof datePhrase !== 'string') {
            return null;
        }

        const phrase = datePhrase.trim().toLowerCase();
        if (!phrase) {
            return null;
        }

        const today = new Date();
        const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const addDays = (days) => {
            const result = new Date(baseDate);
            result.setDate(result.getDate() + days);
            return result.toISOString().split('T')[0];
        };

        const simpleOffsets = {
            'today': 0,
            'tonight': 0,
            'tomorrow': 1,
            'tmr': 1,
            'day after tomorrow': 2,
            'in two days': 2,
            'in 2 days': 2,
            'in three days': 3,
            'in 3 days': 3,
            'in a week': 7,
            'next week': 7,
            'in one week': 7
        };

        if (simpleOffsets[phrase] !== undefined) {
            return addDays(simpleOffsets[phrase]);
        }

        if (/^in\s+\d+\s+day/.test(phrase)) {
            const days = parseInt(phrase.match(/\d+/)[0], 10);
            if (!Number.isNaN(days)) {
                return addDays(days);
            }
        }

        if (/^in\s+\d+\s+week/.test(phrase)) {
            const weeks = parseInt(phrase.match(/\d+/)[0], 10);
            if (!Number.isNaN(weeks)) {
                return addDays(weeks * 7);
            }
        }

        const getWeekendDate = (offsetWeeks = 0) => {
            const saturdayOffset = ((6 - baseDate.getDay()) + 7) % 7;
            const saturday = new Date(baseDate);
            saturday.setDate(saturday.getDate() + saturdayOffset + (offsetWeeks * 7));
            return saturday.toISOString().split('T')[0];
        };

        if (phrase === 'this weekend' || phrase === 'weekend') {
            return getWeekendDate(0);
        }

        if (phrase === 'next weekend') {
            return getWeekendDate(1);
        }

        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const weekdayRegex = /^(next|this|upcoming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/;
        const weekdayMatch = phrase.match(weekdayRegex);
        if (weekdayMatch) {
            const modifier = weekdayMatch[1] || '';
            const weekdayName = weekdayMatch[2];
            const targetDay = weekdays.indexOf(weekdayName);
            if (targetDay >= 0) {
                let daysAhead = (targetDay - baseDate.getDay() + 7) % 7;
                if (daysAhead === 0 || modifier === 'next') {
                    daysAhead += 7;
                }
                return addDays(daysAhead);
            }
        }

        const onWeekdayMatch = phrase.match(/^(on\s+)?(next|this|upcoming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
        if (onWeekdayMatch) {
            const modifier = onWeekdayMatch[2] || '';
            const weekdayName = onWeekdayMatch[3];
            const targetDay = weekdays.indexOf(weekdayName);
            if (targetDay >= 0) {
                let daysAhead = (targetDay - baseDate.getDay() + 7) % 7;
                if (modifier === 'next' || daysAhead === 0) {
                    daysAhead += 7;
                }
                return addDays(daysAhead);
            }
        }

        // Support explicit dates such as 2025-01-15 or 15/01/2025
        const isoMatch = phrase.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
        if (isoMatch) {
            return isoMatch[0];
        }

        const localeMatch = phrase.match(/\b(\d{1,2})[\/](\d{1,2})[\/](\d{4})\b/);
        if (localeMatch) {
            const [ , month, day, year ] = localeMatch;
            const parsedDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
            if (!Number.isNaN(parsedDate.getTime())) {
                return parsedDate.toISOString().split('T')[0];
            }
        }

        return null;
    }

    // Map natural language priority words to canonical priority values
    parsePriorityWord(word) {
        if (!word || typeof word !== 'string') {
            return null;
        }

        const normalized = word.trim().toLowerCase();
        if (!normalized) {
            return null;
        }

        const prioritySynonyms = {
            high: ['high', 'urgent', 'critical', 'important', 'asap', 'top', 'highest', 'rush', 'immediate'],
            medium: ['medium', 'normal', 'regular', 'standard', 'default', 'moderate', 'average'],
            low: ['low', 'later', 'someday', 'eventually', 'whenever', 'optional', 'defer', 'minor']
        };

        const cleaned = normalized.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const candidates = new Set([
            cleaned,
            cleaned.replace(/\bpriority\b/g, '').trim(),
            ...cleaned.split(' ')
        ].filter(Boolean));

        for (const candidate of candidates) {
            for (const [priority, synonyms] of Object.entries(prioritySynonyms)) {
                if (synonyms.includes(candidate)) {
                    return priority;
                }
        return greeting;
    }
        }

        return null;
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

    getTasksThisWeekend() {
        const today = new Date();
        const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const day = baseDate.getDay();

        const saturday = new Date(baseDate);
        if (day === 6) {
            // Already Saturday
        } else if (day === 0) {
            saturday.setDate(saturday.getDate() - 1);
        } else {
            saturday.setDate(saturday.getDate() + (6 - day));
        }

        const sunday = new Date(saturday);
        sunday.setDate(saturday.getDate() + 1);

        const weekendDates = new Set([
            saturday.toISOString().split('T')[0],
            sunday.toISOString().split('T')[0]
        ]);

        const weekendTasks = this.tasks.filter(task => task.dueDate && !task.completed && weekendDates.has(task.dueDate));

        if (weekendTasks.length === 0) {
            return '🛋️ You have no tasks scheduled for this weekend.';
        }

        return `🗓️ Weekend tasks (${weekendTasks.length}):\n\n${weekendTasks.map((task, index) => {
            return `${index + 1}. ${task.text} — Due ${this.formatDate(new Date(task.dueDate))} (${task.priority} priority)`;
        }).join('\n')}`;
    }

    getTasksNextWeek() {
        const today = new Date();
        const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const day = baseDate.getDay();
        let daysUntilNextMonday = (8 - day) % 7;
        if (daysUntilNextMonday === 0) {
            daysUntilNextMonday = 7;
        }

        const monday = new Date(baseDate);
        monday.setDate(monday.getDate() + daysUntilNextMonday);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const startISO = monday.toISOString().split('T')[0];
        const endISO = sunday.toISOString().split('T')[0];

        const nextWeekTasks = this.tasks.filter(task => {
            if (!task.dueDate || task.completed) {
                return false;
            }
            return task.dueDate >= startISO && task.dueDate <= endISO;
        });

        if (nextWeekTasks.length === 0) {
            return '📅 You have no tasks scheduled for next week.';
        }

        return `📅 Tasks for next week (${nextWeekTasks.length}):\n\n${nextWeekTasks.map((task, index) => {
            return `${index + 1}. ${task.text} — Due ${this.formatDate(new Date(task.dueDate))} (${task.priority} priority)`;
        }).join('\n')}`;
    }

    getTasksWithoutDueDate() {
        const undatedTasks = this.tasks.filter(task => !task.completed && !task.dueDate);

        if (undatedTasks.length === 0) {
            return '📝 Every pending task already has a due date!';
        }

        return `📝 Tasks without a due date (${undatedTasks.length}):\n\n${undatedTasks.map((task, index) => (
            `${index + 1}. ${task.text} (${task.priority} priority)`
        )).join('\n')}`;
    }

    getTasksByCategory(category) {
        if (!category) {
            return 'Please specify which category you’d like to see (e.g., work, personal, home).';
        }

        const normalizedCategory = category.toLowerCase();
        const matchingTasks = this.tasks.filter(task => !task.completed && (task.category || '').toLowerCase() === normalizedCategory);

        if (matchingTasks.length === 0) {
            return `📂 I couldn't find any pending tasks in the "${category}" category.`;
        }

        return `📂 ${matchingTasks.length} ${matchingTasks.length === 1 ? 'task' : 'tasks'} in "${category}" category:\n\n${matchingTasks.map((task, index) => {
            const dueText = task.dueDate ? ` — Due ${this.formatDate(new Date(task.dueDate))}` : '';
            return `${index + 1}. ${task.text}${dueText} (${task.priority} priority)`;
        }).join('\n')}`;
    }

    searchTasksByKeyword(keyword) {
        if (!keyword) {
            return 'Please tell me which keyword to search for.';
        }

        const normalizedKeyword = keyword.toLowerCase();
        const matchingTasks = this.tasks.filter(task => task.text.toLowerCase().includes(normalizedKeyword));

        if (matchingTasks.length === 0) {
            return `🔍 No tasks contain "${keyword}" right now.`;
        }

        return `🔍 Tasks matching "${keyword}" (${matchingTasks.length}):\n\n${matchingTasks.map((task, index) => {
            const dueText = task.dueDate ? ` — Due ${this.formatDate(new Date(task.dueDate))}` : '';
            const statusText = task.completed ? '✅ Completed' : `${task.priority} priority`;
            return `${index + 1}. ${task.text}${dueText} (${statusText})`;
        }).join('\n')}`;
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
            const { normalized: queryString, tokens: queryTokens, hasTokens } = this.normalizeTextForMatching(taskName);

            const directMatches = this.tasks.filter(t =>
                t.text.toLowerCase().includes(taskName.toLowerCase())
            );

            const scoredMatches = this.tasks.map(task => {
                const { normalized, tokens } = this.normalizeTextForMatching(task.text);
                const tokenSet = new Set(tokens);
                const intersection = hasTokens ? queryTokens.filter(token => tokenSet.has(token)) : [];
                const intersectionCount = intersection.length;
                const ratio = hasTokens && queryTokens.length > 0 ? intersectionCount / queryTokens.length : 0;
                const normalizedIncludes = queryString && normalized.includes(queryString);
                const score = ratio + (normalizedIncludes ? 0.5 : 0);

                return {
                    task,
                    score,
                    intersectionCount,
                    ratio,
                    normalizedIncludes
                };
            }).filter(match => match.score > 0 || match.normalizedIncludes);

            const combinedMatches = [...new Set([...directMatches, ...scoredMatches.map(m => m.task)])];

            const prioritizeMatches = combinedMatches.map(task => {
                const scored = scoredMatches.find(m => m.task.id === task.id);
                const score = scored ? scored.score : (task.text.toLowerCase().includes(taskName.toLowerCase()) ? 1 : 0);
                const intersectionCount = scored ? scored.intersectionCount : 0;
                const ratio = scored ? scored.ratio : 0;

                return {
                    task,
                    score,
                    intersectionCount,
                    ratio
                };
            })
                .filter(entry => entry.score > 0 || entry.intersectionCount > 0)
                .sort((a, b) => b.score - a.score || b.intersectionCount - a.intersectionCount);

            const thresholdMatches = prioritizeMatches.filter(entry =>
                entry.score >= 0.5 || entry.intersectionCount >= 2 || (entry.intersectionCount >= 1 && queryTokens.length <= 3)
            );

            const matchingTasks = thresholdMatches.length > 0
                ? thresholdMatches.map(entry => entry.task)
                : prioritizeMatches.map(entry => entry.task);

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
        taskName = taskName.replace(/\b(?:please|kindly|the|a|an)\b/gi, ' ');
        return taskName.replace(/\s+/g, ' ').trim();
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