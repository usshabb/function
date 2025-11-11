// Card resize functionality module

// Dependencies: state.js, card-core.js, storage.js

function startResize(cardId, e) {
    e.stopPropagation();
    const resizingCard = document.querySelector(`[data-id="${cardId}"]`);
    if (!resizingCard) return;
    
    const cards = State.getCards();
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    State.setResizingCard(resizingCard);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = card.width || parseInt(resizingCard.style.width);
    const startHeight = card.height || parseInt(resizingCard.style.height);
    
    resizingCard.classList.add('resizing');
    
    function doResize(e) {
        const resizingCard = State.getResizingCard();
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
        const resizingCard = State.getResizingCard();
        if (resizingCard) {
            const cardId = resizingCard.dataset.id;
            const cards = State.getCards();
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
        State.setResizingCard(null);
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
    }
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startResize
    };
}

