let cards = [];
let draggedCard = null;
let offset = { x: 0, y: 0 };
let tasks = [];
let reminders = [];
let reminderCheckInterval = null;
let resizingCard = null;
let resizeHandle = null;
let masonryGap = 12; // Gap between cards in masonry layout
let masonryColumnWidth = 280; // Base column width for masonry
let dragOverCard = null; // Card being dragged over
let dropIndicator = null; // Visual indicator for drop zone

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
    
    // Handle window resize to rearrange masonry layout
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            arrangeMasonryLayout();
            updateCanvasHeight();
        }, 250);
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
    const card = {
        id: Date.now().toString(),
        type: type,
        x: data.x || 0,
        y: data.y || 0,
        width: data.width || getDefaultCardWidth(type),
        height: data.height || getDefaultCardHeight(type),
        content: data.content || '',
        exactPosition: true // Flag to preserve exact position
    };
    
    cards.push(card);
    renderCard(card);
    // Only arrange in masonry if no exact position was provided
    if (!data.x && !data.y) {
        arrangeMasonryLayout();
    }
    saveCards();
    updateCanvasHeight();
}

function getDefaultCardWidth(type) {
    const widths = {
        'mercury': 350,
        'gmail': 400,
        'tasks': 350,
        'reminder': 350,
        'ssense': 500,
        'weather': 300,
        'history': 350,
        'rss': 450,
        'note': 300,
        'link': 300,
        'chatgpt': 400,
        'google': 400
    };
    return widths[type] || 300;
}

function getDefaultCardHeight(type) {
    const heights = {
        'mercury': 400,
        'gmail': 500,
        'tasks': 300,
        'reminder': 200,
        'ssense': 600,
        'weather': 250,
        'history': 500,
        'rss': 600,
        'note': 200,
        'link': 150,
        'chatgpt': 500,
        'google': 300
    };
    return heights[type] || 200;
}

function renderCard(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;
    cardEl.style.left = card.x + 'px';
    cardEl.style.top = card.y + 'px';
    cardEl.style.width = (card.width || getDefaultCardWidth(card.type)) + 'px';
    cardEl.style.height = (card.height || getDefaultCardHeight(card.type)) + 'px';
    
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
    } else if (card.type === 'chatgpt') {
        cardEl.style.cursor = 'default';
    } else if (card.type === 'google') {
        cardEl.style.cursor = 'default';
    } else if (card.type === 'tasks') {
        cardEl.style.cursor = 'default';
    } else if (card.type === 'reminder') {
        cardEl.style.cursor = 'default';
    }
    
    cardEl.appendChild(content);
    
    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.style.cssText = 'position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nwse-resize; background: transparent; z-index: 10;';
    cardEl.appendChild(resizeHandle);
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startResize(card.id, e);
    });
    
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
    // Don't start drag if clicking on interactive elements or resize handle
    if (e.target.tagName === 'TEXTAREA' || 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'BUTTON' || 
        e.target.tagName === 'A' ||
        e.target.classList.contains('resize-handle') ||
        e.target.closest('.resize-handle')) {
        return;
    }
    
    draggedCard = e.currentTarget;
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const cardRect = draggedCard.getBoundingClientRect();
    
    // Calculate offset relative to canvas, accounting for current card position
    offset.x = e.clientX - cardRect.left;
    offset.y = e.clientY - cardRect.top;
    
    // Store initial position for reference
    const initialLeft = parseInt(draggedCard.style.left) || 0;
    const initialTop = parseInt(draggedCard.style.top) || 0;
    draggedCard.dataset.initialX = initialLeft;
    draggedCard.dataset.initialY = initialTop;
    
    draggedCard.classList.add('dragging');
    draggedCard.style.zIndex = '1000';
    draggedCard.style.transition = 'none';
    draggedCard.style.opacity = '0.8';
    draggedCard.style.transform = 'rotate(2deg) scale(1.02)';
    draggedCard.style.pointerEvents = 'none'; // Prevent interference with hover detection
    
    // Create drop indicator
    createDropIndicator();
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
    e.stopPropagation();
}

