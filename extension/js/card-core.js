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
    State.setCards(cards.filter(c => c.id !== cardId));
    const cardEl = document.querySelector(`[data-id="${cardId}"]`);
    if (cardEl) {
        cardEl.remove();
    }
    
    // Reset exactPosition on all remaining cards to force rearrangement
    State.getCards().forEach(card => {
        card.exactPosition = false;
    });
    
    // Rearrange cards to fill the gap, similar to when adding a card
    arrangeMasonryLayout();
    saveCards();
    updateCanvasHeight();
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

