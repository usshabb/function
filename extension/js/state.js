// Global state management module

let cards = [];
let tasks = [];
let reminders = [];
let currentUserId = null;
let syncTimeout = null;
let reminderCheckInterval = null;

// Drag and drop state
let draggedCard = null;
let offset = { x: 0, y: 0 };
let dragOverCard = null;
let dropIndicator = null;

// Resize state
let resizingCard = null;
let resizeHandle = null;

// GMT time update interval
let gmtTimeInterval = null;

// Export state getters and setters
const State = {
    getCards: () => cards,
    setCards: (newCards) => { cards = newCards; },
    
    getTasks: () => tasks,
    setTasks: (newTasks) => { tasks = newTasks; },
    
    getReminders: () => reminders,
    setReminders: (newReminders) => { reminders = newReminders; },
    
    getCurrentUserId: () => currentUserId,
    setCurrentUserId: (userId) => { currentUserId = userId; },
    
    getSyncTimeout: () => syncTimeout,
    setSyncTimeout: (timeout) => { syncTimeout = timeout; },
    
    getReminderCheckInterval: () => reminderCheckInterval,
    setReminderCheckInterval: (interval) => { reminderCheckInterval = interval; },
    
    // Drag state
    getDraggedCard: () => draggedCard,
    setDraggedCard: (card) => { draggedCard = card; },
    
    getOffset: () => offset,
    setOffset: (newOffset) => { offset = newOffset; },
    
    getDragOverCard: () => dragOverCard,
    setDragOverCard: (card) => { dragOverCard = card; },
    
    getDropIndicator: () => dropIndicator,
    setDropIndicator: (indicator) => { dropIndicator = indicator; },
    
    // Resize state
    getResizingCard: () => resizingCard,
    setResizingCard: (card) => { resizingCard = card; },
    
    getResizeHandle: () => resizeHandle,
    setResizeHandle: (handle) => { resizeHandle = handle; },
    
    // GMT time
    getGMTTimeInterval: () => gmtTimeInterval,
    setGMTTimeInterval: (interval) => { gmtTimeInterval = interval; }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = State;
}

