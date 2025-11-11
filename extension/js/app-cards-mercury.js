// Mercury banking card module

// Dependencies: config.js, state.js, card-core.js, storage.js

function promptMercuryToken() {
    closeAppModal();
    
    chrome.storage.local.get(['mercuryConnected'], (result) => {
        if (result.mercuryConnected) {
            createMercuryCard();
        } else {
            const token = prompt('Enter your Mercury API token:');
            if (token && token.trim()) {
                chrome.storage.local.set({ mercuryToken: token.trim(), mercuryConnected: true }, async () => {
                    // Sync token to backend
                    const currentUserId = State.getCurrentUserId();
                    if (currentUserId) {
                        try {
                            await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token: token.trim() })
                            });
                            console.log('✅ Mercury token synced to backend');
                        } catch (error) {
                            console.error('❌ Failed to sync Mercury token:', error);
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
    
    State.getCards().push(card);
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
                const currentUserId = State.getCurrentUserId();
                if (currentUserId) {
                    try {
                        await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`, {
                            method: 'DELETE'
                        });
                        console.log('✅ Mercury token deleted from backend');
                    } catch (error) {
                        console.error('❌ Failed to delete Mercury token:', error);
                    }
                }
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
                
                updateBtn.addEventListener('click', async () => {
                    const currentUserId = State.getCurrentUserId();
                    if (currentUserId) {
                        try {
                            await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`, {
                                method: 'DELETE'
                            });
                            console.log('✅ Mercury token deleted from backend');
                        } catch (error) {
                            console.error('❌ Failed to delete Mercury token:', error);
                        }
                    }
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

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        promptMercuryToken,
        createMercuryCard,
        fetchMercuryData,
        renderMercuryCard
    };
}

