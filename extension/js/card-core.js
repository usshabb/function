// Core card operations module

// Dependencies: config.js, state.js

function getDefaultCardWidth(type) {
    return DEFAULT_CARD_WIDTHS[type] || 300;
}

function getDefaultCardHeight(type) {
    return DEFAULT_CARD_HEIGHTS[type] || 200;
}

function createCard(type, data = {}) {
    // If x/y are provided, use exact position; otherwise, let masonry arrange it
    const hasExactPosition = data.x !== undefined && data.y !== undefined;
    
    const card = {
        id: Date.now().toString(),
        type: type,
        x: data.x || 0,
        y: data.y || 0,
        width: data.width || getDefaultCardWidth(type),
        height: data.height || getDefaultCardHeight(type),
        content: data.content || '',
        exactPosition: hasExactPosition // Only true if x/y were explicitly provided
    };
    
    State.getCards().push(card);
    renderCard(card);
    // Always arrange in masonry for new cards (they'll be placed at top-left)
    arrangeMasonryLayout();
    saveCards();
    updateCanvasHeight();
}

function renderCard(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;
    cardEl.dataset.type = card.type;
    cardEl.style.left = card.x + 'px';
    cardEl.style.top = card.y + 'px';
    cardEl.style.width = (card.width || getDefaultCardWidth(card.type)) + 'px';
    cardEl.style.height = (card.height || getDefaultCardHeight(card.type)) + 'px';
    
    // Create drag handle area that includes header and space above it
    const dragHandle = document.createElement('div');
    dragHandle.className = 'card-drag-handle';
    
    const header = document.createElement('div');
    header.className = 'card-header';
    
    const type = document.createElement('div');
    type.className = 'card-type';
    // Special handling for tasks card
    if (card.type === 'tasks') {
        type.textContent = 'To Do List';
    } else if (card.type === 'reminder') {
        type.textContent = 'Your Calendar';
    } else {
        // Capitalize first letter for display
        type.textContent = card.type.charAt(0).toUpperCase() + card.type.slice(1);
    }
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    
    // Use SVG for note, tasks, and reminder cards, text for others
    if (card.type === 'note' || card.type === 'tasks' || card.type === 'reminder') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 20 20');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M14.1668 5.83325L5.8335 14.1666M5.8335 5.83325L14.1668 14.1666');
        path.setAttribute('stroke', 'black');
        path.setAttribute('stroke-width', '1.66667');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        
        svg.appendChild(path);
        deleteBtn.appendChild(svg);
    } else {
        deleteBtn.textContent = '×';
    }
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        deleteCard(card.id);
    });
    
    deleteBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    
    header.appendChild(type);
    header.appendChild(deleteBtn);
    dragHandle.appendChild(header);
    cardEl.appendChild(dragHandle);
    
    const content = document.createElement('div');
    content.className = 'card-content';
    
    if (card.type === 'note') {
        const textarea = document.createElement('textarea');
        textarea.value = card.content;
        textarea.placeholder = 'Start typing...';
        
        // Auto-resize function for note cards
        const autoResize = () => {
            // Reset height to auto to get the correct scrollHeight
            textarea.style.height = 'auto';
            
            // Calculate required height: header (~40px) + padding (38px) + textarea content
            const headerHeight = header.offsetHeight || 40;
            const cardPadding = 38; // 19px top + 19px bottom
            const textareaHeight = textarea.scrollHeight;
            let newHeight = Math.max(143, headerHeight + cardPadding + textareaHeight);
            
            // Get current position and dimensions
            const currentX = card.x || 0;
            const currentY = card.y || 0;
            const currentWidth = card.width || getDefaultCardWidth(card.type);
            
            // Check if the new height would cause overlap
            if (checkCardOverlap(currentX, currentY, currentWidth, newHeight, card.id)) {
                // Try to find a valid position for the expanded card
                const validPos = findNearestMasonryPosition(currentWidth, newHeight, card.id);
                card.x = validPos.x;
                card.y = validPos.y;
                cardEl.style.left = validPos.x + 'px';
                cardEl.style.top = validPos.y + 'px';
            }
            
            // Update card height
            cardEl.style.height = newHeight + 'px';
            card.height = newHeight;
            saveCards();
            updateCanvasHeight();
            
            // Fix any overlaps that might have occurred
            setTimeout(() => {
                fixAllOverlaps();
            }, 50);
        };
        
        textarea.addEventListener('input', (e) => {
            updateCardContent(card.id, e.target.value);
            autoResize();
        });
        
        content.appendChild(textarea);
        
        // Initial resize if there's existing content
        if (card.content) {
            setTimeout(autoResize, 0);
        }
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
    } else if (card.type === 'reminder') {
        cardEl.style.cursor = 'default';
    }
    
    cardEl.appendChild(content);
    
    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.style.cssText = 'position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nwse-resize; background: transparent; z-index: 1000; pointer-events: auto;';
    cardEl.appendChild(resizeHandle);
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startResize(card.id, e);
    });
    
    // Attach drag listener to drag handle (header + space above)
    dragHandle.addEventListener('mousedown', startDrag);
    
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
    const card = State.getCards().find(c => c.id === cardId);
    if (cardEl && card) {
        cardEl.remove();
        renderCard(card);
    }
}

function updateCardContent(cardId, content) {
    const card = State.getCards().find(c => c.id === cardId);
    if (card) {
        card.content = content;
        saveCards();
    }
}

function deleteCard(cardId) {
    const cards = State.getCards();
    const cardToDelete = cards.find(c => c.id === cardId);
    
    // If deleting a tasks card, also delete all tasks
    if (cardToDelete && cardToDelete.type === 'tasks') {
        State.setTasks([]);
        // Save tasks directly to storage
        chrome.storage.local.set({ tasks: [] }, () => {
            if (typeof debouncedSync === 'function') {
                debouncedSync();
            }
        });
    }
    
    State.setCards(cards.filter(c => c.id !== cardId));
    const cardEl = document.querySelector(`[data-id="${cardId}"]`);
    if (cardEl) {
        cardEl.remove();
    }
    
    // Fix any overlaps and rearrange cards
    setTimeout(() => {
        fixAllOverlaps();
        arrangeMasonryLayout();
        saveCards();
        updateCanvasHeight();
    }, 50);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createCard,
        renderCard,
        reloadCard,
        updateCardContent,
        deleteCard,
        getDefaultCardWidth,
        getDefaultCardHeight
    };
}

