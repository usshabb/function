// Main initialization file - sets up event listeners and initializes the application

// Dependencies: All other modules

document.addEventListener('DOMContentLoaded', () => {
    // Show loading state first to prevent blinking
    showLoadingState();
    
    // Load data in background
    loadCards();
    loadTasks();
    loadReminders();
    startReminderChecker();
    
    // Check auth status - will hide loading and show appropriate view
    checkAuthStatus();
    
    // Set up event listeners
    document.getElementById('addNote').addEventListener('click', () => createCard('note'));
    document.getElementById('addLink').addEventListener('click', () => createCard('link'));
    document.getElementById('addApp').addEventListener('click', openAppModal);
    document.getElementById('closeModal').addEventListener('click', closeAppModal);
    document.getElementById('signInBtn').addEventListener('click', signInWithGoogle);
    document.getElementById('signOutBtn').addEventListener('click', signOutFromGoogle);
    
    const unauthSignInBtn = document.getElementById('unauthSignInBtn');
    if (unauthSignInBtn) {
        unauthSignInBtn.addEventListener('click', signInWithGoogle);
    }
    
    const unauthSearchInput = document.getElementById('unauthSearchInput');
    const unauthModelBtn = document.getElementById('unauthModelBtn');
    
    if (unauthSearchInput) {
        unauthSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = unauthSearchInput.value.trim();
                if (query) {
                    console.log('Search query:', query);
                }
            }
        });
    }
    
    if (unauthModelBtn) {
        unauthModelBtn.addEventListener('click', () => {
            console.log('AI model selector clicked');
        });
    }
    
    // App selection modal handlers
    document.querySelectorAll('.app-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const appType = e.currentTarget.dataset.app;
            handleAppSelection(appType);
        });
    });
    
    document.getElementById('appModal').addEventListener('click', (e) => {
        if (e.target.id === 'appModal') {
            closeAppModal();
        }
    });
    
    // Handle window resize to rearrange masonry layout
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            arrangeMasonryLayout();
            updateCanvasHeight();
        }, 250);
    });
});

