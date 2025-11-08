let cards = [];
let draggedCard = null;
let offset = { x: 0, y: 0 };
let tasks = [];
let reminders = [];
let reminderCheckInterval = null;

// Detect if we're in a Chrome extension (hostname will be extension ID, not localhost)
function isChromeExtension() {
    // Extension IDs are long alphanumeric strings (32 chars)
    // Also check if chrome.runtime exists
    return window.location.hostname.length > 20 && /^[a-z]+$/.test(window.location.hostname) || 
           (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
}

// Set API URL - always use localhost for Chrome extensions
const API_URL = (window.location.hostname === 'localhost' || isChromeExtension())
    ? 'http://localhost:3000' 
    : `https://${window.location.hostname.replace(/^.*?\.replit\.dev$/, match => match.replace(/^.*?-/, ''))}/api`.replace('/api', ':3000');

console.log('🌐 API_URL set to:', API_URL);
console.log('🌐 Current hostname:', window.location.hostname);
console.log('🌐 Is Chrome Extension:', isChromeExtension());

let syncTimeout = null;
let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Show loading state first to prevent blinking
    showLoadingState();
    
    // Load data in background
    loadCards();
    loadTasks();
    loadReminders();
    startReminderChecker();
    
    // Check auth status - will hide loading and show appropriate view
    checkAuthStatus();
    
    document.getElementById('addNote').addEventListener('click', () => createCard('note'));
    document.getElementById('addLink').addEventListener('click', () => createCard('link'));
    document.getElementById('addApp').addEventListener('click', openAppModal);
    document.getElementById('closeModal').addEventListener('click', closeAppModal);
    document.getElementById('signInBtn').addEventListener('click', signInWithGoogle);
    document.getElementById('signOutBtn').addEventListener('click', signOutFromGoogle);
    
    const unauthSignInBtn = document.getElementById('unauthSignInBtn');
    if (unauthSignInBtn) {
        unauthSignInBtn.addEventListener('click', signInWithGoogle);
    }
    
    const unauthSearchInput = document.getElementById('unauthSearchInput');
    const unauthModelBtn = document.getElementById('unauthModelBtn');
    
    if (unauthSearchInput) {
        unauthSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // Handle search
                const query = unauthSearchInput.value.trim();
                if (query) {
                    // Future: handle search functionality
                    console.log('Search query:', query);
                }
            }
        });
    }
    
    if (unauthModelBtn) {
        unauthModelBtn.addEventListener('click', () => {
            // Future: show AI model selector dropdown
            console.log('AI model selector clicked');
        });
    }
    
    // Search input and model button (used for both authenticated and unauthenticated states)
    // The unauthSearchInput and unauthModelBtn are used for both states
    
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
});

function updateCanvasHeight() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    // Check if canvas is inside dots section (authenticated state)
    const dotsSection = canvas.closest('.unauth-dots');
    const isInDotsSection = dotsSection && canvas.style.display !== 'none';
    
    if (cards.length === 0) {
        if (isInDotsSection) {
            canvas.style.minHeight = '500px';
        } else {
            canvas.style.minHeight = '100vh';
        }
        return;
    }
    
    let maxBottom = isInDotsSection ? 500 : window.innerHeight;
    cards.forEach(card => {
        const cardEl = document.querySelector(`[data-id="${card.id}"]`);
        if (cardEl) {
            const cardHeight = cardEl.offsetHeight;
            const cardBottom = card.y + cardHeight + 100;
            maxBottom = Math.max(maxBottom, cardBottom);
        }
    });
    
    canvas.style.minHeight = maxBottom + 'px';
    console.log('Canvas height updated to:', maxBottom + 'px', 'isInDotsSection:', isInDotsSection);
}

function createCard(type, data = {}) {
    const canvas = document.getElementById('canvas');
    let defaultX = window.innerWidth / 2 - 125;
    let defaultY = window.innerHeight / 2 - 50;
    
    // If canvas is inside dots section (authenticated), adjust positioning
    if (canvas) {
        const dotsSection = canvas.closest('.unauth-dots');
        if (dotsSection && canvas.style.display !== 'none') {
            // Position relative to dots section
            const dotsRect = dotsSection.getBoundingClientRect();
            defaultX = dotsRect.width / 2 - 125;
            defaultY = dotsRect.height / 2 - 50;
        }
    }
    
    const card = {
        id: Date.now().toString(),
        type: type,
        x: data.x || defaultX,
        y: data.y || defaultY,
        content: data.content || ''
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
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
    
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.appendChild(cardEl);
        console.log('Card rendered:', card.type, 'at', card.x, card.y, 'canvas:', canvas.style.display);
    } else {
        console.error('Canvas not found when rendering card!');
    }
    
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
    chrome.storage.local.set({ cards: cards });
    debouncedSync();
}

