// Tasks and reminders management module

// Dependencies: state.js, storage.js, card-core.js

// Check if running in Microsoft Edge
function isMicrosoftEdge() {
    return navigator.userAgent.indexOf('Edg') !== -1;
}

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
    
    // Helper function to update card height and move overlapping cards
    const updateCardHeightAndMoveOverlaps = () => {
        const headerHeight = header ? header.offsetHeight : 40;
        const cardPadding = 38; // 19px top + 19px bottom
        const contentHeight = content.scrollHeight;
        const newHeight = Math.max(143, headerHeight + cardPadding + contentHeight);
        
        const card = State.getCards().find(c => c.id === cardId);
        if (card) {
            // Get current position and dimensions
            const currentX = card.x || 0;
            const currentY = card.y || 0;
            const currentWidth = card.width || getDefaultCardWidth(card.type);
            
            // Update card height first
            cardEl.style.height = newHeight + 'px';
            card.height = newHeight;
            
            // Keep the expanding card in place - move overlapping cards instead
            // This ensures the todo list doesn't jump around when items are added
            moveOverlappingCards(cardId, currentX, currentY, currentWidth, newHeight);
            
            saveCards();
            updateCanvasHeight();
            
            // Fix any overlaps that might have occurred
            setTimeout(() => {
                fixAllOverlaps();
            }, 50);
        }
    };
    
    // Auto-resize function for tasks card
    const autoResizeCard = () => {
        updateCardHeightAndMoveOverlaps();
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
        taskEl.setAttribute('data-task-id', task.id);
        
        // Editable textarea (multi-line) - create first so it can be referenced
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
                // Update only the checkbox and text input, not the entire list
                if (taskToUpdate.completed) {
                    checkbox.classList.add('completed');
                    textInput.classList.add('completed');
                } else {
                    checkbox.classList.remove('completed');
                    textInput.classList.remove('completed');
                }
                // Update card height if needed
                if (cardEl) {
                    requestAnimationFrame(() => {
                        const headerHeight = header ? header.offsetHeight : 40;
                        const cardPadding = 38;
                        const content = cardEl.querySelector('.card-content');
                        const contentHeight = content.scrollHeight;
                        const newHeight = Math.max(143, headerHeight + cardPadding + contentHeight);
                        
                        const card = State.getCards().find(c => c.id === cardId);
                        if (card) {
                            const currentX = card.x || 0;
                            const currentY = card.y || 0;
                            const currentWidth = card.width || getDefaultCardWidth(card.type);
                            
                            cardEl.style.height = newHeight + 'px';
                            card.height = newHeight;
                            
                            // Move overlapping cards instead of moving this card
                            moveOverlappingCards(cardId, currentX, currentY, currentWidth, newHeight);
                            
                            saveCards();
                            updateCanvasHeight();
                            
                            setTimeout(() => {
                                fixAllOverlaps();
                            }, 50);
                        }
                    });
                }
            }
            return false;
        });
        
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
                
                const card = State.getCards().find(c => c.id === cardId);
                if (card) {
                    const currentX = card.x || 0;
                    const currentY = card.y || 0;
                    const currentWidth = card.width || getDefaultCardWidth(card.type);
                    
                    cardEl.style.height = newHeight + 'px';
                    card.height = newHeight;
                    
                    // Move overlapping cards instead of moving this card
                    moveOverlappingCards(cardId, currentX, currentY, currentWidth, newHeight);
                    
                    saveCards();
                    updateCanvasHeight();
                    
                    setTimeout(() => {
                        fixAllOverlaps();
                    }, 50);
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
            // Remove only this task element, not re-render entire list
            taskEl.remove();
            // Update card height after removal
            if (cardEl) {
                requestAnimationFrame(() => {
                    const headerHeight = header ? header.offsetHeight : 40;
                    const cardPadding = 38;
                    const content = cardEl.querySelector('.card-content');
                    const contentHeight = content.scrollHeight;
                    const newHeight = Math.max(143, headerHeight + cardPadding + contentHeight);
                    
                    const card = State.getCards().find(c => c.id === cardId);
                    if (card) {
                        const currentX = card.x || 0;
                        const currentY = card.y || 0;
                        const currentWidth = card.width || getDefaultCardWidth(card.type);
                        
                        cardEl.style.height = newHeight + 'px';
                        card.height = newHeight;
                        
                        // Move overlapping cards instead of moving this card
                        moveOverlappingCards(cardId, currentX, currentY, currentWidth, newHeight);
                        
                        saveCards();
                        updateCanvasHeight();
                        
                        setTimeout(() => {
                            fixAllOverlaps();
                        }, 50);
                    }
                });
            }
            return false;
        });
        
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
            
            const card = State.getCards().find(c => c.id === cardId);
            if (card) {
                const currentX = card.x || 0;
                const currentY = card.y || 0;
                const currentWidth = card.width || getDefaultCardWidth(card.type);
                
                cardEl.style.height = newHeight + 'px';
                card.height = newHeight;
                
                // Move overlapping cards instead of moving this card
                moveOverlappingCards(cardId, currentX, currentY, currentWidth, newHeight);
                
                saveCards();
                updateCanvasHeight();
                
                setTimeout(() => {
                    fixAllOverlaps();
                }, 50);
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

async function authenticateGoogleCalendar() {
    chrome.storage.local.get(['calendarConnected', 'calendarToken'], async (result) => {
        // Check if token exists (no expiration check - tokens refresh automatically)
        if (result.calendarConnected && result.calendarToken) {
            // Already connected with valid token, just refresh the card
            const reminderCards = document.querySelectorAll('[data-type="reminder"]');
            reminderCards.forEach(cardEl => {
                const cardId = cardEl.dataset.id;
                renderReminderCard(cardEl, cardId);
            });
            return;
        }
        
        // Token expired or doesn't exist, get a new one
        if (typeof chrome.identity === 'undefined') {
            alert('Google Calendar authentication requires a valid OAuth client ID. Please check the setup instructions.');
            return;
        }
        
        // Try to get token (will prompt user if needed)
        const token = await getCalendarToken(true);
        
        if (token) {
            // Sync to backend
            const currentUserId = State.getCurrentUserId();
            if (currentUserId) {
                try {
                    await fetch(`${API_URL}/api/tokens/${currentUserId}/calendar`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ token: token })
                    });
                    console.log('✅ Google Calendar token synced to backend');
                } catch (error) {
                    console.error('❌ Failed to sync Google Calendar token:', error);
                }
            }
            // Refresh all reminder cards
            const reminderCards = document.querySelectorAll('[data-type="reminder"]');
            reminderCards.forEach(cardEl => {
                const cardId = cardEl.dataset.id;
                renderReminderCard(cardEl, cardId);
            });
        } else {
            alert('Failed to authenticate with Google Calendar. Please try again.');
            const reminderCards = document.querySelectorAll('[data-type="reminder"]');
            reminderCards.forEach(cardEl => {
                const cardId = cardEl.dataset.id;
                renderReminderCard(cardEl, cardId);
            });
        }
    });
}

