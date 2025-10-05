let cards = [];
let draggedCard = null;
let offset = { x: 0, y: 0 };

document.addEventListener('DOMContentLoaded', () => {
    loadCards();
    
    document.getElementById('addNote').addEventListener('click', () => createCard('note'));
    document.getElementById('addLink').addEventListener('click', () => createCard('link'));
});

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
    }
    
    cardEl.appendChild(content);
    
    cardEl.addEventListener('mousedown', startDrag);
    
    document.getElementById('canvas').appendChild(cardEl);
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
}

function saveCards() {
    chrome.storage.local.set({ cards: cards });
}

function loadCards() {
    chrome.storage.local.get(['cards'], (result) => {
        if (result.cards) {
            cards = result.cards;
            cards.forEach(card => renderCard(card));
        }
    });
}
