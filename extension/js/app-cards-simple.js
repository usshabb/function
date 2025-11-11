// Simple app cards module (ChatGPT, Google Search)

// Dependencies: card-core.js, storage.js

function createChatGPTCard() {
    const card = {
        id: Date.now().toString(),
        type: 'chatgpt',
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 100,
        content: ''
    };
    
    State.getCards().push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

function renderChatGPTCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = `
        <div style="margin-bottom: 8px; color: #9b9a97; font-size: 13px;">Ask ChatGPT anything</div>
        <textarea id="chatgpt-input-${cardId}" placeholder="Type your question here..." style="width: 100%; min-height: 80px; border: 1px solid #e3e2e0; border-radius: 6px; padding: 10px; font-family: inherit; font-size: 14px; resize: vertical; margin-bottom: 12px;"></textarea>
        <button class="connect-btn" id="chatgpt-btn-${cardId}">Ask ChatGPT</button>
    `;
    
    const input = content.querySelector(`#chatgpt-input-${cardId}`);
    const button = content.querySelector(`#chatgpt-btn-${cardId}`);
    
    const askChatGPT = () => {
        const question = input.value.trim();
        if (question) {
            const encodedQuestion = encodeURIComponent(question);
            window.open(`https://chat.openai.com/?q=${encodedQuestion}`, '_blank');
            input.value = '';
        }
    };
    
    button.addEventListener('click', askChatGPT);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            askChatGPT();
        }
    });
}

function createGoogleSearchCard() {
    const card = {
        id: Date.now().toString(),
        type: 'google',
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 50,
        content: ''
    };
    
    State.getCards().push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

function renderGoogleSearchCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = `
        <div style="margin-bottom: 8px; color: #9b9a97; font-size: 13px;">Search Google</div>
        <div style="display: flex; gap: 8px;">
            <input type="text" id="google-input-${cardId}" placeholder="Enter search query..." style="flex: 1; border: 1px solid #e3e2e0; border-radius: 6px; padding: 10px; font-family: inherit; font-size: 14px;" />
            <button class="connect-btn" id="google-btn-${cardId}" style="width: auto; padding: 10px 20px;">Search</button>
        </div>
    `;
    
    const input = content.querySelector(`#google-input-${cardId}`);
    const button = content.querySelector(`#google-btn-${cardId}`);
    
    const searchGoogle = () => {
        const query = input.value.trim();
        if (query) {
            const encodedQuery = encodeURIComponent(query);
            window.open(`https://www.google.com/search?q=${encodedQuery}`, '_blank');
            input.value = '';
        }
    };
    
    button.addEventListener('click', searchGoogle);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchGoogle();
        }
    });
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createChatGPTCard,
        renderChatGPTCard,
        createGoogleSearchCard,
        renderGoogleSearchCard
    };
}

