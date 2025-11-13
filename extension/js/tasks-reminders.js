// Tasks and reminders management module

// Dependencies: state.js, storage.js, card-core.js

function createTasksCard() {
    createCard('tasks', { content: '' });
}

function renderTasksCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    const header = cardEl.querySelector('.card-header');
    
    // Check if this is a new card (no tasks exist)
    const tasks = State.getTasks();
    const isNewCard = tasks.length === 0;
    
    // If new card, create an initial empty task
    if (isNewCard) {
        const initialTask = {
            id: Date.now().toString(),
            text: '',
            dueDate: null,
            completed: false,
            createdAt: new Date().toISOString()
        };
        State.setTasks([initialTask]);
        saveTasks();
    }
    
    content.innerHTML = `
        <div id="tasks-list-${cardId}"></div>
        <div class="todo-hint">Press Enter to create new task</div>
    `;
    
    const tasksList = content.querySelector(`#tasks-list-${cardId}`);
    
    // Auto-resize function for tasks card
    const autoResizeCard = () => {
        const headerHeight = header ? header.offsetHeight : 40;
        const cardPadding = 38; // 19px top + 19px bottom
        const contentHeight = content.scrollHeight;
        const newHeight = Math.max(143, headerHeight + cardPadding + contentHeight);
        
        cardEl.style.height = newHeight + 'px';
        const card = State.getCards().find(c => c.id === cardId);
        if (card) {
            card.height = newHeight;
            saveCards();
            updateCanvasHeight();
        }
    };
    
    renderTasksList(tasksList, cardEl, cardId);
    // Initial resize
    setTimeout(() => {
        autoResizeCard();
    }, 0);
}

function renderTasksList(container, cardEl, cardId) {
    const tasks = State.getTasks();
    const header = cardEl ? cardEl.querySelector('.card-header') : null;
    
    container.innerHTML = '';
    
    tasks.forEach((task, index) => {
        const taskEl = document.createElement('div');
        taskEl.className = 'todo-item';
        
        // Circular checkbox - always unchecked by default for new tasks
        const checkbox = document.createElement('div');
        checkbox.className = 'todo-checkbox';
        if (task.completed) {
            checkbox.classList.add('completed');
        }
        checkbox.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
        
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const tasks = State.getTasks();
            const taskToUpdate = tasks.find(t => t.id === task.id);
            if (taskToUpdate) {
                taskToUpdate.completed = !taskToUpdate.completed;
                State.setTasks(tasks);
                saveTasks();
                renderTasksList(container, cardEl, cardId);
            }
            return false;
        });
        
        // Editable textarea (multi-line)
        const textInput = document.createElement('textarea');
        textInput.className = 'todo-text';
        textInput.value = task.text;
        textInput.rows = 1;
        textInput.style.margin = '0';
        textInput.style.padding = '0';
        textInput.placeholder = '';
        if (task.completed) {
            textInput.classList.add('completed');
        }
        
        // Auto-resize textarea
        const autoResizeTextarea = () => {
            // Reset to get accurate scrollHeight - use a minimal height
            textInput.style.height = 'auto';
            textInput.style.minHeight = '0';
            // Force reflow
            void textInput.offsetHeight;
            // Get the actual content height
            const scrollHeight = textInput.scrollHeight;
            // Only set height if there's content, otherwise use minimal height
            if (scrollHeight > 0) {
                textInput.style.height = scrollHeight + 'px';
            } else {
                // For empty textarea, use line-height based height
                const computedStyle = window.getComputedStyle(textInput);
                const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
                textInput.style.height = lineHeight + 'px';
            }
            if (cardEl) {
                const headerHeight = header ? header.offsetHeight : 40;
                const cardPadding = 38;
                const content = cardEl.querySelector('.card-content');
                const contentHeight = content.scrollHeight;
                const newHeight = Math.max(143, headerHeight + cardPadding + contentHeight);
                cardEl.style.height = newHeight + 'px';
                const card = State.getCards().find(c => c.id === cardId);
                if (card) {
                    card.height = newHeight;
                    saveCards();
                    updateCanvasHeight();
                }
            }
        };
        
        textInput.addEventListener('input', () => {
            const tasks = State.getTasks();
            const taskToUpdate = tasks.find(t => t.id === task.id);
            if (taskToUpdate) {
                taskToUpdate.text = textInput.value;
                saveTasks();
            }
            // Update delete button visibility for first row
            const isEmpty = !textInput.value || textInput.value.trim() === '';
            const isFirstRow = index === 0;
            if (isFirstRow && isEmpty) {
                deleteBtn.style.display = 'none';
            } else {
                deleteBtn.style.display = '';
            }
            autoResizeTextarea();
        });
        
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textInput.blur();
                // Create new task below with checkbox and placeholder
                const tasks = State.getTasks();
                const currentIndex = tasks.findIndex(t => t.id === task.id);
                const newTask = {
                    id: Date.now().toString(),
                    text: '',
                    dueDate: null,
                    completed: false,
                    createdAt: new Date().toISOString()
                };
                tasks.splice(currentIndex + 1, 0, newTask);
                State.setTasks(tasks);
                saveTasks();
                renderTasksList(container, cardEl, cardId);
                // Focus the new task input
                setTimeout(() => {
                    const newTaskEl = container.querySelector(`[data-task-id="${newTask.id}"]`);
                    if (newTaskEl) {
                        const newInput = newTaskEl.querySelector('.todo-text');
                        if (newInput) {
                            newInput.placeholder = '';
                            newInput.focus();
                        }
                    }
                }, 0);
            } else if (e.key === 'Escape') {
                textInput.blur();
            }
        });
        
        // Initial resize
        setTimeout(() => {
            autoResizeTextarea();
        }, 0);
        
        // Delete button (well-designed dustbin icon) - shows on hover
        // Hide delete button if it's the first row and empty
        const isFirstRow = index === 0;
        const isEmpty = !task.text || task.text.trim() === '';
        const shouldHideDelete = isFirstRow && isEmpty;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'todo-delete-btn';
        if (shouldHideDelete) {
            deleteBtn.style.display = 'none';
        }
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 11V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 11V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        deleteBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const tasks = State.getTasks();
            const filteredTasks = tasks.filter(t => t.id !== task.id);
            State.setTasks(filteredTasks);
            saveTasks();
            renderTasksList(container, cardEl, cardId);
            return false;
        });
        
        taskEl.setAttribute('data-task-id', task.id);
        taskEl.appendChild(checkbox);
        taskEl.appendChild(textInput);
        taskEl.appendChild(deleteBtn);
        
        container.appendChild(taskEl);
    });
    
    // Resize card after rendering
    if (cardEl) {
        setTimeout(() => {
            const headerHeight = header ? header.offsetHeight : 40;
            const cardPadding = 38;
            const content = cardEl.querySelector('.card-content');
            const contentHeight = content.scrollHeight;
            const newHeight = Math.max(143, headerHeight + cardPadding + contentHeight);
            cardEl.style.height = newHeight + 'px';
            const card = State.getCards().find(c => c.id === cardId);
            if (card) {
                card.height = newHeight;
                saveCards();
                updateCanvasHeight();
            }
        }, 0);
    }
}

