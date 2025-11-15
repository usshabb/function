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
    
    // Use actual rendered dimensions to prevent height jump
    // This ensures we start from the exact current visual size
    const startWidth = resizingCard.offsetWidth;
    const startHeight = resizingCard.offsetHeight;
    
    // Capture and preserve the card's exact position
    // Get the actual rendered position to prevent any movement
    const cardRect = resizingCard.getBoundingClientRect();
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const startLeft = cardRect.left - canvasRect.left;
    const startTop = cardRect.top - canvasRect.top;
    
    // Explicitly set position to prevent any movement during resize
    resizingCard.style.left = startLeft + 'px';
    resizingCard.style.top = startTop + 'px';
    
    resizingCard.classList.add('resizing');
    // Disable transitions during resize for immediate feedback
    resizingCard.style.transition = 'none';
    
    function doResize(e) {
        const resizingCard = State.getResizingCard();
        if (!resizingCard) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // Allow free expansion during resize - we'll fix overlaps when resize stops
        const newWidth = Math.max(200, startWidth + deltaX);
        const newHeight = Math.max(150, startHeight + deltaY);
        
        // Update size immediately - allow overlap during resize for better UX
        // IMPORTANT: Keep position fixed - only change size
        resizingCard.style.width = newWidth + 'px';
        resizingCard.style.height = newHeight + 'px';
        // Ensure position stays fixed during resize
        resizingCard.style.left = startLeft + 'px';
        resizingCard.style.top = startTop + 'px';
        
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
                // Get final position and dimensions
                // Use the preserved position to ensure card doesn't move
                const finalX = parseInt(resizingCard.style.left) || startLeft || card.x;
                const finalY = parseInt(resizingCard.style.top) || startTop || card.y;
                const finalWidth = parseInt(resizingCard.style.width) || card.width;
                const finalHeight = parseInt(resizingCard.style.height) || card.height;
                
                // Keep the resizing card in place - move overlapping cards instead
                // Ensure position is exactly where it started (no movement)
                card.x = finalX;
                card.y = finalY;
                card.width = finalWidth;
                card.height = finalHeight;
                card.exactPosition = true;
                
                // Move any cards that overlap with the resized card
                const hasMovedCards = moveOverlappingCards(cardId, finalX, finalY, finalWidth, finalHeight);
                
                console.log('✅ Card resized - saved exact dimensions:', {
                    id: card.id,
                    x: card.x,
                    y: card.y,
                    width: card.width,
                    height: card.height
                });
            }
            resizingCard.classList.remove('resizing');
            
            // Save changes and fix any remaining overlaps
            setTimeout(() => {
                fixAllOverlaps();
                saveCards();
                updateCanvasHeight();
            }, 50);
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