async function getCalendarToken(interactive = false, oldToken = null) {
    return new Promise((resolve) => {
        if (typeof chrome.identity === 'undefined') {
            resolve(null);
            return;
        }
        
        const calendarScope = 'https://www.googleapis.com/auth/calendar.readonly';
        
        // If we have an old token, remove it from cache first to force a refresh
        // BUT: Edge doesn't support removeCachedAuthToken, so we'll just clear storage
        const attemptTokenRefresh = () => {
            // Try to get token using Chrome's identity API (handles refresh automatically)
            chrome.identity.getAuthToken({
                interactive: interactive,
                scopes: [calendarScope]
            }, async (token) => {
                if (chrome.runtime.lastError || !token) {
                    const errorMsg = chrome.runtime.lastError?.message || 'Unknown error';
                    console.log(`⚠️ Calendar token fetch failed (${interactive ? 'interactive' : 'silent'}):`, errorMsg);
                    
                    // If silent refresh failed and we haven't tried interactive yet, don't fallback here
                    // The caller will handle trying interactive
                    if (!interactive) {
                        resolve(null);
                        return;
                    }
                    
                    // Only try launchWebAuthFlow if interactive mode failed
                    console.log('⚠️ Calendar token fetch failed, trying launchWebAuthFlow...');
                    const clientId = chrome.runtime.getManifest().oauth2.client_id;
                    const redirectUri = chrome.identity.getRedirectURL();
                    const baseScopes = chrome.runtime.getManifest().oauth2.scopes;
                    const allScopes = [...baseScopes, calendarScope].join(' ');
                    
                    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                        `client_id=${clientId}&` +
                        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                        `response_type=token&` +
                        `scope=${encodeURIComponent(allScopes)}`;
                    
                    chrome.identity.launchWebAuthFlow({
                        url: authUrl,
                        interactive: interactive
                    }, (responseUrl) => {
                        if (chrome.runtime.lastError || !responseUrl) {
                            const errorMsg = chrome.runtime.lastError?.message || 'No response URL';
                            console.error('❌ launchWebAuthFlow failed:', errorMsg);
                            resolve(null);
                            return;
                        }
                        
                        const hashPart = responseUrl.split('#')[1];
                        if (!hashPart) {
                            console.error('❌ No hash part in response URL');
                            resolve(null);
                            return;
                        }
                        
                        const urlParams = new URLSearchParams(hashPart);
                        const token = urlParams.get('access_token');
                        if (token) {
                            console.log('✅ Got new calendar token from launchWebAuthFlow');
                            // Store token - Chrome will handle refresh automatically
                            chrome.storage.local.set({ 
                                calendarToken: token, 
                                calendarConnected: true 
                            });
                            resolve(token);
                        } else {
                            console.error('❌ No access_token in response');
                            resolve(null);
                        }
                    });
                } else {
                    // Check if we got the same token back (which would mean refresh didn't work)
                    if (oldToken && token === oldToken) {
                        console.warn('⚠️ Got same token back after refresh attempt, token may still be invalid');
                        // Still return it, but the API call will fail and trigger another refresh
                    }
                    
                    console.log('✅ Got calendar token from getAuthToken');
                    // Token from getAuthToken - Chrome handles refresh automatically
                    // Store it
                    chrome.storage.local.set({ 
                        calendarToken: token, 
                        calendarConnected: true 
                    });
                    resolve(token);
                }
            });
        };
        
        // Remove old token from cache if provided (for refresh scenarios)
        // BUT: Edge doesn't support removeCachedAuthToken, so skip it for Edge
        if (oldToken) {
            if (isMicrosoftEdge()) {
                // For Edge, just clear the stored token and try to get a new one
                // Edge requires user interaction for token refresh, so we'll need interactive mode
                console.log('🔄 Edge: Clearing stored calendar token (will require user interaction for refresh)...');
                chrome.storage.local.remove(['calendarToken'], () => {
                    // For Edge, we need interactive mode to get a new token
                    // But if caller requested non-interactive, we'll still try (will fail gracefully)
                    attemptTokenRefresh();
                });
            } else {
                // Chrome: Remove from cache
                console.log('🔄 Removing old calendar token from cache...');
                chrome.identity.removeCachedAuthToken({ token: oldToken }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('⚠️ Error removing cached token:', chrome.runtime.lastError.message);
                    }
                    // Wait a bit before attempting refresh to ensure cache is cleared
                    setTimeout(() => {
                        attemptTokenRefresh();
                    }, 100);
                });
            }
        } else {
            attemptTokenRefresh();
        }
    });
}