function loadCards() {
    chrome.storage.local.get(['cards'], (result) => {
        const canvas = document.getElementById('canvas');
        console.log('loadCards called, canvas found:', !!canvas, 'canvas display:', canvas?.style.display);
        
        if (result.cards) {
            cards = result.cards;
            console.log('Loading', cards.length, 'cards');
            
            let needsSave = false;
            cards.forEach(card => {
                if (card.type === 'mercury' && card.content) {
                    try {
                        const oldData = JSON.parse(card.content);
                        if (oldData.token) {
                            card.content = '';
                            needsSave = true;
                        }
                    } catch (e) {
                    }
                }
            });
            
            if (needsSave) {
                saveCards();
            }
            
            cards.forEach(card => {
                console.log('Rendering card:', card.type, 'at', card.x, card.y);
                renderCard(card);
            });
            updateCanvasHeight();
            console.log('Cards rendered, total cards in DOM:', document.querySelectorAll('.card').length);
        } else {
            console.log('No cards found in storage');
        }
    });
}

function debouncedSync() {
    if (!currentUserId) {
        console.warn('⚠️ debouncedSync called but currentUserId is null/undefined');
        return;
    }
    
    console.log('⏱️ Debouncing sync (will sync in 2 seconds)...');
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }
    
    syncTimeout = setTimeout(() => {
        syncStateToBackend();
    }, 2000);
}

