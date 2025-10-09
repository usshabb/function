let cards = [];
let draggedCard = null;
let offset = { x: 0, y: 0 };
let tasks = [];
let reminders = [];
let reminderCheckInterval = null;

const API_URL = 'http://localhost:3000';

let syncTimeout = null;
let currentUserId = null;

// Logging system
const Logger = {
    isDev: window.location.href.includes('localhost') || window.location.protocol === 'chrome-extension:',
    
    debug: function(message, data = null) {
        if (this.isDev) {
            console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, data || '');
        }
    },
    
    info: function(message, data = null) {
        if (this.isDev) {
            console.info(`[INFO] ${new Date().toISOString()}: ${message}`, data || '');
        }
    },
    
    warn: function(message, data = null) {
        console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data || '');
    },
    
    error: function(message, error = null) {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '');
    },
    
    auth: function(message, data = null) {
        if (this.isDev) {
            console.log(`[AUTH] ${new Date().toISOString()}: ${message}`, data || '');
        }
    },
    
    api: function(message, data = null) {
        if (this.isDev) {
            console.log(`[API] ${new Date().toISOString()}: ${message}`, data || '');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Logger.debug('Application started, initializing...');
    
    loadCards();
    loadTasks();
    loadReminders();
    startReminderChecker();
    checkAuthStatus();
    
    // Show login UI by default, hide navigation
    showLoginInterface();
    
    document.getElementById('addNote').addEventListener('click', () => createCard('note'));
    document.getElementById('addLink').addEventListener('click', () => createCard('link'));
    document.getElementById('addApp').addEventListener('click', openAppModal);
    document.getElementById('closeModal').addEventListener('click', closeAppModal);
    document.getElementById('signInBtn').addEventListener('click', signInWithGoogle);
    document.getElementById('signOutBtn').addEventListener('click', signOutFromGoogle);
    
    document.querySelectorAll('.app-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const appType = e.currentTarget.dataset.app;
            handleAppSelection(appType);
        });
    });
    
    document.getElementById('appModal').addEventListener('click', (e) => {
        if (e.target.id === 'appModal') {
            closeAppModal();
        }
    });
    
    Logger.debug('Application initialization completed');
});

// UI control functions for authentication state
function showLoginInterface() {
    Logger.debug('Showing login interface, hiding navigation');

    // Hide the entire toolbar
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        toolbar.style.display = 'none';
    }

    // Hide any existing cards/content that requires auth
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.display = 'none';
    }

    // Show a login prompt in the center
    showLoginPrompt();
}

function showAuthenticatedInterface() {
    Logger.debug('Showing authenticated interface, showing navigation');

    // Show the entire toolbar
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        toolbar.style.display = 'flex';
    }

    // Show navigation buttons
    const toolbarLeft = document.querySelector('.toolbar-left');
    if (toolbarLeft) {
        toolbarLeft.style.display = 'flex';
    }

    // Show canvas for content
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.display = 'block';
    }

    // Hide login prompt
    hideLoginPrompt();
}

function showLoginPrompt() {
    // Remove existing login prompt
    const existingPrompt = document.getElementById('loginPrompt');
    if (existingPrompt) {
        existingPrompt.remove();
    }
    
    // Create login prompt
    const loginPrompt = document.createElement('div');
    loginPrompt.id = 'loginPrompt';
    loginPrompt.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        z-index: 1000;
    `;
    
    loginPrompt.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px;">
            <h1 style="margin: 0 0 20px 0; color: #37352f; font-size: 28px; font-weight: 600;">Welcome to Function</h1>
            <p style="margin: 0 0 30px 0; color: #9b9a97; font-size: 16px;">Sign in with Google to start using your personalized dashboard with notes, apps, and more.</p>
            <button id="centerSignInBtn" style="
                background: #2383e2;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                font-weight: 500;
                transition: background 0.2s;
            " onmouseover="this.style.background='#1c6ec7'" onmouseout="this.style.background='#2383e2'">
                Sign in with Google
            </button>
        </div>
    `;
    
    document.body.appendChild(loginPrompt);
    
    // Add click handler
    document.getElementById('centerSignInBtn').addEventListener('click', signInWithGoogle);
}

function hideLoginPrompt() {
    const loginPrompt = document.getElementById('loginPrompt');
    if (loginPrompt) {
        loginPrompt.remove();
    }
}

function updateCanvasHeight() {
    const canvas = document.getElementById('canvas');
    if (cards.length === 0) {
        canvas.style.minHeight = '100vh';
        return;
    }
    
    let maxBottom = window.innerHeight;
    cards.forEach(card => {
        const cardEl = document.querySelector(`[data-id="${card.id}"]`);
        if (cardEl) {
            const cardHeight = cardEl.offsetHeight;
            const cardBottom = card.y + cardHeight + 100;
            maxBottom = Math.max(maxBottom, cardBottom);
        }
    });
    
    canvas.style.minHeight = maxBottom + 'px';
}

function createCard(type, data = {}) {
    Logger.debug(`Creating ${type} card`, { id: Date.now().toString() });
    
    const card = {
        id: Date.now().toString(),
        type: type,
        x: data.x || window.innerWidth / 2 - 125,
        y: data.y || window.innerHeight / 2 - 50,
        content: data.content || ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
    
    Logger.debug(`${type} card created successfully`, { totalCards: cards.length });
}

function renderCard(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;
    cardEl.style.left = card.x + 'px';
    cardEl.style.top = card.y + 'px';
    
    const header = document.createElement('div');
    header.className = 'card-header';
    
    const type = document.createElement('div');
    type.className = 'card-type';
    type.textContent = card.type;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCard(card.id);
    });
    
    header.appendChild(type);
    header.appendChild(deleteBtn);
    cardEl.appendChild(header);
    
    const content = document.createElement('div');
    content.className = 'card-content';
    
    if (card.type === 'note') {
        const textarea = document.createElement('textarea');
        textarea.value = card.content;
        textarea.placeholder = 'Start typing...';
        textarea.addEventListener('input', (e) => {
            updateCardContent(card.id, e.target.value);
        });
        content.appendChild(textarea);
    } else if (card.type === 'link') {
        if (card.content) {
            try {
                const linkData = JSON.parse(card.content);
                const title = document.createElement('div');
                title.className = 'link-title';
                title.textContent = linkData.title || 'Link';
                
                const url = document.createElement('a');
                url.className = 'link-url';
                url.href = linkData.url;
                url.textContent = linkData.url;
                url.target = '_blank';
                
                content.appendChild(title);
                content.appendChild(url);
            } catch (e) {
                renderLinkInput(content, card.id);
            }
        } else {
            renderLinkInput(content, card.id);
        }
    } else if (card.type === 'mercury') {
        cardEl.style.minWidth = '350px';
        cardEl.style.maxWidth = '350px';
    } else if (card.type === 'chatgpt') {
        cardEl.style.cursor = 'default';
    } else if (card.type === 'google') {
        cardEl.style.cursor = 'default';
    } else if (card.type === 'gmail') {
        cardEl.style.minWidth = '400px';
        cardEl.style.maxWidth = '400px';
    } else if (card.type === 'tasks') {
        cardEl.style.minWidth = '350px';
        cardEl.style.maxWidth = '350px';
        cardEl.style.cursor = 'default';
    } else if (card.type === 'reminder') {
        cardEl.style.minWidth = '350px';
        cardEl.style.maxWidth = '350px';
        cardEl.style.cursor = 'default';
    } else if (card.type === 'ssense') {
        cardEl.style.minWidth = '500px';
        cardEl.style.maxWidth = '500px';
        cardEl.style.cursor = 'default';
    } else if (card.type === 'weather') {
        cardEl.style.minWidth = '300px';
        cardEl.style.maxWidth = '300px';
        cardEl.style.cursor = 'default';
    } else if (card.type === 'history') {
        cardEl.style.minWidth = '350px';
        cardEl.style.maxWidth = '350px';
        cardEl.style.cursor = 'default';
    } else if (card.type === 'rss') {
        cardEl.style.minWidth = '450px';
        cardEl.style.maxWidth = '450px';
        cardEl.style.cursor = 'default';
    }
    
    cardEl.appendChild(content);
    
    cardEl.addEventListener('mousedown', startDrag);
    
    document.getElementById('canvas').appendChild(cardEl);
    
    if (card.type === 'mercury') {
        renderMercuryCard(cardEl, card.id);
    } else if (card.type === 'chatgpt') {
        renderChatGPTCard(cardEl, card.id);
    } else if (card.type === 'google') {
        renderGoogleSearchCard(cardEl, card.id);
    } else if (card.type === 'gmail') {
        renderGmailCard(cardEl, card.id);
    } else if (card.type === 'tasks') {
        renderTasksCard(cardEl, card.id);
    } else if (card.type === 'reminder') {
        renderReminderCard(cardEl, card.id);
    } else if (card.type === 'ssense') {
        renderSSENSECard(cardEl, card.id);
    } else if (card.type === 'weather') {
        renderWeatherCard(cardEl, card.id);
    } else if (card.type === 'history') {
        renderHistoryCard(cardEl, card.id);
    } else if (card.type === 'rss') {
        renderRssCard(cardEl, card.id);
    }
    
    updateCanvasHeight();
}

