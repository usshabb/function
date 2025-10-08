import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, onSnapshot, deleteDoc, query, where, updateDoc } from './firebase-init.js';

let cards = [];
let draggedCard = null;
let offset = { x: 0, y: 0 };
let tasks = [];
let reminders = [];
let reminderCheckInterval = null;
let currentUser = null;
let unsubscribeListeners = [];

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    
    document.getElementById('addNote').addEventListener('click', () => createCard('note'));
    document.getElementById('addLink').addEventListener('click', () => createCard('link'));
    document.getElementById('addApp').addEventListener('click', openAppModal);
    document.getElementById('closeModal').addEventListener('click', closeAppModal);
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
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

function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            updateAuthUI(user);
            await migrateLocalDataToFirestore();
            await loadUserData();
            setupRealtimeListeners();
            startReminderChecker();
        } else {
            currentUser = null;
            updateAuthUI(null);
            loadCards();
            loadTasks();
            loadReminders();
            startReminderChecker();
        }
    });
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const userEmail = document.getElementById('userEmail');
    
    if (user) {
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userEmail.textContent = user.email;
    } else {
        loginBtn.style.display = 'block';
        userInfo.style.display = 'none';
    }
}

async function handleLogin() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error('Login error:', error);
        alert('Failed to login. Please try again.');
    }
}

async function handleLogout() {
    try {
        unsubscribeListeners.forEach(unsub => unsub());
        unsubscribeListeners = [];
        cards = [];
        tasks = [];
        reminders = [];
        document.getElementById('canvas').innerHTML = '';
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
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

async function deleteCard(cardId) {
    cards = cards.filter(c => c.id !== cardId);
    const cardEl = document.querySelector(`[data-id="${cardId}"]`);
    if (cardEl) {
        cardEl.remove();
    }
    
    if (currentUser) {
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'cards', cardId));
        } catch (error) {
            console.error('Error deleting card from Firestore:', error);
        }
    }
    
    await saveCards();
    updateCanvasHeight();
}

async function saveCards() {
    if (currentUser) {
        await saveCardsToFirestore();
    } else {
        chrome.storage.local.set({ cards: cards });
    }
}

async function saveCardsToFirestore() {
    if (!currentUser) return;
    
    try {
        const userCardsRef = collection(db, 'users', currentUser.uid, 'cards');
        
        for (const card of cards) {
            await setDoc(doc(userCardsRef, card.id), card);
        }
    } catch (error) {
        console.error('Error saving cards to Firestore:', error);
    }
}

function loadCards() {
    chrome.storage.local.get(['cards'], (result) => {
        if (result.cards) {
            cards = result.cards;
            
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
            
            cards.forEach(card => renderCard(card));
            updateCanvasHeight();
        }
    });
}