async function syncStateToBackend() {
    if (!currentUserId) {
        console.error('❌ Cannot sync: currentUserId is null/undefined');
        return;
    }
    
    try {
        console.log('🔄 Starting sync to backend for user:', currentUserId);
        showSyncStatus('saving');
        
        const state = {
            cards: cards,
            tasks: tasks,
            reminders: reminders,
            starredSites: await getStarredSites(),
            rssFeeds: await getAllRssFeeds()
        };
        
        console.log('📤 Sending state to:', `${API_URL}/api/state/${currentUserId}`);
        console.log('📊 State data:', {
            cards: cards.length,
            tasks: tasks.length,
            reminders: reminders.length,
            starredSites: state.starredSites?.length || 0,
            rssFeeds: Object.keys(state.rssFeeds || {}).length
        });
        
        const response = await fetch(`${API_URL}/api/state/${currentUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ state })
        });
        
        const responseData = await response.json();
        console.log('📥 Server response:', response.status, responseData);
        
        if (response.ok) {
            console.log('✅ Sync successful');
            showSyncStatus('saved');
        } else {
            console.error('❌ Sync failed:', response.status, responseData);
            showSyncStatus('error');
        }
    } catch (error) {
        console.error('❌ Sync error:', error);
        showSyncStatus('error');
    }
}

async function loadStateFromBackend() {
    if (!currentUserId) return;
    
    try {
        const response = await fetch(`${API_URL}/api/state/${currentUserId}`);
        const data = await response.json();
        
        if (data.state && Object.keys(data.state).length > 0) {
            if (data.state.cards) {
                cards = data.state.cards;
                chrome.storage.local.set({ cards: cards });
                document.getElementById('canvas').innerHTML = '';
                cards.forEach(card => renderCard(card));
                updateCanvasHeight();
            }
            
            if (data.state.tasks) {
                tasks = data.state.tasks;
                chrome.storage.local.set({ tasks: tasks });
            }
            
            if (data.state.reminders) {
                reminders = data.state.reminders;
                chrome.storage.local.set({ reminders: reminders });
            }
            
            if (data.state.starredSites) {
                chrome.storage.local.set({ starredSites: data.state.starredSites });
            }
            
            if (data.state.rssFeeds) {
                for (const [cardId, feeds] of Object.entries(data.state.rssFeeds)) {
                    chrome.storage.local.set({ [`rssFeeds_${cardId}`]: feeds });
                }
            }
        }
    } catch (error) {
        console.error('Load state error:', error);
    }
}

async function createOrUpdateUser(userInfo) {
    try {
        console.log('👤 Creating/updating user:', userInfo.id, userInfo.email);
        console.log('📤 Sending to:', `${API_URL}/api/user`);
        
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
        
        const responseData = await response.json();
        console.log('📥 User API response:', response.status, responseData);
        
        if (response.ok) {
            console.log('✅ User saved, setting currentUserId:', userInfo.id);
            currentUserId = userInfo.id;
            console.log('✅ currentUserId is now:', currentUserId);
            await migrateLocalDataToBackend();
            await loadStateFromBackend();
            // Test sync after a short delay to ensure everything is loaded
            setTimeout(() => {
                console.log('🧪 Testing sync after authentication...');
                if (currentUserId) {
                    syncStateToBackend();
                }
            }, 1000);
        } else {
            console.error('❌ User creation failed:', response.status, responseData);
        }
    } catch (error) {
        console.error('❌ User creation error:', error);
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
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) {
        console.warn('⚠️ Toolbar not found, cannot show sync status');
        return;
    }
    
    let syncIndicator = document.getElementById('syncIndicator');
    if (!syncIndicator) {
        syncIndicator = document.createElement('div');
        syncIndicator.id = 'syncIndicator';
        syncIndicator.style.cssText = 'margin-left: 10px; padding: 4px 8px; border-radius: 4px; font-size: 12px; transition: opacity 0.3s;';
        toolbar.appendChild(syncIndicator);
    }
    
    syncIndicator.className = `sync-indicator ${status}`;
    
    if (status === 'saving') {
        syncIndicator.textContent = '↻ Saving...';
        syncIndicator.style.color = '#666';
        syncIndicator.style.backgroundColor = '#f0f0f0';
    } else if (status === 'saved') {
        syncIndicator.textContent = '✓ Saved';
        syncIndicator.style.color = '#4caf50';
        syncIndicator.style.backgroundColor = '#e8f5e9';
        setTimeout(() => {
            syncIndicator.style.opacity = '0';
        }, 2000);
    } else if (status === 'error') {
        syncIndicator.textContent = '✗ Sync error';
        syncIndicator.style.color = '#f44336';
        syncIndicator.style.backgroundColor = '#ffebee';
        setTimeout(() => {
            syncIndicator.style.opacity = '0';
        }, 3000);
    }
    
    syncIndicator.style.opacity = '1';
    console.log(`📊 Sync status: ${status}`);
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

function promptMercuryToken() {
    closeAppModal();
    
    chrome.storage.local.get(['mercuryConnected'], (result) => {
        if (result.mercuryConnected) {
            createMercuryCard();
        } else {
            const token = prompt('Enter your Mercury API token:');
            if (token && token.trim()) {
                chrome.storage.local.set({ mercuryToken: token.trim(), mercuryConnected: true }, () => {
                    createMercuryCard();
                });
            }
        }
    });
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
            btn.addEventListener('click', () => {
                chrome.storage.local.remove(['mercuryToken', 'mercuryConnected'], () => {
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
                
                updateBtn.addEventListener('click', () => {
                    chrome.storage.local.remove(['mercuryToken', 'mercuryConnected'], () => {
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
    chrome.storage.local.get(['gmailConnected', 'gmailToken'], (result) => {
        if (result.gmailConnected && result.gmailToken) {
            createGmailCard();
            return;
        }
        
        if (typeof chrome.identity === 'undefined') {
            alert('Gmail authentication requires a valid OAuth client ID. Please check the setup instructions.');
            return;
        }
        
        // Request Gmail scope separately using launchWebAuthFlow
        const clientId = chrome.runtime.getManifest().oauth2.client_id;
        const redirectUri = chrome.identity.getRedirectURL();
        
        // Include all scopes: base scopes + Gmail scope
        const baseScopes = chrome.runtime.getManifest().oauth2.scopes;
        const gmailScope = 'https://www.googleapis.com/auth/gmail.readonly';
        const allScopes = [...baseScopes, gmailScope].join(' ');
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=token&` +
            `scope=${encodeURIComponent(allScopes)}`;
        
        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, (responseUrl) => {
            if (chrome.runtime.lastError) {
                console.error('Gmail auth error:', chrome.runtime.lastError);
                alert('Failed to authenticate with Gmail. Please try again.');
                return;
            }
            
            if (!responseUrl) {
                alert('Failed to authenticate with Gmail. Please try again.');
                return;
            }
            
            // Extract access token from response URL
            const hashPart = responseUrl.split('#')[1];
            if (!hashPart) {
                alert('Failed to authenticate with Gmail. Invalid response.');
                return;
            }
            
            const urlParams = new URLSearchParams(hashPart);
            const token = urlParams.get('access_token');
            const error = urlParams.get('error');
            
            if (error) {
                const errorDescription = urlParams.get('error_description') || error;
                alert(`Gmail authentication failed: ${error}\n\n${errorDescription}`);
                return;
            }
            
            if (token) {
                chrome.storage.local.set({ gmailToken: token, gmailConnected: true }, () => {
                    createGmailCard();
                });
            } else {
                alert('Failed to authenticate with Gmail. No access token received.');
            }
        });
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

async function loadToggledSites() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['toggledSites'], (result) => {
            resolve(result.toggledSites || []);
        });
    });
}

async function saveToggledSites(toggledSites) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ toggledSites: toggledSites }, () => {
            debouncedSync();
            resolve();
        });
    });
}