async function fetchCalendarEvents(token) {
    try {
        // Get today's start and end times
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        
        const timeMin = startOfDay.toISOString();
        const timeMax = endOfDay.toISOString();
        
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${encodeURIComponent(timeMin)}&` +
            `timeMax=${encodeURIComponent(timeMax)}&` +
            `singleEvents=true&` +
            `orderBy=startTime&` +
            `maxResults=50`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // If token expired (401) or unauthorized (403), try to refresh it automatically
        if (response.status === 401 || response.status === 403) {
            console.log(`🔄 Calendar token needs refresh (status: ${response.status}), refreshing automatically...`);
            
            // For Edge, we need to use interactive mode for token refresh
            const isEdge = isMicrosoftEdge();
            if (isEdge) {
                console.log('🔄 Edge detected: Will use interactive mode for token refresh');
                // For Edge, skip silent refresh and go straight to interactive
                const interactiveToken = await getCalendarToken(true, token);
                if (interactiveToken) {
                    console.log('✅ Got new token from interactive refresh (Edge), retrying API call...');
                    const retryResponse = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${interactiveToken}`
                        }
                    });
                    if (!retryResponse.ok) {
                        const errorText = await retryResponse.text().catch(() => 'Unknown error');
                        console.error('❌ Retry failed after token refresh:', retryResponse.status, errorText);
                        throw new Error(`Failed to fetch calendar events after token refresh: ${retryResponse.status}`);
                    }
                    const data = await retryResponse.json();
                    return processCalendarEvents(data);
                } else {
                    console.error('❌ Failed to refresh calendar token in Edge');
                    throw new Error('Failed to refresh calendar token. Please try reconnecting.');
                }
            } else {
                // Chrome: Try silent refresh first, then interactive
                const newToken = await getCalendarToken(false, token); // Try silent refresh first
                if (!newToken) {
                    // Silent refresh failed, try interactive
                    console.log('⚠️ Silent refresh failed, trying interactive refresh...');
                    const interactiveToken = await getCalendarToken(true, token);
                    if (interactiveToken) {
                        console.log('✅ Got new token from interactive refresh, retrying API call...');
                        const retryResponse = await fetch(url, {
                            headers: {
                                'Authorization': `Bearer ${interactiveToken}`
                            }
                        });
                        if (!retryResponse.ok) {
                            const errorText = await retryResponse.text().catch(() => 'Unknown error');
                            console.error('❌ Retry failed after token refresh:', retryResponse.status, errorText);
                            throw new Error(`Failed to fetch calendar events after token refresh: ${retryResponse.status}`);
                        }
                        const data = await retryResponse.json();
                        return processCalendarEvents(data);
                    } else {
                        console.error('❌ Failed to refresh calendar token (both silent and interactive failed)');
                        throw new Error('Failed to refresh calendar token');
                    }
                } else {
                    // Retry with new token from silent refresh
                    console.log('✅ Got new token from silent refresh, retrying API call...');
                    const retryResponse = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${newToken}`
                        }
                    });
                    if (!retryResponse.ok) {
                        const errorText = await retryResponse.text().catch(() => 'Unknown error');
                        console.error('❌ Retry failed after token refresh:', retryResponse.status, errorText);
                        throw new Error(`Failed to fetch calendar events after token refresh: ${retryResponse.status}`);
                    }
                    const data = await retryResponse.json();
                    return processCalendarEvents(data);
                }
            }
        }
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('❌ Calendar API error:', response.status, errorText);
            throw new Error(`Failed to fetch calendar events: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return processCalendarEvents(data);
    } catch (error) {
        console.error('Calendar API error:', error);
        // Re-throw so the UI can show the error message
        throw error;
    }
}