function renderLinkInput(container, cardId) {
    const urlInput = document.createElement('input');
    urlInput.className = 'link-input';
    urlInput.type = 'url';
    urlInput.placeholder = 'Paste link URL...';
    
    const titleInput = document.createElement('input');
    titleInput.className = 'link-input';
    titleInput.placeholder = 'Link title (optional)';
    
    const saveLink = () => {
        const url = urlInput.value.trim();
        if (url) {
            const linkData = {
                url: url,
                title: titleInput.value.trim() || new URL(url).hostname
            };
            updateCardContent(cardId, JSON.stringify(linkData));
            reloadCard(cardId);
        }
    };
    
    urlInput.addEventListener('blur', saveLink);
    titleInput.addEventListener('blur', saveLink);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            titleInput.focus();
        }
    });
    titleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveLink();
        }
    });
    
    container.appendChild(urlInput);
    container.appendChild(titleInput);
    urlInput.focus();
}

function reloadCard(cardId) {
    const cardEl = document.querySelector(`[data-id="${cardId}"]`);
    const card = cards.find(c => c.id === cardId);
    if (cardEl && card) {
        cardEl.remove();
        renderCard(card);
    }
}

function startDrag(e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
        return;
    }
    
    draggedCard = e.currentTarget;
    const rect = draggedCard.getBoundingClientRect();
    offset.x = e.clientX - rect.left;
    offset.y = e.clientY - rect.top;
    
    draggedCard.classList.add('dragging');
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function drag(e) {
    if (!draggedCard) return;
    
    const x = e.clientX - offset.x;
    const y = e.clientY - offset.y;
    
    draggedCard.style.left = x + 'px';
    draggedCard.style.top = y + 'px';
}

function stopDrag() {
    if (!draggedCard) return;
    
    draggedCard.classList.remove('dragging');
    
    const cardId = draggedCard.dataset.id;
    const card = cards.find(c => c.id === cardId);
    if (card) {
        card.x = parseInt(draggedCard.style.left);
        card.y = parseInt(draggedCard.style.top);
        saveCards();
        updateCanvasHeight();
    }
    
    draggedCard = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

function updateCardContent(cardId, content) {
    const card = cards.find(c => c.id === cardId);
    if (card) {
        card.content = content;
        saveCards();
    }
}

function deleteCard(cardId) {
    cards = cards.filter(c => c.id !== cardId);
    const cardEl = document.querySelector(`[data-id="${cardId}"]`);
    if (cardEl) {
        cardEl.remove();
    }
    saveCards();
    updateCanvasHeight();
}

function saveCards() {
    Logger.debug('Saving cards to local storage', { cardCount: cards.length });
    chrome.storage.local.set({ cards: cards });
    debouncedSync();
}

function loadCards() {
    Logger.debug('Loading cards from local storage');
    
    chrome.storage.local.get(['cards'], (result) => {
        if (result.cards) {
            cards = result.cards;
            Logger.debug('Cards loaded from storage', { cardCount: cards.length });
            
            let needsSave = false;
            cards.forEach(card => {
                if (card.type === 'mercury' && card.content) {
                    try {
                        const oldData = JSON.parse(card.content);
                        if (oldData.token) {
                            Logger.debug('Removing legacy token from mercury card', { cardId: card.id });
                            card.content = '';
                            needsSave = true;
                        }
                    } catch (e) {
                        Logger.debug('Error parsing mercury card content', e);
                    }
                }
            });
            
            if (needsSave) {
                Logger.debug('Saving cards after token cleanup');
                saveCards();
            }
            
            cards.forEach(card => renderCard(card));
            updateCanvasHeight();
        } else {
            Logger.debug('No cards found in storage');
        }
    });
}

function debouncedSync() {
    if (!currentUserId) return;
    
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }
    
    syncTimeout = setTimeout(() => {
        syncStateToBackend();
    }, 2000);
}