async function toggleSiteForOpening(domain) {
    const toggledSites = await loadToggledSites();
    const index = toggledSites.indexOf(domain);
    
    if (index > -1) {
        toggledSites.splice(index, 1);
    } else {
        toggledSites.push(domain);
    }
    
    await saveToggledSites(toggledSites);
    return toggledSites.includes(domain);
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
    const toggledSites = await loadToggledSites();
    
    const sitesWithRank = topSites.map((site, index) => ({
        ...site,
        originalRank: index + 1
    }));
    
    const starredList = sitesWithRank.filter(site => starredSites.includes(site.domain));
    const unstarredList = sitesWithRank.filter(site => !starredSites.includes(site.domain));
    const sortedSites = [...starredList, ...unstarredList];
    
    content.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'history-header';
    
    const openTabsBtn = document.createElement('button');
    openTabsBtn.className = 'open-tabs-btn';
    openTabsBtn.textContent = `Open Tabs (${toggledSites.length})`;
    openTabsBtn.disabled = toggledSites.length === 0;
    openTabsBtn.addEventListener('click', async () => {
        const sitesToOpen = await loadToggledSites();
        sitesToOpen.forEach(domain => {
            window.open(`https://${domain}`, '_blank');
        });
    });
    
    header.appendChild(openTabsBtn);
    content.appendChild(header);
    
    const list = document.createElement('div');
    list.className = 'history-list';
    list.id = `history-list-${cardId}`;
    
    sortedSites.forEach((site) => {
        const isStarred = starredSites.includes(site.domain);
        const isToggled = toggledSites.includes(site.domain);
        const siteItem = document.createElement('div');
        siteItem.className = 'history-item' + (isStarred ? ' starred' : '');
        
        const toggleCheckbox = document.createElement('input');
        toggleCheckbox.type = 'checkbox';
        toggleCheckbox.className = 'history-toggle';
        toggleCheckbox.checked = isToggled;
        toggleCheckbox.addEventListener('change', async (e) => {
            e.stopPropagation();
            await toggleSiteForOpening(site.domain);
            
            const updatedCard = document.querySelector(`[data-id="${cardId}"]`);
            if (updatedCard) {
                renderHistoryCard(updatedCard, cardId);
            }
        });
        
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
        
        siteItem.appendChild(toggleCheckbox);
        siteItem.appendChild(rank);
        siteItem.appendChild(favicon);
        siteItem.appendChild(siteInfo);
        siteItem.appendChild(starBtn);
        
        siteItem.addEventListener('click', (e) => {
            if (e.target !== starBtn && e.target !== toggleCheckbox) {
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
    // Check if we're in Microsoft Edge
    if (isMicrosoftEdge()) {
        // For Edge, check if we have a stored token
        chrome.storage.local.get(['userInfo', 'authToken'], async (result) => {
            if (result.userInfo && result.authToken) {
                // Verify token is still valid
                const userInfo = await getUserInfo(result.authToken);
                if (userInfo) {
                    console.log('✅ Edge: User authenticated, userInfo:', userInfo);
                    showAuthenticatedView(userInfo);
                    updateAuthUI(userInfo);
                    currentUserId = userInfo.id;
                    console.log('✅ Edge: currentUserId set to:', currentUserId);
                    // IMPORTANT: Create/update user in DB and load state
                    await createOrUpdateUser(userInfo);
                } else {
                    console.error('❌ Edge: Token invalid, removing auth data');
                    chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                        showUnauthenticatedView();
                        currentUserId = null;
                    });
                }
            } else {
                console.log('ℹ️ Edge: No stored auth data, showing unauthenticated view');
                showUnauthenticatedView();
                currentUserId = null;
            }
        });
        return;
    }
    
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
        if (chrome.runtime.lastError || !token) {
            console.log('ℹ️ Chrome: No auth token, showing unauthenticated view');
            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                showUnauthenticatedView();
                currentUserId = null;
            });
            return;
        }
        
        console.log('🔑 Chrome: Got auth token, fetching user info');
        const userInfo = await getUserInfo(token);
        if (userInfo) {
            console.log('✅ Chrome: User authenticated, userInfo:', userInfo);
            chrome.storage.local.set({ userInfo: userInfo, authToken: token }, async () => {
                showAuthenticatedView(userInfo);
                updateAuthUI(userInfo);
                await createOrUpdateUser(userInfo);
            });
        } else {
            console.error('❌ Chrome: Failed to get user info, removing token');
            chrome.identity.removeCachedAuthToken({ token: token }, () => {
                chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                    showUnauthenticatedView();
                    currentUserId = null;
                });
            });
        }
    });
}

