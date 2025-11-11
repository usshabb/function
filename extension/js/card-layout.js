// Card layout and masonry positioning module

// Dependencies: config.js, state.js, card-core.js

function updateCanvasHeight() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    // Check if canvas is inside dots section (authenticated state)
    const dotsSection = canvas.closest('.unauth-dots');
    const isInDotsSection = dotsSection && canvas.style.display !== 'none';
    
    const cards = State.getCards();
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

function checkCardOverlap(cardX, cardY, cardWidth, cardHeight, excludeCardId) {
    // Check if a card at the given position would overlap with any other card
    const cards = State.getCards();
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
    const startX = MASONRY_GAP;
    const startY = MASONRY_GAP;
    
    const cards = State.getCards();
    // Calculate column layout
    const minCardWidth = Math.min(...cards.map(c => c.width || getDefaultCardWidth(c.type)));
    const baseColumnWidth = Math.max(minCardWidth, MASONRY_COLUMN_WIDTH);
    const numColumns = Math.max(1, Math.floor((canvasWidth - MASONRY_GAP * 2) / (baseColumnWidth + MASONRY_GAP)));
    const actualColumnWidth = numColumns > 0 ? (canvasWidth - (numColumns + 1) * MASONRY_GAP) / numColumns : baseColumnWidth;
    
    // Track height of each column
    const columnHeights = new Array(numColumns || 1).fill(startY);
    
    // Calculate column heights based on existing cards
    cards.forEach(card => {
        if (card.id === excludeCardId) return;
        
        const cWidth = card.width || getDefaultCardWidth(card.type);
        const cHeight = card.height || getDefaultCardHeight(card.type);
        
        // Find which column this card is in
        const cardColumn = Math.floor((card.x - startX) / (actualColumnWidth + MASONRY_GAP));
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
    const x = startX + shortestColumn * (actualColumnWidth + MASONRY_GAP);
    const y = shortestHeight === startY ? startY : shortestHeight + MASONRY_GAP;
    
    return { x, y };
}

function arrangeMasonryLayout() {
    const cards = State.getCards();
    if (cards.length === 0) return;
    
    // Don't rearrange if we're currently dragging
    if (State.getDraggedCard()) return;
    
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width || window.innerWidth;
    const startX = MASONRY_GAP;
    const startY = MASONRY_GAP;
    
    // Responsive: Calculate optimal column width based on screen size and card sizes
    const minCardWidth = Math.min(...cards.map(card => card.width || getDefaultCardWidth(card.type)));
    const maxCardWidth = Math.max(...cards.map(card => card.width || getDefaultCardWidth(card.type)));
    
    // For small screens, use fewer columns; for large screens, use more
    let baseColumnWidth;
    if (canvasWidth < 768) {
        // Mobile: 1-2 columns
        baseColumnWidth = Math.max(minCardWidth, canvasWidth - MASONRY_GAP * 2);
    } else if (canvasWidth < 1024) {
        // Tablet: 2-3 columns
        baseColumnWidth = Math.max(minCardWidth, MASONRY_COLUMN_WIDTH);
    } else {
        // Desktop: multiple columns
        baseColumnWidth = Math.max(minCardWidth, MASONRY_COLUMN_WIDTH);
    }
    
    const numColumns = Math.max(1, Math.floor((canvasWidth - MASONRY_GAP * 2) / (baseColumnWidth + MASONRY_GAP)));
    const actualColumnWidth = numColumns > 0 ? (canvasWidth - (numColumns + 1) * MASONRY_GAP) / numColumns : baseColumnWidth;
    
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
        const isOutsideBounds = card.x + cardWidth > canvasWidth + MASONRY_GAP;
        
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
            finalX = startX + shortestColumn * (actualColumnWidth + MASONRY_GAP);
            finalY = shortestHeight === startY ? startY : shortestHeight + MASONRY_GAP;
            
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
            const cardColumn = Math.floor((finalX - startX) / (actualColumnWidth + MASONRY_GAP));
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

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateCanvasHeight,
        checkCardOverlap,
        findNearestMasonryPosition,
        arrangeMasonryLayout
    };
}