function drag(e) {
    if (!draggedCard) return;
    
    // Get canvas position to calculate relative coordinates
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate position relative to canvas, accounting for scroll
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const x = e.clientX - canvasRect.left - offset.x;
    const y = e.clientY - canvasRect.top - offset.y;
    
    // Ensure card doesn't go outside canvas bounds
    const cardWidth = draggedCard.offsetWidth;
    const cardHeight = draggedCard.offsetHeight;
    const minX = 0;
    const minY = 0;
    const maxX = canvasRect.width - cardWidth;
    const maxY = Math.max(canvasRect.height - cardHeight, minY);
    
    const clampedX = Math.max(minX, Math.min(maxX, x));
    const clampedY = Math.max(minY, Math.min(maxY, y));
    
    // Update dragged card position smoothly
    draggedCard.style.transition = 'none';
    draggedCard.style.left = clampedX + 'px';
    draggedCard.style.top = clampedY + 'px';
    
    // Auto-scroll when dragging near viewport edges
    const scrollThreshold = 80; // Distance from edge to trigger scroll
    const scrollSpeed = 15; // Pixels to scroll per frame
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Vertical scrolling - more aggressive for better UX
    if (e.clientY < scrollThreshold && window.scrollY > 0) {
        // Near top - scroll up
        const scrollAmount = Math.min(scrollSpeed, window.scrollY);
        window.scrollBy(0, -scrollAmount);
        // Adjust card position to account for scroll
        draggedCard.style.top = (parseInt(draggedCard.style.top) || 0) - scrollAmount + 'px';
    } else if (e.clientY > viewportHeight - scrollThreshold) {
        // Near bottom - scroll down
        window.scrollBy(0, scrollSpeed);
        // Adjust card position to account for scroll
        draggedCard.style.top = (parseInt(draggedCard.style.top) || 0) + scrollSpeed + 'px';
    }
    
    // Horizontal scrolling (if needed)
    if (e.clientX < scrollThreshold && window.scrollX > 0) {
        // Near left - scroll left
        const scrollAmount = Math.min(scrollSpeed, window.scrollX);
        window.scrollBy(-scrollAmount, 0);
        draggedCard.style.left = (parseInt(draggedCard.style.left) || 0) - scrollAmount + 'px';
    } else if (e.clientX > viewportWidth - scrollThreshold) {
        // Near right - scroll right
        window.scrollBy(scrollSpeed, 0);
        draggedCard.style.left = (parseInt(draggedCard.style.left) || 0) + scrollSpeed + 'px';
    }
    
    // Check which card we're hovering over (exclude the dragged card)
    const hoveredCard = getCardAtPosition(e.clientX, e.clientY);
    
    if (hoveredCard && hoveredCard !== draggedCard && hoveredCard !== dragOverCard) {
        // Show drop indicator on the hovered card
        showDropIndicator(hoveredCard);
        dragOverCard = hoveredCard;
    } else if (!hoveredCard && dragOverCard) {
        // Hide drop indicator if not over any card
        hideDropIndicator();
        dragOverCard = null;
    }
    
    e.preventDefault();
    e.stopPropagation();
}

function getCardAtPosition(clientX, clientY) {
    // Get all cards except the one being dragged
    const allCards = Array.from(document.querySelectorAll('.card')).filter(card => 
        !card.classList.contains('dragging') && card !== draggedCard
    );
    
    // Check cards in reverse order (top to bottom) to get the topmost card
    for (let i = allCards.length - 1; i >= 0; i--) {
        const card = allCards[i];
        const rect = card.getBoundingClientRect();
        
        // Check if point is within card bounds
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
            return card;
        }
    }
    return null;
}

function createDropIndicator() {
    if (dropIndicator) return;
    
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
    dropIndicator.style.cssText = `
        position: absolute;
        border: 2px dashed #2383e2;
        background: rgba(35, 131, 226, 0.1);
        border-radius: 8px;
        pointer-events: none;
        z-index: 999;
        display: none;
        transition: all 0.2s ease;
    `;
    document.getElementById('canvas').appendChild(dropIndicator);
}