async function syncStateToBackend() {
    if (!currentUserId) {
        Logger.debug('Skipping sync - no user ID');
        return;
    }
    
    try {
        Logger.api('Starting state sync to backend', { userId: currentUserId });
        showSyncStatus('saving');
        
        const state = {
            cards: cards,
            tasks: tasks,
            reminders: reminders,
            starredSites: await getStarredSites(),
            rssFeeds: await getAllRssFeeds()
        };
        
        Logger.api('State prepared for sync', { 
            cardCount: cards.length, 
            taskCount: tasks.length, 
            reminderCount: reminders.length 
        });
        
        const response = await fetch(`${API_URL}/api/state/${currentUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ state })
        });
        
        if (response.ok) {
            Logger.api('State synced successfully');
            showSyncStatus('saved');
        } else {
            Logger.error('Sync failed', { status: response.status });
            showSyncStatus('error');
        }
    } catch (error) {
        Logger.error('Sync error', error);
        showSyncStatus('error');
    }
}

async function loadStateFromBackend() {
    if (!currentUserId) {
        Logger.debug('Skipping state load - no user ID');
        return;
    }

    try {
        Logger.api('Loading state from backend', { userId: currentUserId });
        const response = await fetch(`${API_URL}/api/state/${currentUserId}`);
        const data = await response.json();

        if (data.state && Object.keys(data.state).length > 0) {
            Logger.api('State loaded from backend', { hasData: true });

            if (data.state.cards) {
                Logger.debug('Restoring cards from backend', { count: data.state.cards.length });
                cards = data.state.cards;
                chrome.storage.local.set({ cards: cards });
                document.getElementById('canvas').innerHTML = '';
                cards.forEach(card => renderCard(card));
                updateCanvasHeight();
            }

            if (data.state.tasks) {
                Logger.debug('Restoring tasks from backend', { count: data.state.tasks.length });
                tasks = data.state.tasks;
                chrome.storage.local.set({ tasks: tasks });
            }

            if (data.state.reminders) {
                Logger.debug('Restoring reminders from backend', { count: data.state.reminders.length });
                reminders = data.state.reminders;
                chrome.storage.local.set({ reminders: reminders });
            }

            if (data.state.starredSites) {
                Logger.debug('Restoring starred sites from backend');
                chrome.storage.local.set({ starredSites: data.state.starredSites });
            }

            if (data.state.rssFeeds) {
                Logger.debug('Restoring RSS feeds from backend');
                for (const [cardId, feeds] of Object.entries(data.state.rssFeeds)) {
                    chrome.storage.local.set({ [`rssFeeds_${cardId}`]: feeds });
                }
            }
        } else {
            Logger.api('No state data found on backend');
        }

        // Load Mercury token from database
        await loadMercuryTokenFromBackend();
    } catch (error) {
        Logger.error('Load state error', error);
    }
}

async function loadMercuryTokenFromBackend() {
    if (!currentUserId) {
        return;
    }

    try {
        Logger.api('Loading Mercury token from backend', { userId: currentUserId });
        const response = await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`);
        const data = await response.json();

        if (data.token) {
            Logger.debug('Mercury token found, restoring to local storage');
            chrome.storage.local.set({
                mercuryToken: data.token,
                mercuryConnected: true
            });
        } else {
            Logger.debug('No Mercury token found in database');
        }
    } catch (error) {
        Logger.error('Error loading Mercury token from backend', error);
    }
}

async function createOrUpdateUser(userInfo) {
    try {
        Logger.api('Creating/updating user in backend', { 
            userId: userInfo.id, 
            email: userInfo.email 
        });
        
        const response = await fetch(`${API_URL}/api/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userInfo.id,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture
            })
        });
        
        if (response.ok) {
            Logger.api('User created/updated successfully');
            currentUserId = userInfo.id;
            await migrateLocalDataToBackend();
            await loadStateFromBackend();
        } else {
            Logger.error('Failed to create/update user', { status: response.status });
        }
    } catch (error) {
        Logger.error('User creation error', error);
    }
}

async function migrateLocalDataToBackend() {
    const hasLocalData = cards.length > 0 || tasks.length > 0 || reminders.length > 0;
    
    if (hasLocalData) {
        await syncStateToBackend();
    }
}

async function getStarredSites() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['starredSites'], (result) => {
            resolve(result.starredSites || []);
        });
    });
}

async function getAllRssFeeds() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (result) => {
            const rssFeeds = {};
            for (const key in result) {
                if (key.startsWith('rssFeeds_')) {
                    rssFeeds[key.replace('rssFeeds_', '')] = result[key];
                }
            }
            resolve(rssFeeds);
        });
    });
}

function showSyncStatus(status) {
    let syncIndicator = document.getElementById('syncIndicator');
    if (!syncIndicator) {
        syncIndicator = document.createElement('div');
        syncIndicator.id = 'syncIndicator';
        document.querySelector('.toolbar').appendChild(syncIndicator);
    }
    
    syncIndicator.className = `sync-indicator ${status}`;
    
    if (status === 'saving') {
        syncIndicator.textContent = '↻ Saving...';
    } else if (status === 'saved') {
        syncIndicator.textContent = '✓ Saved';
        setTimeout(() => {
            syncIndicator.style.opacity = '0';
        }, 2000);
    } else if (status === 'error') {
        syncIndicator.textContent = '✗ Sync error';
        setTimeout(() => {
            syncIndicator.style.opacity = '0';
        }, 3000);
    }
    
    syncIndicator.style.opacity = '1';
}

function openAppModal() {
    document.getElementById('appModal').classList.add('active');
}

function closeAppModal() {
    document.getElementById('appModal').classList.remove('active');
}

function handleAppSelection(appType) {
    if (appType === 'mercury') {
        promptMercuryToken();
    } else if (appType === 'chatgpt') {
        closeAppModal();
        createChatGPTCard();
    } else if (appType === 'google') {
        closeAppModal();
        createGoogleSearchCard();
    } else if (appType === 'gmail') {
        closeAppModal();
        authenticateGmail();
    } else if (appType === 'tasks') {
        closeAppModal();
        createTasksCard();
    } else if (appType === 'reminder') {
        closeAppModal();
        createReminderCard();
    } else if (appType === 'ssense') {
        closeAppModal();
        createSSENSECard();
    } else if (appType === 'weather') {
        closeAppModal();
        createWeatherCard();
    } else if (appType === 'history') {
        closeAppModal();
        createHistoryCard();
    } else if (appType === 'rss') {
        closeAppModal();
        createRssCard();
    }
}

async function promptMercuryToken() {
    closeAppModal();

    // Check if user is already connected
    if (currentUserId) {
        try {
            const response = await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`);
            const data = await response.json();

            if (data.token) {
                // Already connected, create card
                chrome.storage.local.set({ mercuryToken: data.token, mercuryConnected: true }, () => {
                    createMercuryCard();
                });
                return;
            }
        } catch (error) {
            Logger.error('Error checking Mercury connection', error);
        }
    }

    // Not connected, prompt for token
    const token = prompt('Enter your Mercury API token:');
    if (token && token.trim()) {
        const trimmedToken = token.trim();

        // Save to local storage
        chrome.storage.local.set({ mercuryToken: trimmedToken, mercuryConnected: true }, async () => {
            // Save to database if user is logged in
            if (currentUserId) {
                try {
                    await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ token: trimmedToken })
                    });
                    Logger.api('Mercury token saved to database');
                } catch (error) {
                    Logger.error('Error saving Mercury token to database', error);
                }
            }
            createMercuryCard();
        });
    }
}