function processCalendarEvents(data) {
    if (!data.items || data.items.length === 0) {
        return [];
    }
    
    return data.items.map(event => {
        const start = event.start.dateTime || event.start.date;
        const end = event.end.dateTime || event.end.date;
        
        return {
            id: event.id,
            summary: event.summary || '(No Title)',
            start: start,
            end: end,
            location: event.location || '',
            description: event.description || '',
            hangoutLink: event.hangoutLink || '',
            htmlLink: event.htmlLink || ''
        };
    });
}

function renderReminderCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    // Check if Google Calendar is connected
    chrome.storage.local.get(['calendarConnected', 'calendarToken'], async (result) => {
        // No expiration check - tokens will be refreshed automatically when needed
        if (!result.calendarConnected || !result.calendarToken) {
            // Show connect button
            content.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px;">
                    <button id="connect-calendar-btn-${cardId}" class="calendar-connect-btn" style="
                        min-width: 79px;
                        height: 43px;
                        border-radius: 12px;
                        gap: 8px;
                        opacity: 1;
                        padding: 12px 16px;
                        background: rgba(22, 22, 22, 0.96);
                        color: white;
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        white-space: nowrap;
                    ">Connect Calendar</button>
                </div>
            `;
            
            const connectBtn = content.querySelector(`#connect-calendar-btn-${cardId}`);
            connectBtn.addEventListener('click', () => {
                // Show loading state
                connectBtn.disabled = true;
                connectBtn.textContent = 'Connecting...';
                connectBtn.style.opacity = '0.7';
                connectBtn.style.cursor = 'not-allowed';
                
                authenticateGoogleCalendar();
            });
        } else {
            // Show loading state first
            content.innerHTML = '<div style="text-align: center; padding: 20px; color: #9b9a97; font-size: 13px;">Loading calendar events...</div>';
            
            // Fetch and display calendar events
            try {
                const events = await fetchCalendarEvents(result.calendarToken);
                
                if (events === null || events === undefined) {
                    throw new Error('Failed to fetch calendar events');
                }
                
                if (events.length === 0) {
                    content.innerHTML = `
                        <div style="color: #9b9a97; text-align: center; padding: 20px; font-size: 13px;">No events scheduled for today</div>
                    `;
                } else {
                    // Get today's date for header
                    const today = new Date();
                    const dayOfMonth = today.getDate();
                    const monthName = today.toLocaleDateString('en-US', { month: 'long' });
                    const year = today.getFullYear();
                    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
                    const monthShort = today.toLocaleDateString('en-US', { month: 'short' });
                    
                    content.innerHTML = `
                        <div id="calendar-header-${cardId}" style="
                            position: sticky;
                            top: 0;
                            backdrop-filter: blur(10px);
                            z-index: 10;
                            padding-bottom: 16px;
                            margin-bottom: 0;
                            padding-top: 0;
                        ">
                            <div style="display: flex; align-items: center; gap: 20px;">
                                <div style="
                                    width: 56px;
                                    border-radius: 12px;
                                    background-color: rgba(17, 25, 254, 0.08);
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    justify-content: center;
                                    padding: 8px 0px;
                                    box-sizing: border-box;
                                    color: #1119fe;
                                    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                ">
                                    <div style="
                                        align-self: stretch;
                                        position: relative;
                                        line-height: 140%;
                                        font-size: 14px;
                                        text-align: center;
                                    ">${monthShort}</div>
                                    <div style="
                                        align-self: stretch;
                                        position: relative;
                                        font-size: 28px;
                                        line-height: 120%;
                                        font-weight: 600;
                                        text-align: center;
                                    ">${dayOfMonth}</div>
                                </div>
                                <div style="
                                    flex: 1;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: flex-start;
                                    gap: 8px;
                                    text-align: left;
                                    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                ">
                                    <div style="
                                        align-self: stretch;
                                        position: relative;
                                        line-height: 120%;
                                        font-weight: 500;
                                        font-size: 19px;
                                        color: rgba(5, 5, 5, 0.88);
                                    ">${monthName}, ${year}</div>
                                    <div style="
                                        align-self: stretch;
                                        position: relative;
                                        font-size: 14px;
                                        line-height: 140%;
                                        color: rgba(5, 5, 5, 0.56);
                                    ">${dayName}</div>
                                </div>
                            </div>
                        </div>
                        <div id="calendar-events-${cardId}" class="calendar-events-scrollable" style="padding-top: 0;"></div>
                    `;
                    
                    const eventsList = content.querySelector(`#calendar-events-${cardId}`);
                    
                    events.forEach(event => {
                        const eventEl = document.createElement('div');
                        eventEl.style.cssText = `
                            width: 100%;
                            position: relative;
                            border-radius: 8px;
                            background-color: rgba(22, 22, 22, 0.08);
                            display: flex;
                            align-items: center;
                            padding: 12px 16px;
                            box-sizing: border-box;
                            gap: 12px;
                            text-align: left;
                            font-size: 14px;
                            color: rgba(5, 5, 5, 0.56);
                            font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                            cursor: pointer;
                            transition: background-color 0.2s;
                            margin-bottom: 8px;
                        `;
                        
                        // Extract meeting URL from description or location
                        const extractMeetingUrl = (text) => {
                            if (!text) return null;
                            // Match URLs (http/https)
                            const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
                            const matches = text.match(urlRegex);
                            if (matches && matches.length > 0) {
                                // Prefer zoom.us, zoom.com, meet.google.com, or other meeting platforms
                                const meetingUrl = matches.find(url => 
                                    url.includes('zoom.us') || 
                                    url.includes('zoom.com') || 
                                    url.includes('meet.google.com') ||
                                    url.includes('teams.microsoft.com') ||
                                    url.includes('webex.com') ||
                                    url.includes('gotomeeting.com') ||
                                    url.includes('bluejeans.com') ||
                                    url.includes('join') ||
                                    url.includes('meeting')
                                );
                                return meetingUrl || matches[0]; // Return first meeting URL found, or first URL if no meeting URL
                            }
                            return null;
                        };
                        
                        // Determine the best link to use
                        let meetingLink = null;
                        // First, try hangoutLink (Google Meet)
                        if (event.hangoutLink) {
                            meetingLink = event.hangoutLink;
                        } 
                        // Then try to extract from description
                        else if (event.description) {
                            meetingLink = extractMeetingUrl(event.description);
                        }
                        // Then try to extract from location (if not found in description)
                        if (!meetingLink && event.location) {
                            meetingLink = extractMeetingUrl(event.location);
                        }
                        // Last resort: htmlLink (Google Calendar page)
                        if (!meetingLink) {
                            meetingLink = event.htmlLink;
                        }
                        
                        // Make clickable
                        eventEl.addEventListener('click', () => {
                            if (meetingLink) {
                                window.open(meetingLink, '_blank');
                            }
                        });
                        eventEl.addEventListener('mouseenter', () => {
                            eventEl.style.backgroundColor = 'rgba(255, 255, 255, 0.96)';
                        });
                        eventEl.addEventListener('mouseleave', () => {
                            eventEl.style.backgroundColor = 'rgba(22, 22, 22, 0.08)';
                        });
                        
                        const startTime = new Date(event.start);
                        const timeStr = startTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        });
                        
                        // Determine meeting type and icon
                        let iconPath = 'assets/regular_call_icon.svg';
                        const description = (event.description || '').toLowerCase();
                        const location = (event.location || '').toLowerCase();
                        const hangoutLink = (event.hangoutLink || '').toLowerCase();
                        const htmlLink = (event.htmlLink || '').toLowerCase();
                        
                        // Check for Google Meet
                        if (hangoutLink.includes('meet.google.com') || 
                            description.includes('meet.google.com') || 
                            description.includes('google meet') || 
                            location.includes('google meet') ||
                            location.includes('meet.google.com')) {
                            iconPath = 'assets/google_meet.svg';
                        } 
                        // Check for Zoom
                        else if (description.includes('zoom.us') || 
                                 location.includes('zoom.us') || 
                                 description.includes('zoom.com') ||
                                 location.includes('zoom.com') ||
                                 (description.includes('zoom') && (description.includes('meeting') || description.includes('join'))) ||
                                 (location.includes('zoom') && (location.includes('meeting') || location.includes('join')))) {
                            iconPath = 'assets/zoom.svg';
                        }
                        
                        // Create icon
                        const icon = document.createElement('img');
                        icon.src = chrome.runtime.getURL(iconPath);
                        icon.style.cssText = 'width: 20px; position: relative; max-height: 100%; object-fit: cover;';
                        icon.alt = 'Meeting icon';
                        icon.className = 'image-1-icon';
                        eventEl.appendChild(icon);
                        
                        // Event text - "10:30AM - Meeting Name" format
                        const eventText = document.createElement('div');
                        eventText.style.cssText = 'flex: 1; position: relative; line-height: 140%;';
                        eventText.className = 'am-meeting';
                        eventText.textContent = `${timeStr} - ${event.summary}`;
                        eventEl.appendChild(eventText);
                        
                        // Red dot - CSS circle instead of image
                        const redDot = document.createElement('div');
                        redDot.style.cssText = `
                            height: 9px;
                            width: 9px;
                            position: relative;
                            border-radius: 50%;
                            background-color:rgb(237, 32, 32);
                            box-sizing: border-box;
                            flex-shrink: 0;
                        `;
                        redDot.className = 'gg-child';
                        eventEl.appendChild(redDot);
                        
                        eventsList.appendChild(eventEl);
                    });
                }
            } catch (error) {
                console.error('Error fetching calendar events:', error);
                content.innerHTML = `
                    <div style="color: #d93025; font-size: 13px; margin-bottom: 12px;">Failed to load calendar events. Please try reconnecting.</div>
                    <button class="calendar-connect-btn" style="
                        min-width: 79px;
                        height: 43px;
                        border-radius: 12px;
                        padding: 12px 16px;
                        background: rgba(22, 22, 22, 0.96);
                        color: white;
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        white-space: nowrap;
                    ">Reconnect</button>
                `;
                const reconnectBtn = content.querySelector('.calendar-connect-btn');
                reconnectBtn.addEventListener('click', async () => {
                    const currentUserId = State.getCurrentUserId();
                    if (currentUserId) {
                        try {
                            await fetch(`${API_URL}/api/tokens/${currentUserId}/calendar`, {
                                method: 'DELETE'
                            });
                            console.log('✅ Calendar token deleted from backend');
                        } catch (error) {
                            console.error('❌ Failed to delete calendar token:', error);
                        }
                    }
                    chrome.storage.local.remove(['calendarToken', 'calendarConnected'], () => {
                        renderReminderCard(cardEl, cardId);
                    });
                });
                return;
            }
        }
    });
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
        showReminderBanner,
        authenticateGoogleCalendar,
        fetchCalendarEvents
    };
}