function loadTasks() {
    chrome.storage.local.get(['tasks'], (result) => {
        State.setTasks(result.tasks || []);
    });
}

function saveTasks() {
    chrome.storage.local.set({ tasks: State.getTasks() });
    debouncedSync();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    
    if (dateObj.getTime() === today.getTime()) {
        return 'Today';
    } else if (dateObj.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

function createReminderCard() {
    createCard('reminder', { content: '' });
}

function renderReminderCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = `
        <div style="margin-bottom: 12px;">
            <input type="text" id="reminder-text-${cardId}" placeholder="Reminder text..." style="width: 100%; border: 1px solid #e3e2e0; border-radius: 6px; padding: 8px; font-family: inherit; font-size: 14px; margin-bottom: 8px;" />
            <input type="date" id="reminder-date-${cardId}" style="width: 100%; border: 1px solid #e3e2e0; border-radius: 6px; padding: 8px; font-family: inherit; font-size: 14px; margin-bottom: 8px;" />
            <input type="time" id="reminder-time-${cardId}" style="width: 100%; border: 1px solid #e3e2e0; border-radius: 6px; padding: 8px; font-family: inherit; font-size: 14px; margin-bottom: 8px;" />
            <button class="connect-btn" id="add-reminder-${cardId}">Add Reminder</button>
        </div>
        <div id="reminders-list-${cardId}" style="max-height: 300px; overflow-y: auto;"></div>
    `;
    
    const textInput = content.querySelector(`#reminder-text-${cardId}`);
    const dateInput = content.querySelector(`#reminder-date-${cardId}`);
    const timeInput = content.querySelector(`#reminder-time-${cardId}`);
    const addBtn = content.querySelector(`#add-reminder-${cardId}`);
    const remindersList = content.querySelector(`#reminders-list-${cardId}`);
    
    const addReminder = () => {
        const text = textInput.value.trim();
        const date = dateInput.value;
        const time = timeInput.value;
        
        if (!text || !date || !time) {
            alert('Please fill in all fields');
            return;
        }
        
        const reminderDateTime = new Date(`${date}T${time}`);
        
        if (reminderDateTime <= new Date()) {
            alert('Reminder time must be in the future');
            return;
        }
        
        const reminder = {
            id: Date.now().toString(),
            text: text,
            dateTime: reminderDateTime.toISOString(),
            triggered: false,
            createdAt: new Date().toISOString()
        };
        
        const reminders = State.getReminders();
        reminders.push(reminder);
        State.setReminders(reminders);
        saveReminders();
        renderRemindersList(remindersList);
        
        textInput.value = '';
        dateInput.value = '';
        timeInput.value = '';
    };
    
    addBtn.addEventListener('click', addReminder);
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addReminder();
        }
    });
    
    renderRemindersList(remindersList);
}