async function createMercuryCard() {
    const card = {
        id: Date.now().toString(),
        type: 'mercury',
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 150,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

async function fetchMercuryData(token) {
    try {
        const authToken = token.startsWith('secret-token:') ? token : `secret-token:${token}`;
        
        const accountsResponse = await fetch('https://api.mercury.com/api/v1/accounts', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!accountsResponse.ok) {
            throw new Error('Failed to fetch accounts');
        }
        
        const accountsData = await accountsResponse.json();
        const checkingAccount = accountsData.accounts?.find(acc => acc.type === 'checking') || accountsData.accounts?.[0];
        
        if (!checkingAccount) {
            throw new Error('No checking account found');
        }
        
        const transactionsResponse = await fetch(`https://api.mercury.com/api/v1/account/${checkingAccount.id}/transactions`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!transactionsResponse.ok) {
            throw new Error('Failed to fetch transactions');
        }
        
        const transactionsData = await transactionsResponse.json();
        
        return {
            accountName: checkingAccount.name || 'My Checking Account',
            balance: checkingAccount.availableBalance || checkingAccount.currentBalance || 0,
            transactions: transactionsData.transactions?.slice(0, 10) || []
        };
    } catch (error) {
        console.error('Mercury API error:', error);
        return null;
    }
}

function renderMercuryCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    content.innerHTML = '<div class="loading">Loading Mercury data...</div>';

    chrome.storage.local.get(['mercuryToken'], (result) => {
        if (!result.mercuryToken) {
            content.innerHTML = `
                <div class="error-message">Mercury token not found. Please reconnect.</div>
                <button class="connect-btn" style="margin-top: 12px;">Reconnect</button>
            `;
            const btn = content.querySelector('.connect-btn');
            btn.addEventListener('click', async () => {
                // Clear token from both local storage and database
                chrome.storage.local.remove(['mercuryToken', 'mercuryConnected'], async () => {
                    if (currentUserId) {
                        try {
                            await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`, {
                                method: 'DELETE'
                            });
                            Logger.api('Mercury token deleted from database');
                        } catch (error) {
                            Logger.error('Error deleting Mercury token from database', error);
                        }
                    }
                    deleteCard(cardId);
                    promptMercuryToken();
                });
            });
            return;
        }

        fetchMercuryData(result.mercuryToken).then(mercuryData => {
            if (!mercuryData) {
                content.innerHTML = `
                    <div class="error-message">Failed to load Mercury data. This could be due to an invalid token, network issue, or API error.</div>
                    <button class="connect-btn" style="margin-top: 12px;">Update Token</button>
                    <button class="connect-btn" style="margin-top: 8px; background: #9b9a97;">Retry</button>
                `;
                const updateBtn = content.querySelectorAll('.connect-btn')[0];
                const retryBtn = content.querySelectorAll('.connect-btn')[1];

                updateBtn.addEventListener('click', async () => {
                    // Clear token from both local storage and database
                    chrome.storage.local.remove(['mercuryToken', 'mercuryConnected'], async () => {
                        if (currentUserId) {
                            try {
                                await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`, {
                                    method: 'DELETE'
                                });
                                Logger.api('Mercury token deleted from database');
                            } catch (error) {
                                Logger.error('Error deleting Mercury token from database', error);
                            }
                        }
                        deleteCard(cardId);
                        promptMercuryToken();
                    });
                });

                retryBtn.addEventListener('click', () => {
                    renderMercuryCard(cardEl, cardId);
                });
                return;
            }

        content.innerHTML = `
            <div class="app-connected">✓ Connected to Mercury</div>
            <div class="account-label">${mercuryData.accountName}</div>
            <div class="account-balance">$${mercuryData.balance.toFixed(2)}</div>
            <div class="account-label">Recent Transactions</div>
            <div class="transactions-list" id="transactions-${cardId}"></div>
        `;

        const transactionsList = content.querySelector(`#transactions-${cardId}`);

        if (mercuryData.transactions.length === 0) {
            transactionsList.innerHTML = '<div style="color: #9b9a97; font-size: 13px; padding: 8px 0;">No recent transactions</div>';
        } else {
            mercuryData.transactions.forEach(transaction => {
                const transactionEl = document.createElement('div');
                transactionEl.className = 'transaction-item';

                const amount = transaction.amount;
                const isPositive = amount > 0;

                transactionEl.innerHTML = `
                    <div class="transaction-description">${transaction.description || transaction.counterpartyName || 'Transaction'}</div>
                    <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}$${Math.abs(amount).toFixed(2)}
                    </div>
                `;

                transactionsList.appendChild(transactionEl);
            });
        }
        });
    });
}

function createChatGPTCard() {
    const card = {
        id: Date.now().toString(),
        type: 'chatgpt',
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 100,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

function renderChatGPTCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = `
        <div style="margin-bottom: 8px; color: #9b9a97; font-size: 13px;">Ask ChatGPT anything</div>
        <textarea id="chatgpt-input-${cardId}" placeholder="Type your question here..." style="width: 100%; min-height: 80px; border: 1px solid #e3e2e0; border-radius: 6px; padding: 10px; font-family: inherit; font-size: 14px; resize: vertical; margin-bottom: 12px;"></textarea>
        <button class="connect-btn" id="chatgpt-btn-${cardId}">Ask ChatGPT</button>
    `;
    
    const input = content.querySelector(`#chatgpt-input-${cardId}`);
    const button = content.querySelector(`#chatgpt-btn-${cardId}`);
    
    const askChatGPT = () => {
        const question = input.value.trim();
        if (question) {
            const encodedQuestion = encodeURIComponent(question);
            window.open(`https://chat.openai.com/?q=${encodedQuestion}`, '_blank');
            input.value = '';
        }
    };
    
    button.addEventListener('click', askChatGPT);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            askChatGPT();
        }
    });
}

function createGoogleSearchCard() {
    const card = {
        id: Date.now().toString(),
        type: 'google',
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 50,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

function renderGoogleSearchCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = `
        <div style="margin-bottom: 8px; color: #9b9a97; font-size: 13px;">Search Google</div>
        <div style="display: flex; gap: 8px;">
            <input type="text" id="google-input-${cardId}" placeholder="Enter search query..." style="flex: 1; border: 1px solid #e3e2e0; border-radius: 6px; padding: 10px; font-family: inherit; font-size: 14px;" />
            <button class="connect-btn" id="google-btn-${cardId}" style="width: auto; padding: 10px 20px;">Search</button>
        </div>
    `;
    
    const input = content.querySelector(`#google-input-${cardId}`);
    const button = content.querySelector(`#google-btn-${cardId}`);
    
    const searchGoogle = () => {
        const query = input.value.trim();
        if (query) {
            const encodedQuery = encodeURIComponent(query);
            window.open(`https://www.google.com/search?q=${encodedQuery}`, '_blank');
            input.value = '';
        }
    };
    
    button.addEventListener('click', searchGoogle);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchGoogle();
        }
    });
}

function authenticateGmail() {
    chrome.storage.local.get(['gmailConnected'], (result) => {
        if (result.gmailConnected) {
            createGmailCard();
        } else {
            if (typeof chrome.identity !== 'undefined') {
                chrome.identity.getAuthToken({ interactive: true }, (token) => {
                    if (chrome.runtime.lastError || !token) {
                        alert('Failed to authenticate with Gmail. Please try again.');
                        return;
                    }
                    
                    chrome.storage.local.set({ gmailToken: token, gmailConnected: true }, () => {
                        createGmailCard();
                    });
                });
            } else {
                alert('Gmail authentication requires a valid OAuth client ID. Please check the setup instructions.');
            }
        }
    });
}

function createGmailCard() {
    const card = {
        id: Date.now().toString(),
        type: 'gmail',
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 150,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

async function fetchGmailMessages(token) {
    try {
        const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=20', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch messages');
        }
        
        const data = await response.json();
        
        if (!data.messages || data.messages.length === 0) {
            return [];
        }
        
        const messageDetails = await Promise.all(
            data.messages.map(async (msg) => {
                const msgResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (msgResponse.ok) {
                    return await msgResponse.json();
                }
                return null;
            })
        );
        
        return messageDetails.filter(msg => msg !== null).map(msg => {
            const headers = msg.payload.headers;
            const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            
            return {
                id: msg.id,
                from: from,
                subject: subject,
                date: date,
                snippet: msg.snippet
            };
        });
    } catch (error) {
        console.error('Gmail API error:', error);
        return null;
    }
}

function renderGmailCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    content.innerHTML = '<div class="loading">Loading Gmail messages...</div>';
    
    chrome.storage.local.get(['gmailToken'], (result) => {
        if (!result.gmailToken) {
            content.innerHTML = `
                <div class="error-message">Gmail token not found. Please reconnect.</div>
                <button class="connect-btn" style="margin-top: 12px;">Reconnect</button>
            `;
            const btn = content.querySelector('.connect-btn');
            btn.addEventListener('click', () => {
                chrome.storage.local.remove(['gmailToken', 'gmailConnected'], () => {
                    deleteCard(cardId);
                    authenticateGmail();
                });
            });
            return;
        }
        
        fetchGmailMessages(result.gmailToken).then(messages => {
            if (!messages) {
                content.innerHTML = `
                    <div class="error-message">Failed to load Gmail messages. Token may have expired.</div>
                    <button class="connect-btn" style="margin-top: 12px;">Reconnect</button>
                    <button class="connect-btn" style="margin-top: 8px; background: #9b9a97;">Retry</button>
                `;
                const reconnectBtn = content.querySelectorAll('.connect-btn')[0];
                const retryBtn = content.querySelectorAll('.connect-btn')[1];
                
                reconnectBtn.addEventListener('click', () => {
                    chrome.storage.local.remove(['gmailToken', 'gmailConnected'], () => {
                        deleteCard(cardId);
                        authenticateGmail();
                    });
                });
                
                retryBtn.addEventListener('click', () => {
                    renderGmailCard(cardEl, cardId);
                });
                return;
            }
            
            content.innerHTML = `
                <div class="app-connected">✓ Connected to Gmail</div>
                <div class="account-label">Last 20 Emails</div>
                <div class="transactions-list" id="gmail-list-${cardId}" style="max-height: 400px; overflow-y: auto;"></div>
            `;
            
            const emailList = content.querySelector(`#gmail-list-${cardId}`);
            
            if (messages.length === 0) {
                emailList.innerHTML = '<div style="color: #9b9a97; font-size: 13px; padding: 8px 0;">No emails found</div>';
            } else {
                messages.forEach(email => {
                    const emailEl = document.createElement('div');
                    emailEl.className = 'transaction-item';
                    emailEl.style.cursor = 'pointer';
                    emailEl.style.flexDirection = 'column';
                    emailEl.style.alignItems = 'flex-start';
                    
                    const fromMatch = email.from.match(/<(.+?)>/);
                    const fromEmail = fromMatch ? fromMatch[1] : email.from;
                    const fromName = email.from.replace(/<.+?>/, '').trim() || fromEmail;
                    
                    emailEl.innerHTML = `
                        <div style="font-weight: 500; font-size: 13px; color: #37352f; margin-bottom: 2px;">${fromName}</div>
                        <div style="font-size: 14px; color: #37352f; margin-bottom: 2px;">${email.subject}</div>
                        <div style="font-size: 12px; color: #9b9a97;">${email.snippet}</div>
                    `;
                    
                    emailEl.addEventListener('click', () => {
                        window.open(`https://mail.google.com/mail/u/0/#inbox/${email.id}`, '_blank');
                    });
                    
                    emailList.appendChild(emailEl);
                });
            }
        });
    });
}

function createTasksCard() {
    const card = {
        id: Date.now().toString(),
        type: 'tasks',
        x: window.innerWidth / 2 - 175,
        y: window.innerHeight / 2 - 150,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

function renderTasksCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = `
        <div style="margin-bottom: 12px;">
            <input type="text" id="task-input-${cardId}" placeholder="Add a new task..." style="width: 100%; border: 1px solid #e3e2e0; border-radius: 6px; padding: 8px; font-family: inherit; font-size: 14px; margin-bottom: 8px;" />
            <input type="date" id="task-date-${cardId}" style="width: 100%; border: 1px solid #e3e2e0; border-radius: 6px; padding: 8px; font-family: inherit; font-size: 14px; margin-bottom: 8px;" />
            <button class="connect-btn" id="add-task-${cardId}">Add Task</button>
        </div>
        <div id="tasks-list-${cardId}" style="max-height: 400px; overflow-y: auto;"></div>
    `;
    
    const input = content.querySelector(`#task-input-${cardId}`);
    const dateInput = content.querySelector(`#task-date-${cardId}`);
    const addBtn = content.querySelector(`#add-task-${cardId}`);
    const tasksList = content.querySelector(`#tasks-list-${cardId}`);
    
    const addTask = () => {
        const taskText = input.value.trim();
        if (!taskText) return;
        
        const task = {
            id: Date.now().toString(),
            text: taskText,
            dueDate: dateInput.value || null,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        tasks.unshift(task);
        saveTasks();
        renderTasksList(tasksList);
        
        input.value = '';
        dateInput.value = '';
    };
    
    addBtn.addEventListener('click', addTask);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });
    
    renderTasksList(tasksList);
}

function renderTasksList(container) {
    if (tasks.length === 0) {
        container.innerHTML = '<div style="color: #9b9a97; text-align: center; padding: 20px; font-size: 13px;">No tasks yet</div>';
        return;
    }
    
    container.innerHTML = '';
    
    tasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.style.cssText = 'display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 6px; margin-bottom: 6px; background: #f7f6f3; transition: background 0.2s;';
        taskEl.onmouseover = () => taskEl.style.background = '#edece9';
        taskEl.onmouseout = () => taskEl.style.background = '#f7f6f3';
        
        const checkbox = document.createElement('div');
        checkbox.style.cssText = `width: 18px; height: 18px; border: 2px solid ${task.completed ? '#2383e2' : '#e3e2e0'}; border-radius: 4px; cursor: pointer; flex-shrink: 0; margin-top: 2px; background: ${task.completed ? '#2383e2' : 'transparent'}; position: relative; transition: all 0.2s;`;
        if (task.completed) {
            checkbox.innerHTML = '<div style="color: white; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px;">✓</div>';
        }
        checkbox.addEventListener('click', () => {
            task.completed = !task.completed;
            saveTasks();
            renderTasksList(container);
        });
        
        const details = document.createElement('div');
        details.style.cssText = 'flex: 1;';
        
        const text = document.createElement('div');
        text.style.cssText = `font-size: 14px; color: ${task.completed ? '#9b9a97' : '#37352f'}; margin-bottom: 4px; ${task.completed ? 'text-decoration: line-through;' : ''}`;
        text.textContent = task.text;
        details.appendChild(text);
        
        if (task.dueDate) {
            const dueDate = document.createElement('div');
            const dueDateObj = new Date(task.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isOverdue = dueDateObj < today && !task.completed;
            
            dueDate.style.cssText = `font-size: 12px; color: ${isOverdue ? '#d93025' : '#9b9a97'}; ${isOverdue ? 'font-weight: 500;' : ''}`;
            dueDate.textContent = 'Due: ' + formatDate(task.dueDate);
            details.appendChild(dueDate);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.style.cssText = 'background: transparent; border: none; color: #9b9a97; cursor: pointer; font-size: 18px; padding: 0 4px; flex-shrink: 0; transition: color 0.2s;';
        deleteBtn.textContent = '×';
        deleteBtn.onmouseover = () => deleteBtn.style.color = '#d93025';
        deleteBtn.onmouseout = () => deleteBtn.style.color = '#9b9a97';
        deleteBtn.addEventListener('click', () => {
            tasks = tasks.filter(t => t.id !== task.id);
            saveTasks();
            renderTasksList(container);
        });
        
        taskEl.appendChild(checkbox);
        taskEl.appendChild(details);
        taskEl.appendChild(deleteBtn);
        
        container.appendChild(taskEl);
    });
}