function showDropIndicator(targetCard) {
    if (!dropIndicator || !targetCard) return;
    
    const rect = targetCard.getBoundingClientRect();
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    dropIndicator.style.display = 'block';
    dropIndicator.style.left = (rect.left - canvasRect.left) + 'px';
    dropIndicator.style.top = (rect.top - canvasRect.top) + 'px';
    dropIndicator.style.width = rect.width + 'px';
    dropIndicator.style.height = rect.height + 'px';
    
    targetCard.classList.add('drop-target');
}

function hideDropIndicator() {
    if (!dropIndicator) return;
    dropIndicator.style.display = 'none';
    
    // Remove drop-target class from all cards
    document.querySelectorAll('.card.drop-target').forEach(card => {
        card.classList.remove('drop-target');
    });
}

function checkCardOverlap(cardX, cardY, cardWidth, cardHeight, excludeCardId) {
    // Check if a card at the given position would overlap with any other card
    for (const card of cards) {
        if (card.id === excludeCardId) continue;
        
        const otherX = card.x || 0;
        const otherY = card.y || 0;
        const otherWidth = card.width || getDefaultCardWidth(card.type);
        const otherHeight = card.height || getDefaultCardHeight(card.type);
        
        // Check for overlap
        if (!(cardX + cardWidth <= otherX || 
              cardX >= otherX + otherWidth || 
              cardY + cardHeight <= otherY || 
              cardY >= otherY + otherHeight)) {
            return true; // Overlap detected
        }
    }
    return false; // No overlap
}

function findNearestMasonryPosition(cardWidth, cardHeight, excludeCardId) {
    // Find the nearest valid masonry position that doesn't overlap
    const canvas = document.getElementById('canvas');
    if (!canvas) return { x: 0, y: 0 };
    
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width || window.innerWidth;
    const startX = masonryGap;
    const startY = masonryGap;
    
    // Calculate column layout
    const minCardWidth = Math.min(...cards.map(c => c.width || getDefaultCardWidth(c.type)));
    const baseColumnWidth = Math.max(minCardWidth, masonryColumnWidth);
    const numColumns = Math.max(1, Math.floor((canvasWidth - masonryGap * 2) / (baseColumnWidth + masonryGap)));
    const actualColumnWidth = numColumns > 0 ? (canvasWidth - (numColumns + 1) * masonryGap) / numColumns : baseColumnWidth;
    
    // Track height of each column
    const columnHeights = new Array(numColumns || 1).fill(startY);
    
    // Calculate column heights based on existing cards
    cards.forEach(card => {
        if (card.id === excludeCardId) return;
        
        const cWidth = card.width || getDefaultCardWidth(card.type);
        const cHeight = card.height || getDefaultCardHeight(card.type);
        
        // Find which column this card is in
        const cardColumn = Math.floor((card.x - startX) / (actualColumnWidth + masonryGap));
        const validColumn = Math.max(0, Math.min(numColumns - 1, cardColumn));
        
        const cardBottom = card.y + cHeight;
        if (columnHeights[validColumn] < cardBottom) {
            columnHeights[validColumn] = cardBottom;
        }
    });
    
    // Find the shortest column
    let shortestColumn = 0;
    let shortestHeight = columnHeights[0];
    for (let i = 1; i < columnHeights.length; i++) {
        if (columnHeights[i] < shortestHeight) {
            shortestHeight = columnHeights[i];
            shortestColumn = i;
        }
    }
    
    // Calculate position in shortest column
    const x = startX + shortestColumn * (actualColumnWidth + masonryGap);
    const y = shortestHeight === startY ? startY : shortestHeight + masonryGap;
    
    return { x, y };
}

