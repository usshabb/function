// Storage and backend synchronization module

// Dependencies: config.js, state.js, card-core.js, card-layout.js

function saveCards() {
    chrome.storage.local.set({ cards: State.getCards() });
    debouncedSync();
}

function loadCards() {
    chrome.storage.local.get(['cards'], (result) => {
        const canvas = document.getElementById('canvas');
        console.log('loadCards called, canvas found:', !!canvas, 'canvas display:', canvas?.style.display);
        
        if (result.cards) {
            State.setCards(result.cards);
            const cards = State.getCards();
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
                // Ensure width and height exist for old cards
                if (!card.width) card.width = getDefaultCardWidth(card.type);
                if (!card.height) card.height = getDefaultCardHeight(card.type);
                // Reset exactPosition to force rearrangement with new 12px spacing
                // This ensures all cards (including app cards) align properly
                card.exactPosition = false;
                console.log('Rendering card:', card.type, 'at', card.x, card.y, 'exactPosition:', card.exactPosition);
                renderCard(card);
            });
            // Always arrange in masonry to ensure proper 12px spacing for all cards
            setTimeout(() => {
                arrangeMasonryLayout();
                updateCanvasHeight();
            }, 100);
            console.log('Cards rendered, total cards in DOM:', document.querySelectorAll('.card').length);
        } else {
            console.log('No cards found in storage');
        }
    });
}

function debouncedSync() {
    const currentUserId = State.getCurrentUserId();
    if (!currentUserId) {
        console.warn('⚠️ debouncedSync called but currentUserId is null/undefined');
        return;
    }
    
    console.log('⏱️ Debouncing sync (will sync in 2 seconds)...');
    const syncTimeout = State.getSyncTimeout();
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }
    
    const newTimeout = setTimeout(() => {
        syncStateToBackend();
    }, 2000);
    State.setSyncTimeout(newTimeout);
}

async function syncStateToBackend() {
    const currentUserId = State.getCurrentUserId();
    if (!currentUserId) {
        console.error('❌ Cannot sync: currentUserId is null/undefined');
        return;
    }
    
    try {
        console.log('🔄 Starting sync to backend for user:', currentUserId);
        showSyncStatus('saving');
        
        // Sync tokens to backend
        await syncTokensToBackend();
        
        const cards = State.getCards();
        const tasks = State.getTasks();
        const reminders = State.getReminders();
        
        const state = {
            cards: cards,
            tasks: tasks,
            reminders: reminders,
            starredSites: await getStarredSites(),
            rssFeeds: await getAllRssFeeds(),
            toggledSites: await loadToggledSites()
        };
        
        console.log('📤 Sending state to:', `${API_URL}/api/state/${currentUserId}`);
        console.log('📊 State data:', {
            cards: cards.length,
            tasks: tasks.length,
            reminders: reminders.length,
            starredSites: state.starredSites?.length || 0,
            rssFeeds: Object.keys(state.rssFeeds || {}).length,
            toggledSites: state.toggledSites?.length || 0
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

async function syncTokensToBackend() {
    const currentUserId = State.getCurrentUserId();
    if (!currentUserId) return;
    
    try {
        // Sync Mercury token
        const mercuryData = await new Promise((resolve) => {
            chrome.storage.local.get(['mercuryToken', 'mercuryConnected'], resolve);
        });
        if (mercuryData.mercuryToken && mercuryData.mercuryConnected) {
            try {
                await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token: mercuryData.mercuryToken })
                });
                console.log('✅ Mercury token synced to backend');
            } catch (error) {
                console.error('❌ Failed to sync Mercury token:', error);
            }
        }
        
        // Sync Gmail token
        const gmailData = await new Promise((resolve) => {
            chrome.storage.local.get(['gmailToken', 'gmailConnected'], resolve);
        });
        if (gmailData.gmailToken && gmailData.gmailConnected) {
            try {
                await fetch(`${API_URL}/api/tokens/${currentUserId}/gmail`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token: gmailData.gmailToken })
                });
                console.log('✅ Gmail token synced to backend');
            } catch (error) {
                console.error('❌ Failed to sync Gmail token:', error);
            }
        }
    } catch (error) {
        console.error('❌ Token sync error:', error);
    }
}

