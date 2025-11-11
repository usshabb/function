// Gmail card module

// Dependencies: config.js, state.js, card-core.js, storage.js

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
        
        const clientId = chrome.runtime.getManifest().oauth2.client_id;
        const redirectUri = chrome.identity.getRedirectURL();
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
                chrome.storage.local.set({ gmailToken: token, gmailConnected: true }, async () => {
                    const currentUserId = State.getCurrentUserId();
                    if (currentUserId) {
                        try {
                            await fetch(`${API_URL}/api/tokens/${currentUserId}/gmail`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token: token })
                            });
                            console.log('✅ Gmail token synced to backend');
                        } catch (error) {
                            console.error('❌ Failed to sync Gmail token:', error);
                        }
                    }
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
    
    State.getCards().push(card);
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
            btn.addEventListener('click', async () => {
                const currentUserId = State.getCurrentUserId();
                if (currentUserId) {
                    try {
                        await fetch(`${API_URL}/api/tokens/${currentUserId}/gmail`, {
                            method: 'DELETE'
                        });
                        console.log('✅ Gmail token deleted from backend');
                    } catch (error) {
                        console.error('❌ Failed to delete Gmail token:', error);
                    }
                }
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
                
                reconnectBtn.addEventListener('click', async () => {
                    const currentUserId = State.getCurrentUserId();
                    if (currentUserId) {
                        try {
                            await fetch(`${API_URL}/api/tokens/${currentUserId}/gmail`, {
                                method: 'DELETE'
                            });
                            console.log('✅ Gmail token deleted from backend');
                        } catch (error) {
                            console.error('❌ Failed to delete Gmail token:', error);
                        }
                    }
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

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        authenticateGmail,
        createGmailCard,
        fetchGmailMessages,
        renderGmailCard
    };
}