function stopDrag() {
    if (!draggedCard) return;
    
    const cardId = draggedCard.dataset.id;
    const draggedCardData = cards.find(c => c.id === cardId);
    
    if (draggedCardData) {
        // Get the EXACT final position where the card is visually shown
        const finalX = parseInt(draggedCard.style.left) || parseInt(draggedCard.dataset.initialX) || draggedCardData.x;
        const finalY = parseInt(draggedCard.style.top) || parseInt(draggedCard.dataset.initialY) || draggedCardData.y;
        const finalWidth = parseInt(draggedCard.style.width) || draggedCardData.width;
        const finalHeight = parseInt(draggedCard.style.height) || draggedCardData.height;
        
        // Check if dropping on another card (swap)
        if (dragOverCard && dragOverCard !== draggedCard) {
            const targetCardId = dragOverCard.dataset.id;
            const targetCardData = cards.find(c => c.id === targetCardId);
            
            if (targetCardData) {
                // Swap positions exactly
                const tempX = draggedCardData.x;
                const tempY = draggedCardData.y;
                draggedCardData.x = targetCardData.x;
                draggedCardData.y = targetCardData.y;
                targetCardData.x = tempX;
                targetCardData.y = tempY;
                
                // Update target card position
                const targetCardEl = document.querySelector(`[data-id="${targetCardId}"]`);
                if (targetCardEl) {
                    targetCardEl.style.transition = 'left 0.3s ease, top 0.3s ease';
                    targetCardEl.style.left = targetCardData.x + 'px';
                    targetCardEl.style.top = targetCardData.y + 'px';
                    setTimeout(() => {
                        if (targetCardEl) targetCardEl.style.transition = '';
                    }, 300);
                }
            }
        } else {
            // Check if the drop position would cause overlap
            const wouldOverlap = checkCardOverlap(finalX, finalY, finalWidth, finalHeight, cardId);
            
            if (wouldOverlap) {
                // Find nearest valid masonry position
                const masonryPos = findNearestMasonryPosition(finalWidth, finalHeight, cardId);
                draggedCardData.x = masonryPos.x;
                draggedCardData.y = masonryPos.y;
                
                // Update visual position to match
                draggedCard.style.left = masonryPos.x + 'px';
                draggedCard.style.top = masonryPos.y + 'px';
            } else {
                // No overlap - keep exact position where dropped
                draggedCardData.x = finalX;
                draggedCardData.y = finalY;
            }
            
            // Always save width and height
            draggedCardData.width = finalWidth;
            draggedCardData.height = finalHeight;
        }
        
        // Mark as having exact position
        draggedCardData.exactPosition = true;
        
        // Clean up
        delete draggedCard.dataset.initialX;
        delete draggedCard.dataset.initialY;
    }
    
    // Reset dragged card styles - keep it at final position
    draggedCard.classList.remove('dragging');
    draggedCard.style.zIndex = '100';
    draggedCard.style.opacity = '1';
    draggedCard.style.transform = '';
    draggedCard.style.transition = 'box-shadow 0.2s, transform 0.2s'; // Don't transition position
    draggedCard.style.pointerEvents = '';
    
    // Hide drop indicator
    hideDropIndicator();
    
    // Arrange all cards in masonry to ensure no overlaps
    setTimeout(() => {
        arrangeMasonryLayout();
        saveCards();
        updateCanvasHeight();
    }, 50);
    
    dragOverCard = null;
    draggedCard = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

function startResize(cardId, e) {
    e.stopPropagation();
    resizingCard = document.querySelector(`[data-id="${cardId}"]`);
    if (!resizingCard) return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = card.width || parseInt(resizingCard.style.width);
    const startHeight = card.height || parseInt(resizingCard.style.height);
    
    resizingCard.classList.add('resizing');
    
    function doResize(e) {
        if (!resizingCard) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newWidth = Math.max(200, startWidth + deltaX);
        const newHeight = Math.max(150, startHeight + deltaY);
        
        resizingCard.style.width = newWidth + 'px';
        resizingCard.style.height = newHeight + 'px';
        card.width = newWidth;
        card.height = newHeight;
    }
    
    function stopResize() {
        if (resizingCard) {
            const cardId = resizingCard.dataset.id;
            const card = cards.find(c => c.id === cardId);
            if (card) {
                // Save EXACT position, width, and height after resize
                card.x = parseInt(resizingCard.style.left) || card.x;
                card.y = parseInt(resizingCard.style.top) || card.y;
                card.width = parseInt(resizingCard.style.width) || card.width;
                card.height = parseInt(resizingCard.style.height) || card.height;
                card.exactPosition = true;
                console.log('✅ Card resized - saved exact dimensions:', {
                    id: card.id,
                    x: card.x,
                    y: card.y,
                    width: card.width,
                    height: card.height
                });
            }
            resizingCard.classList.remove('resizing');
            // Don't rearrange - keep exact position and size
            saveCards();
            updateCanvasHeight();
        }
        resizingCard = null;
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
    }
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function arrangeMasonryLayout() {
    if (cards.length === 0) return;
    
    // Don't rearrange if we're currently dragging
    if (draggedCard) return;
    
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width || window.innerWidth;
    const startX = masonryGap;
    const startY = masonryGap;
    
    // Responsive: Calculate optimal column width based on screen size and card sizes
    const minCardWidth = Math.min(...cards.map(card => card.width || getDefaultCardWidth(card.type)));
    const maxCardWidth = Math.max(...cards.map(card => card.width || getDefaultCardWidth(card.type)));
    
    // For small screens, use fewer columns; for large screens, use more
    let baseColumnWidth;
    if (canvasWidth < 768) {
        // Mobile: 1-2 columns
        baseColumnWidth = Math.max(minCardWidth, canvasWidth - masonryGap * 2);
    } else if (canvasWidth < 1024) {
        // Tablet: 2-3 columns
        baseColumnWidth = Math.max(minCardWidth, masonryColumnWidth);
    } else {
        // Desktop: multiple columns
        baseColumnWidth = Math.max(minCardWidth, masonryColumnWidth);
    }
    
    const numColumns = Math.max(1, Math.floor((canvasWidth - masonryGap * 2) / (baseColumnWidth + masonryGap)));
    const actualColumnWidth = numColumns > 0 ? (canvasWidth - (numColumns + 1) * masonryGap) / numColumns : baseColumnWidth;
    
    // Track height of each column
    const columnHeights = new Array(numColumns || 1).fill(startY);
    
    // Sort cards by their current position (top to bottom, left to right)
    const sortedCards = [...cards].sort((a, b) => {
        if (Math.abs(a.y - b.y) < 50) {
            return a.x - b.x;
        }
        return a.y - b.y;
    });
    
    // Place each card in masonry layout, checking for overlaps
    sortedCards.forEach(card => {
        const cardEl = document.querySelector(`[data-id="${card.id}"]`);
        if (!cardEl || cardEl.classList.contains('dragging')) return;
        
        const cardWidth = card.width || getDefaultCardWidth(card.type);
        const cardHeight = card.height || getDefaultCardHeight(card.type);
        
        // Check if current position has overlap or is outside responsive bounds
        const hasOverlap = checkCardOverlap(card.x || 0, card.y || 0, cardWidth, cardHeight, card.id);
        const isOutsideBounds = card.x + cardWidth > canvasWidth + masonryGap;
        
        let finalX, finalY;
        
        if (hasOverlap || isOutsideBounds || !card.exactPosition) {
            // Find the shortest column for masonry placement
            let shortestColumn = 0;
            let shortestHeight = columnHeights[0];
            for (let i = 1; i < columnHeights.length; i++) {
                if (columnHeights[i] < shortestHeight) {
                    shortestHeight = columnHeights[i];
                    shortestColumn = i;
                }
            }
            
            // Calculate position in shortest column
            finalX = startX + shortestColumn * (actualColumnWidth + masonryGap);
            finalY = shortestHeight === startY ? startY : shortestHeight + masonryGap;
            
            // Update card data
            card.x = finalX;
            card.y = finalY;
            card.exactPosition = true;
            
            // Update column height
            columnHeights[shortestColumn] = finalY + cardHeight;
        } else {
            // No overlap, keep exact position but update column heights for other cards
            finalX = card.x;
            finalY = card.y;
            
            // Update column heights based on this card's position
            const cardColumn = Math.floor((finalX - startX) / (actualColumnWidth + masonryGap));
            const validColumn = Math.max(0, Math.min(numColumns - 1, cardColumn));
            const cardBottom = finalY + cardHeight;
            if (columnHeights[validColumn] < cardBottom) {
                columnHeights[validColumn] = cardBottom;
            }
        }
        
        // Update visual position with smooth transition
        cardEl.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        cardEl.style.left = finalX + 'px';
        cardEl.style.top = finalY + 'px';
        cardEl.style.width = cardWidth + 'px';
        cardEl.style.height = cardHeight + 'px';
    });
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
    
    // Reset exactPosition on all remaining cards to force rearrangement
    cards.forEach(card => {
        card.exactPosition = false;
    });
    
    // Rearrange cards to fill the gap, similar to when adding a card
    arrangeMasonryLayout();
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
                // Ensure width and height exist for old cards
                if (!card.width) card.width = getDefaultCardWidth(card.type);
                if (!card.height) card.height = getDefaultCardHeight(card.type);
                // Mark as having exact position if x and y are set
                if (card.x !== undefined && card.y !== undefined) {
                    card.exactPosition = true;
                }
                console.log('Rendering card:', card.type, 'at', card.x, card.y, 'exactPosition:', card.exactPosition);
                renderCard(card);
            });
            // Only arrange in masonry if cards don't have exact positions
            const hasExactPositions = cards.some(card => card.exactPosition);
            if (!hasExactPositions) {
                setTimeout(() => {
                    arrangeMasonryLayout();
                    updateCanvasHeight();
                }, 100);
            } else {
                // Just update canvas height for exact positions
                setTimeout(() => {
                    updateCanvasHeight();
                }, 100);
            }
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
        
        // Sync tokens to backend
        await syncTokensToBackend();
        
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
    if (!currentUserId) return;
    
    try {
        // Load tokens from backend
        await loadTokensFromBackend();
        
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
            
            if (data.state.toggledSites) {
                chrome.storage.local.set({ toggledSites: data.state.toggledSites });
            }
        }
    } catch (error) {
        console.error('Load state error:', error);
    }
}

