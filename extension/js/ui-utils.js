// UI utilities and view management module

// Dependencies: config.js, state.js, storage.js, card-layout.js, app-cards-other.js

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
        } else {
            console.error('Canvas not found in dots section!');
        }
        
        // Make dots section not scrollable - let body scroll instead
        dotsSection.style.overflow = 'visible';
        dotsSection.style.overflowY = 'visible';
        dotsSection.style.alignItems = 'flex-start';
        dotsSection.style.justifyContent = 'flex-start';
        dotsSection.style.maxHeight = 'none';
        dotsSection.style.height = 'auto';
        dotsSection.style.marginTop = '24px';
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
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.innerHTML = '';
        
        setTimeout(() => {
            const dotsRect = dotsSection.getBoundingClientRect();
            const maxX = Math.max(dotsRect.width - 300, 400);
            const maxY = Math.max(dotsRect.height - 200, 300);
            
            chrome.storage.local.get(['cards'], (result) => {
                if (result.cards) {
                    let needsReposition = false;
                    const updatedCards = result.cards.map(card => {
                        const updatedCard = { ...card };
                        if (card.x > maxX || card.y > maxY || card.x < 0 || card.y < 0) {
                            updatedCard.x = Math.min(Math.max(card.x, 50), maxX);
                            updatedCard.y = Math.min(Math.max(card.y, 50), maxY);
                            needsReposition = true;
                        }
                        return updatedCard;
                    });
                    
                    if (needsReposition) {
                        chrome.storage.local.set({ cards: updatedCards }, () => {
                            loadCards();
                        });
                    }
                }
            });
        }, 200);
        
        loadCards();
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

function updateGMTTime() {
    const gmtTimeElement = document.getElementById('gmtTime');
    if (!gmtTimeElement) return;
    
    const now = new Date();
    let hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const hoursStr = hours < 10 ? '0' + hours : hours;
    
    gmtTimeElement.textContent = `${hoursStr}:${minutesStr} ${ampm}`;
}

function startGMTTimeUpdate() {
    const gmtTimeInterval = State.getGMTTimeInterval();
    if (gmtTimeInterval) {
        clearInterval(gmtTimeInterval);
    }
    
    updateGMTTime();
    const newInterval = setInterval(updateGMTTime, 1000);
    State.setGMTTimeInterval(newInterval);
}

function stopGMTTimeUpdate() {
    const gmtTimeInterval = State.getGMTTimeInterval();
    if (gmtTimeInterval) {
        clearInterval(gmtTimeInterval);
        State.setGMTTimeInterval(null);
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showLoadingState,
        hideLoadingState,
        showUnauthenticatedView,
        hideUnauthenticatedView,
        showAuthenticatedView,
        updateUnauthenticatedUI,
        updateAuthenticatedHeader,
        getOrdinalSuffix,
        fetchWeatherForUnauth,
        fetchWeatherForAuth,
        setSignInButtonLoading,
        updateGMTTime,
        startGMTTimeUpdate,
        stopGMTTimeUpdate
    };
}