async function loadStateFromBackend() {
    const currentUserId = State.getCurrentUserId();
    if (!currentUserId) return;
    
    try {
        // Load tokens from backend
        await loadTokensFromBackend();
        
        const response = await fetch(`${API_URL}/api/state/${currentUserId}`);
        const data = await response.json();
        
        if (data.state && Object.keys(data.state).length > 0) {
            if (data.state.cards) {
                State.setCards(data.state.cards);
                chrome.storage.local.set({ cards: State.getCards() });
                document.getElementById('canvas').innerHTML = '';
                // Reset exactPosition for all cards to ensure proper 12px spacing
                State.getCards().forEach(card => {
                    card.exactPosition = false;
                    renderCard(card);
                });
                // Arrange all cards with proper 12px spacing
                setTimeout(() => {
                    arrangeMasonryLayout();
                    updateCanvasHeight();
                }, 100);
            }
            
            if (data.state.tasks) {
                State.setTasks(data.state.tasks);
                chrome.storage.local.set({ tasks: State.getTasks() });
            }
            
            if (data.state.reminders) {
                State.setReminders(data.state.reminders);
                chrome.storage.local.set({ reminders: State.getReminders() });
            }
            
            if (data.state.starredSites) {
                chrome.storage.local.set({ starredSites: data.state.starredSites });
            }
            
            if (data.state.rssFeeds) {
                for (const [cardId, feeds] of Object.entries(data.state.rssFeeds)) {
                    chrome.storage.local.set({ [`rssFeeds_${cardId}`]: feeds });
                }
            }
            
            if (data.state.toggledSites) {
                chrome.storage.local.set({ toggledSites: data.state.toggledSites });
            }
        }
    } catch (error) {
        console.error('Load state error:', error);
    }
}

async function loadTokensFromBackend() {
    const currentUserId = State.getCurrentUserId();
    if (!currentUserId) return;
    
    try {
        // Load Mercury token
        const mercuryResponse = await fetch(`${API_URL}/api/tokens/${currentUserId}/mercury`);
        const mercuryData = await mercuryResponse.json();
        if (mercuryData.token) {
            chrome.storage.local.set({ mercuryToken: mercuryData.token, mercuryConnected: true });
            console.log('✅ Mercury token loaded from backend');
        }
        
        // Load Gmail token
        const gmailResponse = await fetch(`${API_URL}/api/tokens/${currentUserId}/gmail`);
        const gmailData = await gmailResponse.json();
        if (gmailData.token) {
            chrome.storage.local.set({ gmailToken: gmailData.token, gmailConnected: true });
            console.log('✅ Gmail token loaded from backend');
        }
    } catch (error) {
        console.error('❌ Failed to load tokens from backend:', error);
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
            State.setCurrentUserId(userInfo.id);
            console.log('✅ currentUserId is now:', State.getCurrentUserId());
            await migrateLocalDataToBackend();
            await loadStateFromBackend();
            // Test sync after a short delay to ensure everything is loaded
            setTimeout(() => {
                console.log('🧪 Testing sync after authentication...');
                if (State.getCurrentUserId()) {
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
    const cards = State.getCards();
    const tasks = State.getTasks();
    const reminders = State.getReminders();
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

async function loadToggledSites() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['toggledSites'], (result) => {
            resolve(result.toggledSites || []);
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

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveCards,
        loadCards,
        debouncedSync,
        syncStateToBackend,
        syncTokensToBackend,
        loadStateFromBackend,
        loadTokensFromBackend,
        createOrUpdateUser,
        migrateLocalDataToBackend,
        getStarredSites,
        getAllRssFeeds,
        loadToggledSites,
        showSyncStatus
    };
}