async function loadTokensFromBackend() {
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
                chrome.storage.local.set({ mercuryToken: token.trim(), mercuryConnected: true }, async () => {
                    // Sync token to backend
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
                // Delete token from backend
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
                    // Delete token from backend
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
                chrome.storage.local.set({ gmailToken: token, gmailConnected: true }, async () => {
                    // Sync token to backend
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
            btn.addEventListener('click', async () => {
                // Delete token from backend
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
                    // Delete token from backend
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
            // Token might be expired, try to refresh it
            await refreshAuthToken(token);
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
        bottomQuote.textContent = "The best thing is going to be a quote here to be best.";
    }
    
    // Hide buttons when unauthenticated
    const leftBtn = document.getElementById('authBottomBtnLeft');
    const rightBtn = document.getElementById('authBottomBtnRight');
    if (leftBtn) leftBtn.style.display = 'none';
    if (rightBtn) rightBtn.style.display = 'none';
    
    // Stop GMT time update
    stopGMTTimeUpdate();
    
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
    
    // Show bottom quote with authenticated message
    const bottomQuote = document.querySelector('.unauth-bottom-quote');
    if (bottomQuote) {
        bottomQuote.style.display = 'block';
        bottomQuote.textContent = "Become the best version of yourself, the world is waiting.";
    }
    
    // Show buttons when authenticated
    const leftBtn = document.getElementById('authBottomBtnLeft');
    const rightBtn = document.getElementById('authBottomBtnRight');
    if (leftBtn) leftBtn.style.display = 'flex';
    if (rightBtn) rightBtn.style.display = 'flex';
    
    // Start updating GMT time
    startGMTTimeUpdate();
    
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

// Helper function to refresh auth token with better error handling
async function refreshAuthToken(oldToken) {
    return new Promise((resolve) => {
        console.log('🔄 Chrome: Attempting to refresh auth token...');
        
        // Remove old cached token
        chrome.identity.removeCachedAuthToken({ token: oldToken }, () => {
            // Try to get a fresh token (Chrome will auto-refresh if possible)
            chrome.identity.getAuthToken({ interactive: false }, async (newToken) => {
                if (chrome.runtime.lastError || !newToken) {
                    const error = chrome.runtime.lastError?.message || 'Unknown error';
                    console.error('❌ Chrome: Token refresh failed:', error);
                    
                    // Check if we have stored userInfo for graceful degradation
                    chrome.storage.local.get(['userInfo'], (result) => {
                        if (result.userInfo) {
                            // Only keep logged in if it's likely a network/backend issue, not auth issue
                            // Check if error suggests network problem vs auth revocation
                            const isNetworkError = error.includes('network') || error.includes('timeout') || 
                                                  error.includes('ECONNREFUSED') || !error.includes('invalid');
                            
                            if (isNetworkError) {
                                console.log('⚠️ Chrome: Network issue detected, keeping user logged in with stored info');
                                showAuthenticatedView(result.userInfo);
                                updateAuthUI(result.userInfo);
                                resolve(false); // Indicates we're using fallback
                            } else {
                                // Auth was revoked or invalid - must logout
                                console.error('❌ Chrome: Auth error detected, logging out');
                                chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                                    showUnauthenticatedView();
                                    currentUserId = null;
                                });
                                resolve(false);
                            }
                        } else {
                            // No stored userInfo - must logout
                            console.error('❌ Chrome: No stored userInfo, showing unauthenticated view');
                            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                                showUnauthenticatedView();
                                currentUserId = null;
                            });
                            resolve(false);
                        }
                    });
                    return;
                }
                
                // Verify the new token works
                console.log('🔄 Chrome: Got refreshed token, verifying...');
                const refreshedUserInfo = await getUserInfo(newToken);
                
                if (refreshedUserInfo) {
                    console.log('✅ Chrome: Token refreshed successfully');
                    chrome.storage.local.set({ userInfo: refreshedUserInfo, authToken: newToken }, async () => {
                        showAuthenticatedView(refreshedUserInfo);
                        updateAuthUI(refreshedUserInfo);
                        await createOrUpdateUser(refreshedUserInfo);
                    });
                    resolve(true);
                } else {
                    // New token also doesn't work - check if network issue
                    chrome.storage.local.get(['userInfo'], (result) => {
                        if (result.userInfo) {
                            // Likely network issue since we got a token but can't verify
                            console.log('⚠️ Chrome: Token refresh succeeded but verification failed (likely network issue)');
                            showAuthenticatedView(result.userInfo);
                            updateAuthUI(result.userInfo);
                            resolve(false);
                        } else {
                            console.error('❌ Chrome: Refreshed token invalid and no stored userInfo');
                            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                                showUnauthenticatedView();
                                currentUserId = null;
                            });
                            resolve(false);
                        }
                    });
                }
            });
        });
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
            // Token is invalid/expired - don't remove it here, let the caller handle refresh
            console.log('⚠️ Token returned 401 - may need refresh');
            return null;
        }
        
        // Other errors (network, etc.) - don't treat as auth failure
        console.warn('⚠️ getUserInfo error:', response.status, response.statusText);
        return null;
    } catch (error) {
        // Network errors shouldn't cause logout - might be temporary
        console.error('⚠️ Network error fetching user info (not treating as auth failure):', error);
        // Return null but don't remove token - might be temporary network issue
        return null;
    }
}

let gmtTimeInterval = null;

function updateGMTTime() {
    const gmtTimeElement = document.getElementById('gmtTime');
    if (!gmtTimeElement) return;
    
    const now = new Date();
    // Get GMT time by using UTC methods
    let hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const hoursStr = hours < 10 ? '0' + hours : hours;
    
    gmtTimeElement.textContent = `${hoursStr}:${minutesStr} ${ampm}`;
}

function startGMTTimeUpdate() {
    // Clear any existing interval
    if (gmtTimeInterval) {
        clearInterval(gmtTimeInterval);
    }
    
    // Update immediately
    updateGMTTime();
    
    // Update every second
    gmtTimeInterval = setInterval(updateGMTTime, 1000);
}

function stopGMTTimeUpdate() {
    if (gmtTimeInterval) {
        clearInterval(gmtTimeInterval);
        gmtTimeInterval = null;
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

