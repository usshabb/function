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
    // Check if a card at the given position would overlap or be too close to any other card
    // Cards must maintain at least 12px gap between them
    const gap = MASONRY_GAP; // 12px
    const cards = State.getCards();
    
    for (const card of cards) {
        if (card.id === excludeCardId) continue;
        
        const otherX = card.x || 0;
        const otherY = card.y || 0;
        const otherWidth = card.width || getDefaultCardWidth(card.type);
        const otherHeight = card.height || getDefaultCardHeight(card.type);
        
        // Calculate the expanded bounding boxes (including gap)
        // Card 1 expanded: (cardX - gap, cardY - gap, cardWidth + 2*gap, cardHeight + 2*gap)
        // Card 2: (otherX, otherY, otherWidth, otherHeight)
        // They overlap if the expanded box of card 1 intersects with card 2
        
        // Check horizontal overlap (with gap consideration)
        const hOverlap = !(cardX + cardWidth + gap <= otherX || cardX >= otherX + otherWidth + gap);
        // Check vertical overlap (with gap consideration)
        const vOverlap = !(cardY + cardHeight + gap <= otherY || cardY >= otherY + otherHeight + gap);
        
        // If both horizontal and vertical ranges overlap, cards are too close or overlapping
        if (hOverlap && vOverlap) {
            return true; // Overlap detected
        }
    }
    return false; // No overlap, spacing is correct
}

function moveOverlappingCards(excludeCardId, cardX, cardY, cardWidth, cardHeight) {
    // Move cards that overlap with the specified card in an organized way
    const cards = State.getCards();
    const gap = MASONRY_GAP;
    const overlappingCards = [];
    
    // First, collect all overlapping cards
    for (const otherCard of cards) {
        if (otherCard.id === excludeCardId) continue;
        
        const otherCardEl = document.querySelector(`[data-id="${otherCard.id}"]`);
        if (!otherCardEl || otherCardEl.classList.contains('dragging') || otherCardEl.classList.contains('resizing')) {
            continue; // Skip cards that are being dragged or resized
        }
        
        const otherX = otherCard.x || 0;
        const otherY = otherCard.y || 0;
        const otherWidth = otherCard.width || getDefaultCardWidth(otherCard.type);
        const otherHeight = otherCard.height || getDefaultCardHeight(otherCard.type);
        
        // Check if this card overlaps with the specified card
        const hOverlap = !(cardX + cardWidth + gap <= otherX || cardX >= otherX + otherWidth + gap);
        const vOverlap = !(cardY + cardHeight + gap <= otherY || cardY >= otherY + otherHeight + gap);
        
        if (hOverlap && vOverlap) {
            overlappingCards.push({
                card: otherCard,
                cardEl: otherCardEl,
                width: otherWidth,
                height: otherHeight,
                originalX: otherX,
                originalY: otherY
            });
        }
    }
    
    if (overlappingCards.length === 0) {
        return false;
    }
    
    // Sort overlapping cards by their original position (top to bottom, left to right)
    // This ensures they're rearranged in an organized flow
    overlappingCards.sort((a, b) => {
        if (Math.abs(a.originalY - b.originalY) < 50) {
            // Same row - sort by X
            return a.originalX - b.originalX;
        }
        // Different rows - sort by Y
        return a.originalY - b.originalY;
    });
    
    // Temporarily remove overlapping cards from consideration
    const tempExcludedIds = new Set([excludeCardId]);
    overlappingCards.forEach(item => {
        tempExcludedIds.add(item.card.id);
    });
    
    // Rearrange overlapping cards in an organized masonry layout
    overlappingCards.forEach((item, index) => {
        // Find the best position for this card, considering already placed cards
        const validPos = findNearestMasonryPositionWithExclusions(
            item.width, 
            item.height, 
            tempExcludedIds,
            item.originalX,
            item.originalY
        );
        
        item.card.x = validPos.x;
        item.card.y = validPos.y;
        
        // Update visual position with smooth transition
        item.cardEl.style.transition = 'left 0.3s ease, top 0.3s ease';
        item.cardEl.style.left = validPos.x + 'px';
        item.cardEl.style.top = validPos.y + 'px';
        setTimeout(() => {
            if (item.cardEl) item.cardEl.style.transition = '';
        }, 300);
        
        // Add this card to excluded list for next iterations
        tempExcludedIds.add(item.card.id);
    });
    
    return true;
}

