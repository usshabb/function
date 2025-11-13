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
    // Check if a card at the given position would overlap or have incorrect spacing with any other card
    const gap = MASONRY_GAP; // 12px
    const cards = State.getCards();
    
    for (const card of cards) {
        if (card.id === excludeCardId) continue;
        
        const otherX = card.x || 0;
        const otherY = card.y || 0;
        const otherWidth = card.width || getDefaultCardWidth(card.type);
        const otherHeight = card.height || getDefaultCardHeight(card.type);
        
        // Check if cards overlap or are adjacent (considering 12px gap requirement)
        const hOverlap = !(cardX + cardWidth + gap <= otherX || cardX >= otherX + otherWidth + gap);
        const vOverlap = !(cardY + cardHeight + gap <= otherY || cardY >= otherY + otherHeight + gap);
        
        if (hOverlap || vOverlap) {
            // Calculate actual gaps
            let hGap = 0;
            let vGap = 0;
            
            // Horizontal gap: distance between card edges
            if (cardX + cardWidth <= otherX) {
                hGap = otherX - (cardX + cardWidth);
            } else if (otherX + otherWidth <= cardX) {
                hGap = cardX - (otherX + otherWidth);
            } else {
                hGap = 0; // Cards overlap horizontally
            }
            
            // Vertical gap: distance between card edges
            if (cardY + cardHeight <= otherY) {
                vGap = otherY - (cardY + cardHeight);
            } else if (otherY + otherHeight <= cardY) {
                vGap = cardY - (otherY + otherHeight);
            } else {
                vGap = 0; // Cards overlap vertically
            }
            
            // If cards overlap in both dimensions, position is invalid
            if (hGap === 0 && vGap === 0) {
                return true; // Cards overlap
            }
            
            // If cards are horizontally adjacent (vertically overlapping, horizontally separated)
            // Vertical gap must be exactly 12px
            if (vOverlap && !hOverlap && vGap > 0 && Math.abs(vGap - gap) > 0.5) {
                return true; // Invalid vertical spacing
            }
            
            // If cards are vertically adjacent (horizontally overlapping, vertically separated)
            // Horizontal gap must be exactly 12px
            if (hOverlap && !vOverlap && hGap > 0 && Math.abs(hGap - gap) > 0.5) {
                return true; // Invalid horizontal spacing
            }
            
            // If cards overlap in both dimensions but have gaps, check if gaps are exactly 12px
            if (hOverlap && vOverlap) {
                if (hGap > 0 && Math.abs(hGap - gap) > 0.5) {
                    return true; // Invalid horizontal spacing
                }
                if (vGap > 0 && Math.abs(vGap - gap) > 0.5) {
                    return true; // Invalid vertical spacing
                }
            }
        }
    }
    return false; // No overlap, spacing is correct
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
            // For cards with exactPosition, only check for actual overlaps (not spacing requirements)
            // This preserves user's manual positioning
            for (const placed of placedCards) {
                const placedX = placed.x || 0;
                const placedY = placed.y || 0;
                const placedWidth = placed.width || 0;
                const placedHeight = placed.height || 0;
                
                // Check if cards actually overlap (not just spacing)
                const hOverlap = !(card.x + cardWidth <= placedX || card.x >= placedX + placedWidth);
                const vOverlap = !(card.y + cardHeight <= placedY || card.y >= placedY + placedHeight);
                
                // Only invalidate if cards actually overlap in both dimensions
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
                    // Check if this position is valid (exactly 12px spacing from all placed cards)
                    let positionValid = true;
                    
                    for (const placed of placedCards) {
                        const placedX = placed.x || 0;
                        const placedY = placed.y || 0;
                        const placedWidth = placed.width || 0;
                        const placedHeight = placed.height || 0;
                        
                        // Check if cards overlap or are adjacent (considering 12px gap requirement)
                        // Cards overlap horizontally if their X ranges overlap (with gap)
                        const hOverlap = !(testX + cardWidth + gap <= placedX || testX >= placedX + placedWidth + gap);
                        // Cards overlap vertically if their Y ranges overlap (with gap)
                        const vOverlap = !(testY + cardHeight + gap <= placedY || testY >= placedY + placedHeight + gap);
                        
                        if (hOverlap || vOverlap) {
                            // Calculate actual gaps
                            let hGap = 0;
                            let vGap = 0;
                            
                            // Horizontal gap: distance between card edges
                            if (testX + cardWidth <= placedX) {
                                hGap = placedX - (testX + cardWidth);
                            } else if (placedX + placedWidth <= testX) {
                                hGap = testX - (placedX + placedWidth);
                            } else {
                                hGap = 0; // Cards overlap horizontally
                            }
                            
                            // Vertical gap: distance between card edges
                            if (testY + cardHeight <= placedY) {
                                vGap = placedY - (testY + cardHeight);
                            } else if (placedY + placedHeight <= testY) {
                                vGap = testY - (placedY + placedHeight);
                            } else {
                                vGap = 0; // Cards overlap vertically
                            }
                            
                            // If cards overlap in both dimensions, position is invalid
                            if (hGap === 0 && vGap === 0) {
                                positionValid = false;
                                break;
                            }
                            
                            // If cards are horizontally adjacent (vertically overlapping, horizontally separated)
                            // Vertical gap must be exactly 12px
                            if (vOverlap && !hOverlap && vGap > 0 && Math.abs(vGap - gap) > 0.5) {
                                positionValid = false;
                                break;
                            }
                            
                            // If cards are vertically adjacent (horizontally overlapping, vertically separated)
                            // Horizontal gap must be exactly 12px
                            if (hOverlap && !vOverlap && hGap > 0 && Math.abs(hGap - gap) > 0.5) {
                                positionValid = false;
                                break;
                            }
                            
                            // If cards overlap in both dimensions but have gaps, check if gaps are exactly 12px
                            if (hOverlap && vOverlap) {
                                if (hGap > 0 && Math.abs(hGap - gap) > 0.5) {
                                    positionValid = false;
                                    break;
                                }
                                if (vGap > 0 && Math.abs(vGap - gap) > 0.5) {
                                    positionValid = false;
                                    break;
                                }
                            }
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
        arrangeMasonryLayout
    };
}