function loadTasks() {
    chrome.storage.local.get(['tasks'], (result) => {
        tasks = result.tasks || [];
    });
}

function saveTasks() {
    chrome.storage.local.set({ tasks: tasks });
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
    const card = {
        id: Date.now().toString(),
        type: 'reminder',
        x: window.innerWidth / 2 - 175,
        y: window.innerHeight / 2 - 150,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
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
        
        reminders.push(reminder);
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
            reminders = reminders.filter(r => r.id !== reminder.id);
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
        reminders = result.reminders || [];
    });
}

function saveReminders() {
    chrome.storage.local.set({ reminders: reminders });
    debouncedSync();
}

function startReminderChecker() {
    if (reminderCheckInterval) {
        clearInterval(reminderCheckInterval);
    }
    
    reminderCheckInterval = setInterval(() => {
        const now = new Date();
        
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

function createSSENSECard() {
    const card = {
        id: Date.now().toString(),
        type: 'ssense',
        x: window.innerWidth / 2 - 250,
        y: window.innerHeight / 2 - 200,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

async function fetchSSENSEProducts() {
    try {
        const response = await fetch('https://ssense-scrape-ushabbir.replit.app/api/products', {
            method: 'GET',
            headers: {
                'X-API-KEY': '1234'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch SSENSE products');
        }
        
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching SSENSE products:', error);
        return [];
    }
}

async function renderSSENSECard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading products...</div>';
    
    const products = await fetchSSENSEProducts();
    
    if (products.length === 0) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No products available</div>';
        return;
    }
    
    const limitedProducts = products.slice(0, 15);
    
    content.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'ssense-grid';
    
    limitedProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'ssense-product-card';
        productCard.style.cursor = 'pointer';
        
        const img = document.createElement('img');
        img.src = product.images[0]?.url || '';
        img.alt = product.images[0]?.alt_text || product.name;
        img.className = 'ssense-product-image';
        
        const name = document.createElement('div');
        name.className = 'ssense-product-name';
        name.textContent = product.name;
        
        const price = document.createElement('div');
        price.className = 'ssense-product-price';
        if (product.sale_price && product.sale_price < product.original_price) {
            price.innerHTML = `
                <span class="ssense-sale-price">$${product.sale_price}</span>
                <span class="ssense-original-price">$${product.original_price}</span>
            `;
        } else {
            price.textContent = `$${product.original_price}`;
        }
        
        productCard.appendChild(img);
        productCard.appendChild(name);
        productCard.appendChild(price);
        
        productCard.addEventListener('click', () => {
            window.open(product.link, '_blank');
        });
        
        grid.appendChild(productCard);
    });
    
    content.appendChild(grid);
}

function createWeatherCard() {
    const card = {
        id: Date.now().toString(),
        type: 'weather',
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 100,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

async function fetchWeatherData(latitude, longitude) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch weather data');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
}

function getWeatherDescription(weatherCode) {
    const weatherCodes = {
        0: '☀️ Clear',
        1: '🌤️ Mainly Clear',
        2: '⛅ Partly Cloudy',
        3: '☁️ Overcast',
        45: '🌫️ Foggy',
        48: '🌫️ Foggy',
        51: '🌦️ Light Drizzle',
        53: '🌦️ Drizzle',
        55: '🌧️ Heavy Drizzle',
        61: '🌧️ Light Rain',
        63: '🌧️ Rain',
        65: '🌧️ Heavy Rain',
        71: '🌨️ Light Snow',
        73: '🌨️ Snow',
        75: '🌨️ Heavy Snow',
        77: '❄️ Snow Grains',
        80: '🌦️ Light Showers',
        81: '🌧️ Showers',
        82: '🌧️ Heavy Showers',
        85: '🌨️ Snow Showers',
        86: '🌨️ Heavy Snow Showers',
        95: '⛈️ Thunderstorm',
        96: '⛈️ Thunderstorm with Hail',
        99: '⛈️ Heavy Thunderstorm'
    };
    
    return weatherCodes[weatherCode] || '🌤️ Unknown';
}

async function renderWeatherCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Getting location...</div>';
    
    if (!navigator.geolocation) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #d93025;">Location not supported</div>';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            
            content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading weather...</div>';
            
            const weatherData = await fetchWeatherData(latitude, longitude);
            
            if (!weatherData) {
                content.innerHTML = '<div style="text-align: center; padding: 20px; color: #d93025;">Failed to load weather</div>';
                return;
            }
            
            const current = weatherData.current_weather;
            const daily = weatherData.daily;
            const weatherDesc = getWeatherDescription(current.weathercode);
            
            content.innerHTML = `
                <div class="weather-container">
                    <div class="weather-main">
                        <div class="weather-icon">${weatherDesc.split(' ')[0]}</div>
                        <div class="weather-temp">${Math.round(current.temperature)}°C</div>
                    </div>
                    <div class="weather-description">${weatherDesc.substring(weatherDesc.indexOf(' ') + 1)}</div>
                    <div class="weather-details">
                        <div class="weather-detail">
                            <div class="weather-detail-label">Wind</div>
                            <div class="weather-detail-value">${Math.round(current.windspeed)} km/h</div>
                        </div>
                        <div class="weather-detail">
                            <div class="weather-detail-label">High/Low</div>
                            <div class="weather-detail-value">${Math.round(daily.temperature_2m_max[0])}° / ${Math.round(daily.temperature_2m_min[0])}°</div>
                        </div>
                    </div>
                </div>
            `;
        },
        (error) => {
            content.innerHTML = '<div style="text-align: center; padding: 20px; color: #d93025;">Location permission denied</div>';
        }
    );
}

function createHistoryCard() {
    const card = {
        id: Date.now().toString(),
        type: 'history',
        x: window.innerWidth / 2 - 175,
        y: window.innerHeight / 2 - 150,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

function createRssCard() {
    const card = {
        id: Date.now().toString(),
        type: 'rss',
        x: window.innerWidth / 2 - 225,
        y: window.innerHeight / 2 - 150,
        content: ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

function extractRootDomain(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const parts = hostname.split('.');
        
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }
        return hostname;
    } catch (e) {
        return null;
    }
}

async function fetchBrowsingHistory() {
    try {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        const historyItems = await chrome.history.search({
            text: '',
            startTime: sevenDaysAgo,
            maxResults: 10000
        });
        
        const domainCounts = {};
        
        for (const item of historyItems) {
            if (item.url) {
                const domain = extractRootDomain(item.url);
                if (domain && !domain.includes('chrome://') && !domain.includes('chrome-extension://')) {
                    const visits = await chrome.history.getVisits({ url: item.url });
                    
                    const recentVisits = visits.filter(visit => visit.visitTime >= sevenDaysAgo);
                    
                    if (recentVisits.length > 0) {
                        domainCounts[domain] = (domainCounts[domain] || 0) + recentVisits.length;
                    }
                }
            }
        }
        
        const sortedDomains = Object.entries(domainCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([domain, count]) => ({ domain, count }));
        
        return sortedDomains;
    } catch (error) {
        console.error('Error fetching history:', error);
        return [];
    }
}

async function loadStarredSites() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['starredSites'], (result) => {
            resolve(result.starredSites || []);
        });
    });
}