// Show loading state while checking authentication
function showLoadingState() {
    const unauthenticatedView = document.getElementById('unauthenticatedView');
    const toolbar = document.querySelector('.toolbar');
    const canvas = document.getElementById('canvas');
    
    // Hide both views initially (using !important to override inline styles)
    if (unauthenticatedView) {
        unauthenticatedView.style.setProperty('display', 'none', 'important');
    }
    if (toolbar) {
        toolbar.style.setProperty('display', 'none', 'important');
    }
    if (canvas) {
        canvas.style.setProperty('display', 'none', 'important');
    }
    
    // Create or show loading indicator
    let loadingIndicator = document.getElementById('authLoadingIndicator');
    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'authLoadingIndicator';
        loadingIndicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        `;
        
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 40px;
            height: 40px;
            border: 4px solid #f0f0f0;
            border-top-color: #000;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        `;
        
        loadingIndicator.appendChild(spinner);
        document.body.appendChild(loadingIndicator);
    } else {
        loadingIndicator.style.display = 'flex';
    }
}

// Hide loading state
function hideLoadingState() {
    const loadingIndicator = document.getElementById('authLoadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

function showUnauthenticatedView() {
    // Hide loading first
    hideLoadingState();
    
    document.getElementById('unauthenticatedView').style.setProperty('display', 'flex', 'important');
    document.querySelector('.toolbar').style.setProperty('display', 'none', 'important');
    
    const dotsSection = document.querySelector('.unauth-dots');
    if (dotsSection) {
        dotsSection.style.display = 'flex';
        dotsSection.style.overflow = 'visible';
        dotsSection.style.overflowY = 'visible';
        
        // Restore dots pattern
        dotsSection.style.backgroundImage = 'radial-gradient(circle, rgba(22, 22, 22, 0.06) 2px, transparent 2px)';
        dotsSection.style.backgroundSize = '24px 24px';
        dotsSection.style.backgroundPosition = '0 0';
        dotsSection.style.backgroundRepeat = 'repeat';
        
        // Show all card images
        const cardImages = dotsSection.querySelectorAll('.unauth-yellow-card, .unauth-todo-card, .unauth-mercury-card, .unauth-calendar-card, .unauth-ssense-card');
        cardImages.forEach(card => {
            card.style.display = '';
        });
        
        // Hide canvas
        const canvas = dotsSection.querySelector('#canvas');
        if (canvas) {
            canvas.style.display = 'none';
        }
        
        // Hide auth quote text
        const authQuoteText = dotsSection.querySelector('.auth-quote-text');
        if (authQuoteText) {
            authQuoteText.style.display = 'none';
        }
    }
    
    const signinSection = document.querySelector('.unauth-signin-section');
    if (signinSection) {
        signinSection.style.display = 'flex';
    }
    
    const bottomQuote = document.querySelector('.unauth-bottom-quote');
    if (bottomQuote) {
        bottomQuote.style.display = 'block';
    }
    
    document.body.classList.add('unauth-mode');
    updateUnauthenticatedUI();
}

function hideUnauthenticatedView() {
    document.getElementById('unauthenticatedView').style.display = 'none';
    document.querySelector('.toolbar').style.display = 'flex';
    document.getElementById('canvas').style.display = 'block';
    document.body.classList.remove('unauth-mode');
    document.getElementById('signInBtn').style.display = 'block';
    document.getElementById('userProfile').style.display = 'none';
}

function showAuthenticatedView(userInfo) {
    // Hide loading first
    hideLoadingState();
    
    // Keep unauthenticated header visible
    document.getElementById('unauthenticatedView').style.setProperty('display', 'flex', 'important');
    document.querySelector('.toolbar').style.setProperty('display', 'flex', 'important');
    
    // Hide all cards and dots in the dots section, but keep background color (remove dots pattern)
    const dotsSection = document.querySelector('.unauth-dots');
    if (dotsSection) {
        // Hide all card images
        const cardImages = dotsSection.querySelectorAll('.unauth-yellow-card, .unauth-todo-card, .unauth-mercury-card, .unauth-calendar-card, .unauth-ssense-card');
        cardImages.forEach(card => {
            card.style.display = 'none';
        });
        
        // Hide sign-in section
        const signinSection = dotsSection.querySelector('.unauth-signin-section');
        if (signinSection) {
            signinSection.style.display = 'none';
        }
        
        // Remove dots pattern, keep only background color
        dotsSection.style.backgroundImage = 'none';
        
        // Show canvas inside dots section
        const canvas = dotsSection.querySelector('#canvas');
        if (canvas) {
            console.log('Setting up canvas in dots section');
            // Use setProperty with important to override any inline styles
            // Use relative positioning so canvas expands with content and body scrolls
            canvas.style.setProperty('display', 'block', 'important');
            canvas.style.setProperty('position', 'relative', 'important');
            canvas.style.setProperty('width', '100%', 'important');
            canvas.style.setProperty('height', 'auto', 'important');
            canvas.style.setProperty('min-height', '500px', 'important');
            canvas.style.setProperty('overflow', 'visible', 'important');
            canvas.style.setProperty('z-index', '10', 'important');
            canvas.style.setProperty('padding', '0', 'important');
            canvas.style.setProperty('margin', '0', 'important');
            canvas.style.setProperty('pointer-events', 'auto', 'important');
            canvas.style.setProperty('box-sizing', 'border-box', 'important');
            console.log('Canvas display:', canvas.style.display, 'Canvas found:', !!canvas, 'Dots section size:', dotsSection.offsetWidth, 'x', dotsSection.offsetHeight);
        } else {
            console.error('Canvas not found in dots section!');
        }
        
        // Make dots section not scrollable - let body scroll instead
        dotsSection.style.overflow = 'visible';
        dotsSection.style.overflowY = 'visible';
        dotsSection.style.alignItems = 'flex-start';
        dotsSection.style.justifyContent = 'flex-start';
        // Allow dots section to expand beyond viewport
        dotsSection.style.maxHeight = 'none';
        dotsSection.style.height = 'auto';
        // Add margin-top to account for sticky header
        dotsSection.style.marginTop = '24px';
        // Add padding-bottom to account for fixed bottom quote
        dotsSection.style.paddingBottom = '80px';
    }
    
    // Show bottom quote (same as unauthenticated)
    const bottomQuote = document.querySelector('.unauth-bottom-quote');
    if (bottomQuote) {
        bottomQuote.style.display = 'block';
    }
    
    // Hide the auth-quote-text (we're using the bottom quote instead)
    const authQuoteText = document.querySelector('.auth-quote-text');
    if (authQuoteText) {
        authQuoteText.style.display = 'none';
    }
    
    document.body.classList.remove('unauth-mode');
    updateAuthUI(userInfo);
    updateAuthenticatedHeader(userInfo);
    
    // Load and render cards after canvas is visible
    // Clear any existing cards from canvas first, then reload
    const canvas = document.getElementById('canvas');
    if (canvas) {
        // Clear canvas
        canvas.innerHTML = '';
        
        // Adjust card positions if they're outside the dots section bounds
        // Wait a bit for layout to settle, then check and reposition cards
        setTimeout(() => {
            const dotsRect = dotsSection.getBoundingClientRect();
            const maxX = Math.max(dotsRect.width - 300, 400); // Leave some margin, minimum 400px
            const maxY = Math.max(dotsRect.height - 200, 300); // Leave some margin, minimum 300px
            
            chrome.storage.local.get(['cards'], (result) => {
                if (result.cards) {
                    let needsReposition = false;
                    const updatedCards = result.cards.map(card => {
                        const updatedCard = { ...card };
                        // If card is positioned outside dots section, reposition it
                        if (card.x > maxX || card.y > maxY || card.x < 0 || card.y < 0) {
                            updatedCard.x = Math.min(Math.max(card.x, 50), maxX);
                            updatedCard.y = Math.min(Math.max(card.y, 50), maxY);
                            needsReposition = true;
                            console.log('Repositioning card', card.id, 'from', card.x, card.y, 'to', updatedCard.x, updatedCard.y);
                        }
                        return updatedCard;
                    });
                    
                    if (needsReposition) {
                        chrome.storage.local.set({ cards: updatedCards }, () => {
                            // Reload cards after repositioning
                            loadCards();
                        });
                    }
                }
            });
        }, 200);
        
        // Reload and render cards
        loadCards();
        // Update canvas height after cards are rendered
        setTimeout(() => {
            updateCanvasHeight();
        }, 100);
    }
}

function updateUnauthenticatedUI(userInfo = null) {
    const greetingEl = document.getElementById('unauthGreeting');
    const dateWeatherEl = document.getElementById('unauthDateWeather');
    
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Good morning';
    
    if (hour >= 12 && hour < 17) {
        greeting = 'Good afternoon';
    } else if (hour >= 17) {
        greeting = 'Good evening';
    }
    
    // If authenticated, add first name to greeting
    if (userInfo && userInfo.name) {
        const firstName = userInfo.name.split(' ')[0];
        greeting += `, ${firstName}`;
    }
    
    greetingEl.textContent = greeting;
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const day = now.getDate();
    const dateStr = `${dayName}, ${monthName} ${day}${getOrdinalSuffix(day)}`;
    
    dateWeatherEl.textContent = `${dateStr} • Loading weather...`;
    
    fetchWeatherForUnauth(dateWeatherEl);
}

function updateAuthenticatedHeader(userInfo = null) {
    // Update the unauthenticated header elements (we're using the same header for both states)
    const greetingEl = document.getElementById('unauthGreeting');
    const dateWeatherEl = document.getElementById('unauthDateWeather');
    
    if (!greetingEl || !dateWeatherEl) {
        console.warn('Header elements not found');
        return;
    }
    
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Good morning';
    
    if (hour >= 12 && hour < 17) {
        greeting = 'Good afternoon';
    } else if (hour >= 17) {
        greeting = 'Good evening';
    }
    
    // Add first name to greeting if user info is available
    if (userInfo && userInfo.name) {
        const firstName = userInfo.name.split(' ')[0];
        greeting += `, ${firstName}`;
    }
    
    greetingEl.textContent = greeting;
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const day = now.getDate();
    const dateStr = `${dayName}, ${monthName} ${day}${getOrdinalSuffix(day)}`;
    
    dateWeatherEl.textContent = `${dateStr} • Loading weather...`;
    
    fetchWeatherForUnauth(dateWeatherEl);
}

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

async function fetchWeatherForUnauth(element) {
    if (!navigator.geolocation) {
        element.textContent = element.textContent.replace('Loading weather...', 'Weather unavailable');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            const weatherData = await fetchWeatherData(latitude, longitude);
            
            if (weatherData) {
                const current = weatherData.current_weather;
                const tempF = Math.round((current.temperature * 9/5) + 32);
                const weatherDesc = getWeatherDescription(current.weathercode);
                const descText = weatherDesc.split(' ').slice(1).join(' ').toLowerCase();
                
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const now = new Date();
                const dayName = days[now.getDay()];
                const monthName = months[now.getMonth()];
                const day = now.getDate();
                const dateStr = `${dayName}, ${monthName} ${day}${getOrdinalSuffix(day)}`;
                
                element.textContent = `${dateStr} • ${tempF} F° and ${descText}`;
            } else {
                element.textContent = element.textContent.replace('Loading weather...', 'Weather unavailable');
            }
        },
        () => {
            element.textContent = element.textContent.replace('Loading weather...', 'Weather unavailable');
        }
    );
}

async function fetchWeatherForAuth(element) {
    if (!navigator.geolocation) {
        element.textContent = element.textContent.replace('Loading weather...', 'Weather unavailable');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            const weatherData = await fetchWeatherData(latitude, longitude);
            
            if (weatherData) {
                const current = weatherData.current_weather;
                const tempF = Math.round((current.temperature * 9/5) + 32);
                const weatherDesc = getWeatherDescription(current.weathercode);
                const descText = weatherDesc.split(' ').slice(1).join(' ').toLowerCase();
                
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const now = new Date();
                const dayName = days[now.getDay()];
                const monthName = months[now.getMonth()];
                const day = now.getDate();
                const dateStr = `${dayName}, ${monthName} ${day}${getOrdinalSuffix(day)}`;
                
                element.textContent = `${dateStr} • ${tempF}°F, ${descText}`;
            } else {
                element.textContent = element.textContent.replace('Loading weather...', 'Weather unavailable');
            }
        },
        () => {
            element.textContent = element.textContent.replace('Loading weather...', 'Weather unavailable');
        }
    );
}