async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userCardsRef = collection(db, 'users', currentUser.uid, 'cards');
        const cardsSnapshot = await getDocs(userCardsRef);
        cards = [];
        cardsSnapshot.forEach((doc) => {
            cards.push(doc.data());
        });
        cards.forEach(card => renderCard(card));
        updateCanvasHeight();
        
        const userTasksRef = collection(db, 'users', currentUser.uid, 'tasks');
        const tasksSnapshot = await getDocs(userTasksRef);
        tasks = [];
        tasksSnapshot.forEach((doc) => {
            tasks.push(doc.data());
        });
        
        const userRemindersRef = collection(db, 'users', currentUser.uid, 'reminders');
        const remindersSnapshot = await getDocs(userRemindersRef);
        reminders = [];
        remindersSnapshot.forEach((doc) => {
            reminders.push(doc.data());
        });
        
        const userCredsDoc = await getDoc(doc(db, 'users', currentUser.uid, 'credentials', 'tokens'));
        if (userCredsDoc.exists()) {
            const creds = userCredsDoc.data();
            if (creds.mercuryToken) {
                chrome.storage.local.set({ mercuryToken: creds.mercuryToken, mercuryConnected: true });
            }
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function migrateLocalDataToFirestore() {
    if (!currentUser) return;
    
    const migrationKey = `migrated_${currentUser.uid}`;
    const migrated = localStorage.getItem(migrationKey);
    
    if (migrated) return;
    
    try {
        chrome.storage.local.get(['cards', 'tasks', 'reminders', 'mercuryToken', 'mercuryConnected'], async (result) => {
            if (result.cards && result.cards.length > 0) {
                const userCardsRef = collection(db, 'users', currentUser.uid, 'cards');
                for (const card of result.cards) {
                    await setDoc(doc(userCardsRef, card.id), card);
                }
            }
            
            if (result.tasks && result.tasks.length > 0) {
                const userTasksRef = collection(db, 'users', currentUser.uid, 'tasks');
                for (const task of result.tasks) {
                    await setDoc(doc(userTasksRef, task.id), task);
                }
            }
            
            if (result.reminders && result.reminders.length > 0) {
                const userRemindersRef = collection(db, 'users', currentUser.uid, 'reminders');
                for (const reminder of result.reminders) {
                    await setDoc(doc(userRemindersRef, reminder.id), reminder);
                }
            }
            
            if (result.mercuryToken) {
                await setDoc(doc(db, 'users', currentUser.uid, 'credentials', 'tokens'), {
                    mercuryToken: result.mercuryToken,
                    mercuryConnected: result.mercuryConnected || false
                });
            }
            
            localStorage.setItem(migrationKey, 'true');
        });
    } catch (error) {
        console.error('Error migrating data:', error);
    }
}

function setupRealtimeListeners() {
    if (!currentUser) return;
    
    const userCardsRef = collection(db, 'users', currentUser.uid, 'cards');
    const cardsUnsubscribe = onSnapshot(userCardsRef, (snapshot) => {
        cards = [];
        snapshot.forEach((doc) => {
            cards.push(doc.data());
        });
        document.getElementById('canvas').innerHTML = '';
        cards.forEach(card => renderCard(card));
        updateCanvasHeight();
    });
    unsubscribeListeners.push(cardsUnsubscribe);
    
    const userTasksRef = collection(db, 'users', currentUser.uid, 'tasks');
    const tasksUnsubscribe = onSnapshot(userTasksRef, (snapshot) => {
        tasks = [];
        snapshot.forEach((doc) => {
            tasks.push(doc.data());
        });
        document.querySelectorAll('[id^="tasks-list-"]').forEach(list => {
            renderTasksList(list);
        });
    });
    unsubscribeListeners.push(tasksUnsubscribe);
    
    const userRemindersRef = collection(db, 'users', currentUser.uid, 'reminders');
    const remindersUnsubscribe = onSnapshot(userRemindersRef, (snapshot) => {
        reminders = [];
        snapshot.forEach((doc) => {
            reminders.push(doc.data());
        });
        document.querySelectorAll('[id^="reminders-list-"]').forEach(list => {
            renderRemindersList(list);
        });
    });
    unsubscribeListeners.push(remindersUnsubscribe);
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
    }
}

async function promptMercuryToken() {
    closeAppModal();
    
    chrome.storage.local.get(['mercuryConnected'], async (result) => {
        if (result.mercuryConnected) {
            createMercuryCard();
        } else {
            const token = prompt('Enter your Mercury API token:');
            if (token && token.trim()) {
                chrome.storage.local.set({ mercuryToken: token.trim(), mercuryConnected: true }, async () => {
                    if (currentUser) {
                        try {
                            await setDoc(doc(db, 'users', currentUser.uid, 'credentials', 'tokens'), {
                                mercuryToken: token.trim(),
                                mercuryConnected: true
                            });
                        } catch (error) {
                            console.error('Error saving Mercury token to Firestore:', error);
                        }
                    }
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
        deleteBtn.addEventListener('click', async () => {
            const taskId = task.id;
            tasks = tasks.filter(t => t.id !== taskId);
            
            if (currentUser) {
                try {
                    await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', taskId));
                } catch (error) {
                    console.error('Error deleting task from Firestore:', error);
                }
            }
            
            await saveTasks();
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

async function saveTasks() {
    if (currentUser) {
        await saveTasksToFirestore();
    } else {
        chrome.storage.local.set({ tasks: tasks });
    }
}

async function saveTasksToFirestore() {
    if (!currentUser) return;
    
    try {
        const userTasksRef = collection(db, 'users', currentUser.uid, 'tasks');
        
        for (const task of tasks) {
            await setDoc(doc(userTasksRef, task.id), task);
        }
    } catch (error) {
        console.error('Error saving tasks to Firestore:', error);
    }
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
        deleteBtn.addEventListener('click', async () => {
            const reminderId = reminder.id;
            reminders = reminders.filter(r => r.id !== reminderId);
            
            if (currentUser) {
                try {
                    await deleteDoc(doc(db, 'users', currentUser.uid, 'reminders', reminderId));
                } catch (error) {
                    console.error('Error deleting reminder from Firestore:', error);
                }
            }
            
            await saveReminders();
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

async function saveReminders() {
    if (currentUser) {
        await saveRemindersToFirestore();
    } else {
        chrome.storage.local.set({ reminders: reminders });
    }
}

async function saveRemindersToFirestore() {
    if (!currentUser) return;
    
    try {
        const userRemindersRef = collection(db, 'users', currentUser.uid, 'reminders');
        
        for (const reminder of reminders) {
            await setDoc(doc(userRemindersRef, reminder.id), reminder);
        }
    } catch (error) {
        console.error('Error saving reminders to Firestore:', error);
    }
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