async function saveStarredSites(starredSites) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ starredSites: starredSites }, resolve);
    });
}

async function toggleStarredSite(domain) {
    const starredSites = await loadStarredSites();
    const index = starredSites.indexOf(domain);
    
    if (index > -1) {
        starredSites.splice(index, 1);
    } else {
        starredSites.push(domain);
    }
    
    await saveStarredSites(starredSites);
    return starredSites.includes(domain);
}

async function renderHistoryCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading history...</div>';
    
    const topSites = await fetchBrowsingHistory();
    
    if (topSites.length === 0) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No history found</div>';
        return;
    }
    
    const starredSites = await loadStarredSites();
    
    const sitesWithRank = topSites.map((site, index) => ({
        ...site,
        originalRank: index + 1
    }));
    
    const starredList = sitesWithRank.filter(site => starredSites.includes(site.domain));
    const unstarredList = sitesWithRank.filter(site => !starredSites.includes(site.domain));
    const sortedSites = [...starredList, ...unstarredList];
    
    content.innerHTML = '';
    
    const list = document.createElement('div');
    list.className = 'history-list';
    list.id = `history-list-${cardId}`;
    
    sortedSites.forEach((site) => {
        const isStarred = starredSites.includes(site.domain);
        const siteItem = document.createElement('div');
        siteItem.className = 'history-item' + (isStarred ? ' starred' : '');
        
        const rank = document.createElement('div');
        rank.className = 'history-rank';
        if (isStarred) {
            rank.innerHTML = '📌';
        } else {
            rank.textContent = `#${site.originalRank}`;
        }
        
        const favicon = document.createElement('img');
        favicon.className = 'history-favicon';
        favicon.src = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`;
        favicon.alt = site.domain;
        favicon.onerror = () => {
            favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><circle cx="12" cy="12" r="10"/></svg>';
        };
        
        const siteInfo = document.createElement('div');
        siteInfo.className = 'history-info';
        
        const siteName = document.createElement('div');
        siteName.className = 'history-domain';
        siteName.textContent = site.domain;
        
        const siteCount = document.createElement('div');
        siteCount.className = 'history-count';
        siteCount.textContent = `${site.count} visits`;
        
        siteInfo.appendChild(siteName);
        siteInfo.appendChild(siteCount);
        
        const starBtn = document.createElement('button');
        starBtn.className = 'history-star-btn';
        starBtn.innerHTML = isStarred ? '★' : '☆';
        starBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleStarredSite(site.domain);
            
            const updatedCard = document.querySelector(`[data-id="${cardId}"]`);
            if (updatedCard) {
                renderHistoryCard(updatedCard, cardId);
            }
        });
        
        siteItem.appendChild(rank);
        siteItem.appendChild(favicon);
        siteItem.appendChild(siteInfo);
        siteItem.appendChild(starBtn);
        
        siteItem.addEventListener('click', (e) => {
            if (e.target !== starBtn) {
                window.open(`https://${site.domain}`, '_blank');
            }
        });
        
        list.appendChild(siteItem);
    });
    
    content.appendChild(list);
}

const DEFAULT_RSS_FEEDS = [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss' }
];

async function fetchRssFeed(feedUrl) {
    const CORS_PROXY = 'https://api.cors.lol/?url=';
    
    try {
        const response = await fetch(CORS_PROXY + encodeURIComponent(feedUrl));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        
        const items = xmlDoc.querySelectorAll('item');
        const feedItems = Array.from(items).slice(0, 5).map(item => ({
            title: item.querySelector('title')?.textContent || '',
            link: item.querySelector('link')?.textContent || '',
            pubDate: item.querySelector('pubDate')?.textContent || ''
        }));
        
        return feedItems;
    } catch (error) {
        console.error('RSS fetch error:', error);
        return [];
    }
}

async function loadRssFeeds(cardId) {
    return new Promise((resolve) => {
        chrome.storage.local.get([`rssFeeds_${cardId}`], (result) => {
            resolve(result[`rssFeeds_${cardId}`] || DEFAULT_RSS_FEEDS);
        });
    });
}

async function saveRssFeeds(cardId, feeds) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [`rssFeeds_${cardId}`]: feeds }, () => {
            debouncedSync();
            resolve();
        });
    });
}

async function renderRssCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading feeds...</div>';
    
    const feeds = await loadRssFeeds(cardId);
    
    const allArticles = [];
    for (const feed of feeds) {
        const articles = await fetchRssFeed(feed.url);
        articles.forEach(article => {
            allArticles.push({
                ...article,
                source: feed.name
            });
        });
    }
    
    allArticles.sort((a, b) => {
        const dateA = new Date(a.pubDate);
        const dateB = new Date(b.pubDate);
        return dateB - dateA;
    });
    
    const latestArticles = allArticles.slice(0, 5);
    
    content.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'rss-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Latest Tech News';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    
    const manageBtn = document.createElement('button');
    manageBtn.className = 'rss-manage-btn';
    manageBtn.textContent = 'Manage Feeds';
    manageBtn.addEventListener('click', () => showFeedManager(cardEl, cardId));
    
    header.appendChild(title);
    header.appendChild(manageBtn);
    content.appendChild(header);
    
    if (latestArticles.length === 0) {
        const noArticles = document.createElement('div');
        noArticles.style.textAlign = 'center';
        noArticles.style.padding = '20px';
        noArticles.style.color = '#888';
        noArticles.textContent = 'No articles found';
        content.appendChild(noArticles);
        return;
    }
    
    const articleList = document.createElement('div');
    articleList.className = 'rss-article-list';
    
    latestArticles.forEach(article => {
        const articleEl = document.createElement('a');
        articleEl.className = 'rss-article';
        articleEl.href = article.link;
        articleEl.target = '_blank';
        
        const articleTitle = document.createElement('div');
        articleTitle.className = 'rss-article-title';
        articleTitle.textContent = article.title;
        
        const articleMeta = document.createElement('div');
        articleMeta.className = 'rss-article-meta';
        
        const source = document.createElement('span');
        source.textContent = article.source;
        
        const date = document.createElement('span');
        if (article.pubDate) {
            const pubDate = new Date(article.pubDate);
            const now = new Date();
            const diffTime = Math.abs(now - pubDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            
            if (diffDays === 0) {
                if (diffHours === 0) {
                    date.textContent = 'Just now';
                } else if (diffHours === 1) {
                    date.textContent = '1 hour ago';
                } else {
                    date.textContent = `${diffHours} hours ago`;
                }
            } else if (diffDays === 1) {
                date.textContent = 'Yesterday';
            } else if (diffDays < 7) {
                date.textContent = `${diffDays} days ago`;
            } else {
                date.textContent = pubDate.toLocaleDateString();
            }
        }
        
        articleMeta.appendChild(source);
        if (article.pubDate) {
            const separator = document.createElement('span');
            separator.textContent = ' • ';
            articleMeta.appendChild(separator);
            articleMeta.appendChild(date);
        }
        
        articleEl.appendChild(articleTitle);
        articleEl.appendChild(articleMeta);
        articleList.appendChild(articleEl);
    });
    
    content.appendChild(articleList);
}