// Check if running in Microsoft Edge
function isMicrosoftEdge() {
    return navigator.userAgent.indexOf('Edg') !== -1;
}

// Show/hide spinner on sign-in buttons
function setSignInButtonLoading(loading) {
    const signInBtn = document.getElementById('signInBtn');
    const unauthSignInBtn = document.getElementById('unauthSignInBtn');
    
    const buttons = [signInBtn, unauthSignInBtn].filter(btn => btn !== null);
    
    buttons.forEach(btn => {
        if (loading) {
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'wait';
            const originalText = btn.textContent || btn.innerText;
            btn.dataset.originalText = originalText;
            btn.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px;"></span>Signing in...';
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            const originalText = btn.dataset.originalText || 'Sign in';
            if (btn.id === 'signInBtn') {
                btn.textContent = 'Sign in with Google';
            } else {
                btn.textContent = originalText;
            }
        }
    });
}

// Add spinner animation CSS if not already added
if (!document.getElementById('spinner-styles')) {
    const style = document.createElement('style');
    style.id = 'spinner-styles';
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

async function signInWithGoogle() {
    // Show spinner immediately
    setSignInButtonLoading(true);
    
    // Check if we're in Microsoft Edge
    if (isMicrosoftEdge()) {
        // Use alternative OAuth flow for Edge
        const clientId = chrome.runtime.getManifest().oauth2.client_id;
        const redirectUri = chrome.identity.getRedirectURL();
        const scopes = chrome.runtime.getManifest().oauth2.scopes.join(' ');
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=token&` +
            `scope=${encodeURIComponent(scopes)}`;
        
        // Launch OAuth flow - modal opens immediately, so hide spinner
        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, async (responseUrl) => {
            // Hide spinner when callback is triggered (modal opened)
            setSignInButtonLoading(false);
            
            if (chrome.runtime.lastError) {
                console.error('Auth error:', chrome.runtime.lastError);
                const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
                alert(`Authentication failed: ${errorMsg}\n\nPlease check:\n1. Your OAuth client ID is correct\n2. The redirect URI (${redirectUri}) is configured in Google Cloud Console\n3. You're using the correct Google account`);
                return;
            }
            
            if (!responseUrl) {
                alert('Authentication failed: No response received. Please try again.');
                return;
            }
            
            // Extract access token from response URL
            const hashPart = responseUrl.split('#')[1];
            if (!hashPart) {
                alert('Authentication failed: Invalid response URL. Please try again.');
                return;
            }
            
            const urlParams = new URLSearchParams(hashPart);
            const token = urlParams.get('access_token');
            const error = urlParams.get('error');
            
            if (error) {
                const errorDescription = urlParams.get('error_description') || error;
                alert(`Authentication failed: ${error}\n\n${errorDescription}\n\nPlease check your OAuth configuration in Google Cloud Console.`);
                return;
            }
            
            if (!token) {
                alert('Authentication failed: No access token received. Please try again.');
                return;
            }
            
            const userInfo = await getUserInfo(token);
            if (userInfo) {
                chrome.storage.local.set({ userInfo: userInfo, authToken: token }, async () => {
                    showAuthenticatedView(userInfo);
                    updateAuthUI(userInfo);
                    await createOrUpdateUser(userInfo);
                });
            } else {
                alert('Authentication failed: Could not retrieve user information. The token may be invalid. Please try again.');
            }
        });
        // Note: Spinner will be hidden in the callback when modal opens
        return;
    }
    
    // Standard Chrome OAuth flow
    // getAuthToken opens account selector immediately, so we hide spinner after a short delay
    // to ensure the selector UI has appeared
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        // Hide spinner when callback is triggered (account selector appeared)
        setSignInButtonLoading(false);
        
        if (chrome.runtime.lastError) {
            console.error('Auth error:', chrome.runtime.lastError);
            const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
            alert(`Authentication failed: ${errorMsg}\n\nPlease check:\n1. Your OAuth client ID is correct\n2. The redirect URI is configured in Google Cloud Console\n3. You're using the correct Google account`);
            return;
        }
        
        if (!token) {
            alert('Authentication failed: No token received. Please try again.');
            return;
        }
        
        const userInfo = await getUserInfo(token);
        if (userInfo) {
            chrome.storage.local.set({ userInfo: userInfo, authToken: token }, async () => {
                showAuthenticatedView(userInfo);
                updateAuthUI(userInfo);
                await createOrUpdateUser(userInfo);
            });
        } else {
            alert('Authentication failed: Could not retrieve user information. The token may be invalid or expired. Please try again.');
            // Remove invalid token
            chrome.identity.removeCachedAuthToken({ token: token }, () => {
                console.log('Removed invalid cached token');
            });
        }
    });
    
    // For Chrome, hide spinner after a brief delay to ensure account selector UI appears
    // The actual hiding happens in the callback, but this is a fallback
    setTimeout(() => {
        // Only hide if still loading (callback hasn't fired yet)
        const signInBtn = document.getElementById('signInBtn');
        if (signInBtn && signInBtn.disabled) {
            // Account selector should be visible by now
            setSignInButtonLoading(false);
        }
    }, 500);
}

