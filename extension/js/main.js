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
    const aiModelModal = document.getElementById('aiModelModal');
    let selectedModel = null;
    
    // AI Model URLs
    const aiModelUrls = {
        gemini: 'https://www.google.com/search?q={query}',
        openai: 'https://chatgpt.com/?prompt={query}',
        perplexity: 'https://www.perplexity.ai/search?q={query}',
        grok: 'https://grok.com/?q={query}'
    };
    
    // AI Model logos
    const aiModelLogos = {
        gemini: 'assets/gemin_logo.svg',
        openai: 'assets/openai_logo.svg',
        perplexity: 'assets/perplexity_logo.svg',
        grok: 'assets/grok_logo.svg'
    };
    
    // AI Model names
    const aiModelNames = {
        gemini: 'Gemini',
        openai: 'OpenAI',
        perplexity: 'Perplexity',
        grok: 'Grok'
    };
    
    // Toggle modal
    function toggleModal() {
        if (aiModelModal && unauthModelBtn) {
            const isHidden = aiModelModal.classList.contains('ai-model-modal-hidden');
            const chevron = unauthModelBtn.querySelector('svg');
            
            if (isHidden) {
                // Show modal
                aiModelModal.classList.remove('ai-model-modal-hidden');
                if (chevron) {
                    chevron.classList.add('chevron-open');
                }
            } else {
                // Hide modal
                aiModelModal.classList.add('ai-model-modal-hidden');
                if (chevron) {
                    chevron.classList.remove('chevron-open');
                }
            }
        }
    }
    
    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        if (aiModelModal && !aiModelModal.classList.contains('ai-model-modal-hidden')) {
            if (!aiModelModal.contains(e.target) && !unauthModelBtn.contains(e.target)) {
                aiModelModal.classList.add('ai-model-modal-hidden');
                const chevron = unauthModelBtn.querySelector('svg');
                if (chevron) {
                    chevron.classList.remove('chevron-open');
                }
            }
        }
    });
    
    // Update button when model is selected
    function updateButton(model) {
        if (!unauthModelBtn) return;
        
        const buttonSpan = unauthModelBtn.querySelector('span');
        const buttonSvg = unauthModelBtn.querySelector('svg');
        
        if (model) {
            // Remove existing logo if any
            const existingImg = unauthModelBtn.querySelector('img');
            if (existingImg) {
                existingImg.remove();
            }
            
            // Add logo (clickable to change model)
            const img = document.createElement('img');
            img.src = aiModelLogos[model];
            img.alt = aiModelNames[model];
            img.className = 'ai-model-btn-logo ai-model-btn-logo-clickable';
            img.title = 'Click to change AI model';
            
            // Update text
            buttonSpan.textContent = 'Search';
            
            // Insert logo before text
            unauthModelBtn.insertBefore(img, buttonSpan);
            
            // Hide dropdown arrow
            if (buttonSvg) {
                buttonSvg.style.display = 'none';
            }
        } else {
            // Reset to default
            const existingImg = unauthModelBtn.querySelector('img');
            if (existingImg) {
                existingImg.remove();
            }
            buttonSpan.textContent = 'Select the AI model';
            if (buttonSvg) {
                buttonSvg.style.display = 'block';
            }
        }
    }
    
    // Handle model selection
    if (aiModelModal) {
        const modelOptions = aiModelModal.querySelectorAll('.ai-model-option');
        modelOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const model = e.currentTarget.dataset.model;
                selectedModel = model;
                updateButton(model);
                // Close modal after selection
                aiModelModal.classList.add('ai-model-modal-hidden');
                const chevron = unauthModelBtn.querySelector('svg');
                if (chevron) {
                    chevron.classList.remove('chevron-open');
                }
            });
        });
    }
    
    // Handle search input
    if (unauthSearchInput) {
        unauthSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = unauthSearchInput.value.trim();
                if (query && selectedModel) {
                    performSearch(query, selectedModel);
                }
            }
        });
    }
    
    // Handle button click
    if (unauthModelBtn) {
        unauthModelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // If model is selected and user clicks on logo, show modal to change
            const clickedImg = e.target.closest('img');
            if (selectedModel && clickedImg) {
                toggleModal();
                return;
            }
            
            if (selectedModel) {
                // If model is selected, perform search
                const query = unauthSearchInput ? unauthSearchInput.value.trim() : '';
                if (query) {
                    performSearch(query, selectedModel);
                }
            } else {
                // If no model selected, show modal
                toggleModal();
            }
        });
    }
    
    // Perform search
    function performSearch(query, model) {
        if (!query || !model) return;
        
        const url = aiModelUrls[model].replace('{query}', encodeURIComponent(query));
        window.open(url, '_blank');
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