function showFeedManager(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    loadRssFeeds(cardId).then(feeds => {
        content.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'rss-header';
        
        const title = document.createElement('h3');
        title.textContent = 'Manage RSS Feeds';
        title.style.margin = '0 0 10px 0';
        title.style.fontSize = '16px';
        title.style.fontWeight = '600';
        
        const backBtn = document.createElement('button');
        backBtn.className = 'rss-manage-btn';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => renderRssCard(cardEl, cardId));
        
        header.appendChild(title);
        header.appendChild(backBtn);
        content.appendChild(header);
        
        const feedList = document.createElement('div');
        feedList.className = 'rss-feed-list';
        
        feeds.forEach((feed, index) => {
            const feedItem = document.createElement('div');
            feedItem.className = 'rss-feed-item';
            
            const feedInfo = document.createElement('div');
            feedInfo.className = 'rss-feed-info';
            
            const feedName = document.createElement('div');
            feedName.className = 'rss-feed-name';
            feedName.textContent = feed.name;
            
            const feedUrl = document.createElement('div');
            feedUrl.className = 'rss-feed-url';
            feedUrl.textContent = feed.url;
            
            feedInfo.appendChild(feedName);
            feedInfo.appendChild(feedUrl);
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'rss-remove-btn';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', async () => {
                feeds.splice(index, 1);
                await saveRssFeeds(cardId, feeds);
                showFeedManager(cardEl, cardId);
            });
            
            feedItem.appendChild(feedInfo);
            feedItem.appendChild(removeBtn);
            feedList.appendChild(feedItem);
        });
        
        content.appendChild(feedList);
        
        const addSection = document.createElement('div');
        addSection.className = 'rss-add-section';
        
        const addTitle = document.createElement('div');
        addTitle.textContent = 'Add New Feed';
        addTitle.style.fontSize = '14px';
        addTitle.style.fontWeight = '600';
        addTitle.style.marginBottom = '8px';
        
        const nameInput = document.createElement('input');
        nameInput.className = 'rss-input';
        nameInput.placeholder = 'Feed name (e.g., TechCrunch)';
        
        const urlInput = document.createElement('input');
        urlInput.className = 'rss-input';
        urlInput.placeholder = 'RSS feed URL';
        
        const addBtn = document.createElement('button');
        addBtn.className = 'rss-add-btn';
        addBtn.textContent = 'Add Feed';
        addBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const url = urlInput.value.trim();
            
            if (name && url) {
                feeds.push({ name, url });
                await saveRssFeeds(cardId, feeds);
                showFeedManager(cardEl, cardId);
            }
        });
        
        addSection.appendChild(addTitle);
        addSection.appendChild(nameInput);
        addSection.appendChild(urlInput);
        addSection.appendChild(addBtn);
        
        content.appendChild(addSection);
    });
}

async function checkAuthStatus() {
    Logger.auth('Checking authentication status');
    
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
        if (chrome.runtime.lastError || !token) {
            Logger.auth('No valid token found, showing login interface', chrome.runtime.lastError);
            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                showLoginInterface();
                currentUserId = null;
            });
            return;
        }
        
        Logger.auth('Token found, validating with Google API');
        const userInfo = await getUserInfo(token);
        if (userInfo) {
            Logger.auth('User authenticated successfully', { email: userInfo.email, name: userInfo.name });
            chrome.storage.local.set({ userInfo: userInfo, authToken: token }, async () => {
                updateAuthUI(userInfo);
                showAuthenticatedInterface();
                await createOrUpdateUser(userInfo);
            });
        } else {
            Logger.auth('Token validation failed, removing cached token');
            chrome.identity.removeCachedAuthToken({ token: token }, () => {
                chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                    showLoginInterface();
                    currentUserId = null;
                });
            });
        }
    });
}

async function signInWithGoogle() {
    Logger.auth('Starting Google sign-in process');
    
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError) {
            Logger.error('Authentication error during sign-in', chrome.runtime.lastError);
            return;
        }
        
        if (token) {
            Logger.auth('Sign-in token received, getting user info');
            const userInfo = await getUserInfo(token);
            if (userInfo) {
                Logger.auth('Sign-in successful', { email: userInfo.email, name: userInfo.name });
                chrome.storage.local.set({ userInfo: userInfo, authToken: token }, async () => {
                    updateAuthUI(userInfo);
                    showAuthenticatedInterface();
                    await createOrUpdateUser(userInfo);
                });
            } else {
                Logger.error('Failed to get user info after sign-in');
            }
        } else {
            Logger.error('No token received during sign-in');
        }
    });
}

async function signOutFromGoogle() {
    Logger.auth('Starting sign-out process');

    chrome.storage.local.get(['authToken'], async (result) => {
        const token = result.authToken;
        const userId = currentUserId;

        const completeSignOut = () => {
            Logger.auth('Clearing all local state');

            // Clear ALL local storage
            chrome.storage.local.clear(() => {
                Logger.auth('All local storage cleared');

                // Reset in-memory state
                cards = [];
                tasks = [];
                reminders = [];
                currentUserId = null;

                // Clear the canvas
                const canvas = document.getElementById('canvas');
                if (canvas) {
                    canvas.innerHTML = '';
                }

                Logger.auth('Sign-out completed, showing login interface');
                showLoginInterface();
            });
        };

        // Call backend logout endpoint to clear server-side session data
        if (userId) {
            try {
                Logger.auth('Logging out from backend', { userId });
                await fetch(`${API_URL}/api/logout/${userId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                Logger.auth('Backend logout successful');
            } catch (error) {
                Logger.warn('Backend logout failed', error);
            }
        }

        if (token) {
            Logger.auth('Revoking Google OAuth token');

            // Revoke the token with Google to force account picker on next sign-in
            fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
            .then(() => {
                Logger.auth('Token revoked with Google');
            })
            .catch((error) => {
                Logger.warn('Failed to revoke token with Google', error);
            })
            .finally(() => {
                // Remove cached token from Chrome
                chrome.identity.removeCachedAuthToken({ token: token }, () => {
                    Logger.auth('Cached token removed from Chrome');

                    // Also clear all Chrome Identity tokens to force fresh login
                    chrome.identity.clearAllCachedAuthTokens(() => {
                        Logger.auth('All cached auth tokens cleared');
                        completeSignOut();
                    });
                });
            });
        } else {
            Logger.auth('No auth token found during sign-out');
            completeSignOut();
        }
    });
}

async function getUserInfo(token) {
    try {
        Logger.api('Fetching user info from Google API');
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const userInfo = await response.json();
            Logger.api('User info retrieved successfully', { email: userInfo.email });
            return userInfo;
        }
        
        if (response.status === 401) {
            Logger.warn('Token unauthorized, removing cached token');
            chrome.identity.removeCachedAuthToken({ token: token }, () => {
                Logger.debug('Removed invalid cached token');
            });
        }
        
        Logger.error('Failed to fetch user info', { status: response.status });
        return null;
    } catch (error) {
        Logger.error('Error fetching user info', error);
        return null;
    }
}

function updateAuthUI(userInfo) {
    Logger.debug('Updating authentication UI', { name: userInfo.name, email: userInfo.email });
    
    document.getElementById('signInBtn').style.display = 'none';
    document.getElementById('userProfile').style.display = 'flex';
    document.getElementById('userName').textContent = userInfo.name || userInfo.email;
    
    if (userInfo.picture) {
        document.getElementById('userAvatar').src = userInfo.picture;
    } else {
        document.getElementById('userAvatar').style.display = 'none';
    }
}