function findNearestMasonryPositionWithExclusions(cardWidth, cardHeight, excludeIds, preferredX, preferredY) {
    // Find the best position, trying to stay near preferred position if possible
    const canvas = document.getElementById('canvas');
    if (!canvas) return { x: MASONRY_GAP, y: MASONRY_GAP };
    
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width || window.innerWidth;
    const gap = MASONRY_GAP;
    const startX = gap;
    const startY = gap;
    
    const cards = State.getCards().filter(c => !excludeIds.has(c.id));
    
    // If no cards, try preferred position first, then fallback to top-left
    if (cards.length === 0) {
        if (preferredX !== undefined && preferredY !== undefined) {
            return { x: Math.max(startX, preferredX), y: Math.max(startY, preferredY) };
        }
        return { x: startX, y: startY };
    }
    
    // First, try to find a position near the preferred location
    if (preferredX !== undefined && preferredY !== undefined) {
        // Check if preferred position is valid
        if (!checkCardOverlapWithExclusions(preferredX, preferredY, cardWidth, cardHeight, excludeIds)) {
            return { x: preferredX, y: preferredY };
        }
        
        // Try positions near preferred location (within 200px)
        const searchRadius = 200;
        for (let offsetY = 0; offsetY <= searchRadius; offsetY += 20) {
            for (let offsetX = 0; offsetX <= searchRadius; offsetX += 20) {
                // Try 4 directions: right, left, down, up
                const attempts = [
                    { x: preferredX + offsetX, y: preferredY },
                    { x: preferredX - offsetX, y: preferredY },
                    { x: preferredX, y: preferredY + offsetY },
                    { x: preferredX, y: preferredY - offsetY }
                ];
                
                for (const attempt of attempts) {
                    const testX = Math.max(startX, Math.min(canvasWidth - cardWidth - gap, attempt.x));
                    const testY = Math.max(startY, attempt.y);
                    
                    if (!checkCardOverlapWithExclusions(testX, testY, cardWidth, cardHeight, excludeIds)) {
                        return { x: testX, y: testY };
                    }
                }
            }
        }
    }
    
    // Fall back to standard masonry search with exclusions
    // Use the same search pattern as findNearestMasonryPosition but with exclusions
    let testY = startY;
    const maxY = cards.length > 0 
        ? Math.max(...cards.map(c => (c.y || 0) + (c.height || getDefaultCardHeight(c.type)) + gap * 2), startY + cardHeight + gap)
        : startY + cardHeight + gap;
    
    while (testY < maxY) {
        let testX = startX;
        
        while (testX + cardWidth <= canvasWidth - gap) {
            // Check if this position is valid (no overlap with excluded cards)
            if (!checkCardOverlapWithExclusions(testX, testY, cardWidth, cardHeight, excludeIds)) {
                return { x: testX, y: testY };
            }
            
            // Move to next potential X position
            let nextX = testX + 1;
            cards.forEach(card => {
                const cX = card.x || 0;
                const cWidth = card.width || getDefaultCardWidth(card.type);
                const cY = card.y || 0;
                const cHeight = card.height || getDefaultCardHeight(card.type);
                
                // If card is in this row (vertically overlapping)
                if (!(testY + cardHeight + gap <= cY || testY >= cY + cHeight + gap)) {
                    if (cX + cWidth + gap > testX && cX + cWidth + gap < nextX) {
                        nextX = cX + cWidth + gap;
                    }
                }
            });
            testX = nextX;
        }
        
        // Move to next row
        let nextY = testY + cardHeight + gap;
        cards.forEach(card => {
            const cY = card.y || 0;
            const cHeight = card.height || getDefaultCardHeight(card.type);
            const cX = card.x || 0;
            const cWidth = card.width || getDefaultCardWidth(card.type);
            
            // If card is horizontally overlapping with our test position
            if (!(testX + cardWidth + gap <= cX || testX >= cX + cWidth + gap)) {
                const cardBottom = cY + cHeight + gap;
                if (cardBottom > testY && cardBottom < nextY) {
                    nextY = cardBottom;
                }
            }
        });
        testY = nextY;
    }
    
    // If we couldn't find a position, place at top-left
    return { x: startX, y: startY };
}

function checkCardOverlapWithExclusions(cardX, cardY, cardWidth, cardHeight, excludeIds) {
    // Check overlap with exclusions (can be Set or comma-separated string)
    const gap = MASONRY_GAP;
    const cards = State.getCards();
    const excludeSet = excludeIds instanceof Set ? excludeIds : new Set(String(excludeIds).split(','));
    
    for (const card of cards) {
        if (excludeSet.has(card.id)) continue;
        
        const otherX = card.x || 0;
        const otherY = card.y || 0;
        const otherWidth = card.width || getDefaultCardWidth(card.type);
        const otherHeight = card.height || getDefaultCardHeight(card.type);
        
        const hOverlap = !(cardX + cardWidth + gap <= otherX || cardX >= otherX + otherWidth + gap);
        const vOverlap = !(cardY + cardHeight + gap <= otherY || cardY >= otherY + otherHeight + gap);
        
        if (hOverlap && vOverlap) {
            return true;
        }
    }
    return false;
}

