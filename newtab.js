let cards = [];
let draggedCard = null;
let offset = { x: 0, y: 0 };

document.addEventListener('DOMContentLoaded', () => {
    loadCards();
    
    document.getElementById('addNote').addEventListener('click', () => createCard('note'));
    document.getElementById('addLink').addEventListener('click', () => createCard('link'));
    document.getElementById('addApp').addEventListener('click', openAppModal);
    document.getElementById('closeModal').addEventListener('click', closeAppModal);
    
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
    }
    
    cardEl.appendChild(content);
    
    cardEl.addEventListener('mousedown', startDrag);
    
    document.getElementById('canvas').appendChild(cardEl);
    
    if (card.type === 'mercury') {
        renderMercuryCard(cardEl, card.id);
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
}

function loadCards() {
    chrome.storage.local.get(['cards'], (result) => {
        if (result.cards) {
            cards = result.cards;
            cards.forEach(card => renderCard(card));
            updateCanvasHeight();
        }
    });
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
    }
}

function promptMercuryToken() {
    closeAppModal();
    
    chrome.storage.local.get(['mercuryToken'], (result) => {
        if (result.mercuryToken) {
            createMercuryCard(result.mercuryToken);
        } else {
            const token = prompt('Enter your Mercury API token:');
            if (token && token.trim()) {
                chrome.storage.local.set({ mercuryToken: token.trim() }, () => {
                    createMercuryCard(token.trim());
                });
            }
        }
    });
}

async function createMercuryCard(token) {
    const card = {
        id: Date.now().toString(),
        type: 'mercury',
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 150,
        content: JSON.stringify({ token: token })
    };
    
    cards.push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

async function fetchMercuryData(token) {
    try {
        const accountsResponse = await fetch('https://api.mercury.com/api/v1/accounts', {
            headers: {
                'Authorization': `Bearer ${token}`,
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
        
        const transactionsResponse = await fetch(`https://api.mercury.com/api/v1/account/${checkingAccount.id}/transactions?limit=10`, {
            headers: {
                'Authorization': `Bearer ${token}`,
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
    
    const card = cards.find(c => c.id === cardId);
    const data = JSON.parse(card.content);
    
    fetchMercuryData(data.token).then(mercuryData => {
        if (!mercuryData) {
            content.innerHTML = `
                <div class="error-message">Failed to load Mercury data. Please check your API token.</div>
                <button class="connect-btn" style="margin-top: 12px;">Update Token</button>
            `;
            const btn = content.querySelector('.connect-btn');
            btn.addEventListener('click', () => {
                chrome.storage.local.remove('mercuryToken', () => {
                    deleteCard(cardId);
                    promptMercuryToken();
                });
            });
            return;
        }
        
        content.innerHTML = `
            <div class="app-connected">✓ Connected to Mercury</div>
            <div class="account-label">${mercuryData.accountName}</div>
            <div class="account-balance">$${(mercuryData.balance / 100).toFixed(2)}</div>
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
                
                const amount = transaction.amount / 100;
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
}