function renderRemindersList(container) {
    const reminders = State.getReminders();
    const activeReminders = reminders.filter(r => !r.triggered);
    
    if (activeReminders.length === 0) {
        container.innerHTML = '<div style="color: #9b9a97; text-align: center; padding: 20px; font-size: 13px;">No active reminders</div>';
        return;
    }
    
    container.innerHTML = '';
    
    activeReminders.forEach(reminder => {
        const reminderEl = document.createElement('div');
        reminderEl.style.cssText = 'display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 6px; margin-bottom: 6px; background: #f7f6f3;';
        
        const details = document.createElement('div');
        details.style.cssText = 'flex: 1;';
        
        const text = document.createElement('div');
        text.style.cssText = 'font-size: 14px; color: #37352f; margin-bottom: 4px; font-weight: 500;';
        text.textContent = reminder.text;
        details.appendChild(text);
        
        const dateTime = document.createElement('div');
        const dt = new Date(reminder.dateTime);
        dateTime.style.cssText = 'font-size: 12px; color: #9b9a97;';
        dateTime.textContent = dt.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        details.appendChild(dateTime);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.style.cssText = 'background: transparent; border: none; color: #9b9a97; cursor: pointer; font-size: 18px; padding: 0 4px; flex-shrink: 0;';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
            const reminders = State.getReminders();
            State.setReminders(reminders.filter(r => r.id !== reminder.id));
            saveReminders();
            renderRemindersList(container);
        });
        
        reminderEl.appendChild(details);
        reminderEl.appendChild(deleteBtn);
        
        container.appendChild(reminderEl);
    });
}

function loadReminders() {
    chrome.storage.local.get(['reminders'], (result) => {
        State.setReminders(result.reminders || []);
    });
}

function saveReminders() {
    chrome.storage.local.set({ reminders: State.getReminders() });
    debouncedSync();
}

function startReminderChecker() {
    const reminderCheckInterval = State.getReminderCheckInterval();
    if (reminderCheckInterval) {
        clearInterval(reminderCheckInterval);
    }
    
    const newInterval = setInterval(() => {
        const now = new Date();
        const reminders = State.getReminders();
        
        reminders.forEach(reminder => {
            if (!reminder.triggered) {
                const reminderTime = new Date(reminder.dateTime);
                
                if (now >= reminderTime) {
                    reminder.triggered = true;
                    saveReminders();
                    showReminderBanner(reminder);
                    
                    document.querySelectorAll('[id^="reminders-list-"]').forEach(list => {
                        renderRemindersList(list);
                    });
                }
            }
        });
    }, 1000);
    State.setReminderCheckInterval(newInterval);
}

function showReminderBanner(reminder) {
    const bannersContainer = document.getElementById('reminderBanners');
    
    const banner = document.createElement('div');
    banner.className = 'reminder-banner';
    banner.dataset.reminderId = reminder.id;
    
    const content = document.createElement('div');
    content.className = 'reminder-banner-content';
    content.textContent = reminder.text;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'reminder-banner-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
        banner.remove();
    });
    
    banner.appendChild(content);
    banner.appendChild(closeBtn);
    
    bannersContainer.appendChild(banner);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createTasksCard,
        renderTasksCard,
        renderTasksList,
        loadTasks,
        saveTasks,
        formatDate,
        createReminderCard,
        renderReminderCard,
        renderRemindersList,
        loadReminders,
        saveReminders,
        startReminderChecker,
        showReminderBanner
    };
}