function fixAllOverlaps() {
    // Fix any overlaps by repositioning cards that overlap
    const cards = State.getCards();
    let hasChanges = false;
    
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const cardEl = document.querySelector(`[data-id="${card.id}"]`);
        if (!cardEl || cardEl.classList.contains('dragging') || cardEl.classList.contains('resizing')) {
            continue; // Skip cards that are being dragged or resized
        }
        
        const cardWidth = card.width || getDefaultCardWidth(card.type);
        const cardHeight = card.height || getDefaultCardHeight(card.type);
        
        // Check if current position causes overlap
        if (checkCardOverlap(card.x || 0, card.y || 0, cardWidth, cardHeight, card.id)) {
            // Find a valid position
            const validPos = findNearestMasonryPosition(cardWidth, cardHeight, card.id);
            card.x = validPos.x;
            card.y = validPos.y;
            
            // Update visual position
            cardEl.style.left = validPos.x + 'px';
            cardEl.style.top = validPos.y + 'px';
            hasChanges = true;
        }
    }
    
    if (hasChanges) {
        saveCards();
        updateCanvasHeight();
    }
}

function findNearestMasonryPosition(cardWidth, cardHeight, excludeCardId) {
    // Find the first valid position with exactly 12px spacing from all cards
    const canvas = document.getElementById('canvas');
    if (!canvas) return { x: MASONRY_GAP, y: MASONRY_GAP };
    
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width || window.innerWidth;
    const gap = MASONRY_GAP; // 12px spacing
    const startX = gap;
    const startY = gap;
    
    const cards = State.getCards().filter(c => c.id !== excludeCardId);
    
    // If no cards, place at top-left
    if (cards.length === 0) {
        return { x: startX, y: startY };
    }
    
    // Try positions from top-left, scanning left to right, top to bottom
    // Start at top-left
    let testY = startY;
    const maxY = Math.max(...cards.map(c => (c.y || 0) + (c.height || getDefaultCardHeight(c.type)) + gap * 2), startY + cardHeight + gap);
    
    while (testY < maxY) {
        let testX = startX;
        
        while (testX + cardWidth <= canvasWidth - gap) {
            // Check if this position is valid (no overlap, exactly 12px spacing)
            if (!checkCardOverlap(testX, testY, cardWidth, cardHeight, excludeCardId)) {
                return { x: testX, y: testY };
            }
            
            // Move to next potential X position
            // Find the rightmost edge of any card that might affect this row
            let nextX = testX + 1;
            cards.forEach(card => {
                const cX = card.x || 0;
                const cWidth = card.width || getDefaultCardWidth(card.type);
                const cY = card.y || 0;
                const cHeight = card.height || getDefaultCardHeight(card.type);
                
                // If card is in this row (vertically overlapping)
                if (!(testY + cardHeight + gap <= cY || testY >= cY + cHeight + gap)) {
                    // Check if we should jump past this card
                    if (cX + cWidth + gap > testX && cX + cWidth + gap < nextX) {
                        nextX = cX + cWidth + gap;
                    }
                }
            });
            testX = nextX;
        }
        
        // Move to next row
        // Find the lowest point of cards in current row, then add gap
        let nextY = testY + cardHeight + gap;
        cards.forEach(card => {
            const cY = card.y || 0;
            const cHeight = card.height || getDefaultCardHeight(card.type);
            const cX = card.x || 0;
            const cWidth = card.width || getDefaultCardWidth(card.type);
            
            // If card is horizontally overlapping with our test position
            if (!(testX + cardWidth + gap <= cX || testX >= cX + cWidth + gap)) {
                const cardBottom = cY + cHeight + gap;
                if (cardBottom > testY && cardBottom < nextY) {
                    nextY = cardBottom;
                }
            }
        });
        testY = nextY;
    }
    
    // If we couldn't find a position, place at top-left
    return { x: startX, y: startY };
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
    const gap = MASONRY_GAP; // 12px spacing
    
    // Sort cards: exactPosition cards first (to preserve their positions), then newest first
    // This ensures manually positioned cards are placed before others
    const sortedCards = [...cards].sort((a, b) => {
        // Cards with exactPosition come first
        if (a.exactPosition && !b.exactPosition) return -1;
        if (!a.exactPosition && b.exactPosition) return 1;
        // For cards with same exactPosition status, sort by ID (newest first)
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idB - idA; // Descending: newest first
    });
    
    // Track placed cards to ensure exactly 12px spacing
    const placedCards = [];
    
    // Place each card ensuring exactly 12px spacing from all previously placed cards
    sortedCards.forEach(card => {
        const cardEl = document.querySelector(`[data-id="${card.id}"]`);
        if (!cardEl || cardEl.classList.contains('dragging')) return;
        
        const cardWidth = card.width || getDefaultCardWidth(card.type);
        const cardHeight = card.height || getDefaultCardHeight(card.type);
        
        let finalX, finalY;
        
        // Check if current position is valid
        let isValidPosition = true;
        if (card.x !== undefined && card.y !== undefined && card.exactPosition) {
            // For cards with exactPosition, check for overlaps with placed cards
            // This preserves user's manual positioning but prevents overlaps
            for (const placed of placedCards) {
                const placedX = placed.x || 0;
                const placedY = placed.y || 0;
                const placedWidth = placed.width || 0;
                const placedHeight = placed.height || 0;
                
                // Use the same overlap check logic (with 12px gap requirement)
                const hOverlap = !(card.x + cardWidth + gap <= placedX || card.x >= placedX + placedWidth + gap);
                const vOverlap = !(card.y + cardHeight + gap <= placedY || card.y >= placedY + placedHeight + gap);
                
                // If both dimensions overlap, position is invalid
                if (hOverlap && vOverlap) {
                    isValidPosition = false;
                    break;
                }
            }
            
            // Also check if position is way outside bounds (allow some margin)
            if (card.x + cardWidth > canvasWidth + 100 || card.x < -100 || card.y < -100) {
                isValidPosition = false;
            }
        } else {
            // For cards without exactPosition, check for exactly 12px spacing
            isValidPosition = false;
        }
        
        if (!isValidPosition) {
            // Find the first valid position with exactly 12px spacing
            const startX = gap;
            const startY = gap;
            let testY = startY;
            
            // Calculate max Y to search (based on placed cards)
            const maxY = placedCards.length > 0 
                ? Math.max(...placedCards.map(c => (c.y || 0) + (c.height || 0) + gap * 3), startY + cardHeight + gap)
                : startY + cardHeight + gap;
            
            let found = false;
            
            while (testY < maxY && !found) {
                let testX = startX;
                
                while (testX + cardWidth <= canvasWidth - gap && !found) {
                    // Check if this position is valid (12px spacing from all placed cards)
                    let positionValid = true;
                    
                    for (const placed of placedCards) {
                        const placedX = placed.x || 0;
                        const placedY = placed.y || 0;
                        const placedWidth = placed.width || 0;
                        const placedHeight = placed.height || 0;
                        
                        // Use the same overlap check logic (with 12px gap requirement)
                        const hOverlap = !(testX + cardWidth + gap <= placedX || testX >= placedX + placedWidth + gap);
                        const vOverlap = !(testY + cardHeight + gap <= placedY || testY >= placedY + placedHeight + gap);
                        
                        // If both dimensions overlap, position is invalid
                        if (hOverlap && vOverlap) {
                            positionValid = false;
                            break;
                        }
                    }
                    
                    if (positionValid) {
                        finalX = testX;
                        finalY = testY;
                        found = true;
                    } else {
                        // Move to next X position - jump past cards in this row
                        let nextX = testX + 1;
                        for (const placed of placedCards) {
                            const placedX = placed.x || 0;
                            const placedWidth = placed.width || 0;
                            const placedY = placed.y || 0;
                            const placedHeight = placed.height || 0;
                            
                            // If card is in this row (vertically overlapping)
                            if (!(testY + cardHeight + gap <= placedY || testY >= placedY + placedHeight + gap)) {
                                if (placedX + placedWidth + gap > testX && placedX + placedWidth + gap < nextX) {
                                    nextX = placedX + placedWidth + gap;
                                }
                            }
                        }
                        testX = nextX;
                    }
                }
                
                if (!found) {
                    // Move to next row
                    let nextY = testY + cardHeight + gap;
                    for (const placed of placedCards) {
                        const placedY = placed.y || 0;
                        const placedHeight = placed.height || 0;
                        const placedX = placed.x || 0;
                        const placedWidth = placed.width || 0;
                        
                        // If card is horizontally overlapping with our test position
                        if (!(testX + cardWidth + gap <= placedX || testX >= placedX + placedWidth + gap)) {
                            const cardBottom = placedY + placedHeight + gap;
                            if (cardBottom > testY && cardBottom < nextY) {
                                nextY = cardBottom;
                            }
                        }
                    }
                    testY = nextY;
                }
            }
            
            if (!found) {
                // Fallback: place at top-left
                finalX = startX;
                finalY = startY;
            }
            
            // Update card position
            card.x = finalX;
            card.y = finalY;
            card.exactPosition = true;
        } else {
            // Keep current position
            finalX = card.x;
            finalY = card.y;
        }
        
        // Add to placed cards for next iteration
        placedCards.push({
            x: finalX,
            y: finalY,
            width: cardWidth,
            height: cardHeight,
            type: card.type
        });
        
        // Update visual position with smooth transition
        cardEl.style.transition = 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1), top 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
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
        arrangeMasonryLayout,
        fixAllOverlaps,
        moveOverlappingCards
    };
}

