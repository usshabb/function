// Drag and drop functionality module

// Dependencies: state.js, card-core.js, card-layout.js

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
    
    State.setDraggedCard(e.currentTarget);
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const cardRect = State.getDraggedCard().getBoundingClientRect();
    
    // Calculate offset relative to canvas, accounting for current card position
    const offset = {
        x: e.clientX - cardRect.left,
        y: e.clientY - cardRect.top
    };
    State.setOffset(offset);
    
    // Store initial position for reference
    const initialLeft = parseInt(State.getDraggedCard().style.left) || 0;
    const initialTop = parseInt(State.getDraggedCard().style.top) || 0;
    State.getDraggedCard().dataset.initialX = initialLeft;
    State.getDraggedCard().dataset.initialY = initialTop;
    
    State.getDraggedCard().classList.add('dragging');
    State.getDraggedCard().style.zIndex = '1000';
    State.getDraggedCard().style.transition = 'none';
    State.getDraggedCard().style.opacity = '0.8';
    State.getDraggedCard().style.transform = 'rotate(2deg) scale(1.02)';
    State.getDraggedCard().style.pointerEvents = 'none'; // Prevent interference with hover detection
    
    // Create drop indicator
    createDropIndicator();
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
    e.stopPropagation();
}

function drag(e) {
    if (!State.getDraggedCard()) return;
    
    // Get canvas position to calculate relative coordinates
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const offset = State.getOffset();
    
    // Calculate position relative to canvas, accounting for scroll
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const x = e.clientX - canvasRect.left - offset.x;
    const y = e.clientY - canvasRect.top - offset.y;
    
    // Ensure card doesn't go outside canvas bounds
    const cardWidth = State.getDraggedCard().offsetWidth;
    const cardHeight = State.getDraggedCard().offsetHeight;
    const minX = 0;
    const minY = 0;
    const maxX = canvasRect.width - cardWidth;
    const maxY = Math.max(canvasRect.height - cardHeight, minY);
    
    const clampedX = Math.max(minX, Math.min(maxX, x));
    const clampedY = Math.max(minY, Math.min(maxY, y));
    
    // Update dragged card position smoothly
    State.getDraggedCard().style.transition = 'none';
    State.getDraggedCard().style.left = clampedX + 'px';
    State.getDraggedCard().style.top = clampedY + 'px';
    
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
        State.getDraggedCard().style.top = (parseInt(State.getDraggedCard().style.top) || 0) - scrollAmount + 'px';
    } else if (e.clientY > viewportHeight - scrollThreshold) {
        // Near bottom - scroll down
        window.scrollBy(0, scrollSpeed);
        // Adjust card position to account for scroll
        State.getDraggedCard().style.top = (parseInt(State.getDraggedCard().style.top) || 0) + scrollSpeed + 'px';
    }
    
    // Horizontal scrolling (if needed)
    if (e.clientX < scrollThreshold && window.scrollX > 0) {
        // Near left - scroll left
        const scrollAmount = Math.min(scrollSpeed, window.scrollX);
        window.scrollBy(-scrollAmount, 0);
        State.getDraggedCard().style.left = (parseInt(State.getDraggedCard().style.left) || 0) - scrollAmount + 'px';
    } else if (e.clientX > viewportWidth - scrollThreshold) {
        // Near right - scroll right
        window.scrollBy(scrollSpeed, 0);
        State.getDraggedCard().style.left = (parseInt(State.getDraggedCard().style.left) || 0) + scrollSpeed + 'px';
    }
    
    // Check which card we're hovering over (exclude the dragged card)
    const hoveredCard = getCardAtPosition(e.clientX, e.clientY);
    
    if (hoveredCard && hoveredCard !== State.getDraggedCard() && hoveredCard !== State.getDragOverCard()) {
        // Show drop indicator on the hovered card
        showDropIndicator(hoveredCard);
        State.setDragOverCard(hoveredCard);
    } else if (!hoveredCard && State.getDragOverCard()) {
        // Hide drop indicator if not over any card
        hideDropIndicator();
        State.setDragOverCard(null);
    }
    
    e.preventDefault();
    e.stopPropagation();
}

function getCardAtPosition(clientX, clientY) {
    // Get all cards except the one being dragged
    const allCards = Array.from(document.querySelectorAll('.card')).filter(card => 
        !card.classList.contains('dragging') && card !== State.getDraggedCard()
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
    if (State.getDropIndicator()) return;
    
    const dropIndicator = document.createElement('div');
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
    State.setDropIndicator(dropIndicator);
}

function showDropIndicator(targetCard) {
    const dropIndicator = State.getDropIndicator();
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
    const dropIndicator = State.getDropIndicator();
    if (!dropIndicator) return;
    dropIndicator.style.display = 'none';
    
    // Remove drop-target class from all cards
    document.querySelectorAll('.card.drop-target').forEach(card => {
        card.classList.remove('drop-target');
    });
}

function stopDrag() {
    if (!State.getDraggedCard()) return;
    
    const cardId = State.getDraggedCard().dataset.id;
    const draggedCardData = State.getCards().find(c => c.id === cardId);
    
    if (draggedCardData) {
        // Get the EXACT final position where the card is visually shown
        const finalX = parseInt(State.getDraggedCard().style.left) || parseInt(State.getDraggedCard().dataset.initialX) || draggedCardData.x;
        const finalY = parseInt(State.getDraggedCard().style.top) || parseInt(State.getDraggedCard().dataset.initialY) || draggedCardData.y;
        const finalWidth = parseInt(State.getDraggedCard().style.width) || draggedCardData.width;
        const finalHeight = parseInt(State.getDraggedCard().style.height) || draggedCardData.height;
        
        // Check if dropping on another card (swap)
        if (State.getDragOverCard() && State.getDragOverCard() !== State.getDraggedCard()) {
            const targetCardId = State.getDragOverCard().dataset.id;
            const targetCardData = State.getCards().find(c => c.id === targetCardId);
            
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
                State.getDraggedCard().style.left = masonryPos.x + 'px';
                State.getDraggedCard().style.top = masonryPos.y + 'px';
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
        delete State.getDraggedCard().dataset.initialX;
        delete State.getDraggedCard().dataset.initialY;
    }
    
    // Reset dragged card styles - keep it at final position
    State.getDraggedCard().classList.remove('dragging');
    State.getDraggedCard().style.zIndex = '100';
    State.getDraggedCard().style.opacity = '1';
    State.getDraggedCard().style.transform = '';
    State.getDraggedCard().style.transition = 'box-shadow 0.2s, transform 0.2s'; // Don't transition position
    State.getDraggedCard().style.pointerEvents = '';
    
    // Hide drop indicator
    hideDropIndicator();
    
    // Arrange all cards in masonry to ensure no overlaps
    setTimeout(() => {
        arrangeMasonryLayout();
        saveCards();
        updateCanvasHeight();
    }, 50);
    
    State.setDragOverCard(null);
    State.setDraggedCard(null);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startDrag,
        drag,
        stopDrag,
        getCardAtPosition,
        createDropIndicator,
        showDropIndicator,
        hideDropIndicator
    };
}