async function signOutFromGoogle() {
    chrome.storage.local.get(['authToken'], (result) => {
        if (result.authToken) {
            // Only try to remove cached token if not in Edge
            if (!isMicrosoftEdge()) {
                chrome.identity.removeCachedAuthToken({ token: result.authToken }, () => {
                    chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                        showUnauthenticatedView();
                        currentUserId = null;
                    });
                });
            } else {
                // For Edge, just remove from storage
                chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                    showUnauthenticatedView();
                    currentUserId = null;
                });
            }
        } else {
            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                showUnauthenticatedView();
                currentUserId = null;
            });
        }
    });
}

async function getUserInfo(token) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            return await response.json();
        }
        
        if (response.status === 401) {
            // Only try to remove cached token if not in Edge
            if (!isMicrosoftEdge()) {
                chrome.identity.removeCachedAuthToken({ token: token }, () => {
                    console.log('Removed invalid cached token');
                });
            } else {
                // For Edge, just log the error
                console.log('Invalid token detected');
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching user info:', error);
        return null;
    }
}

function updateAuthUI(userInfo) {
    document.getElementById('signInBtn').style.display = 'none';
    document.getElementById('userProfile').style.display = 'flex';
    document.getElementById('userName').textContent = userInfo.name || userInfo.email;
    
    if (userInfo.picture) {
        document.getElementById('userAvatar').src = userInfo.picture;
    } else {
        document.getElementById('userAvatar').style.display = 'none';
    }
}
