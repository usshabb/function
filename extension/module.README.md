# Module Architecture Documentation

This document describes the modular structure of the JavaScript codebase, which has been refactored from a single 3798-line file into smaller, well-organized modules.

## Module Overview

The codebase is organized into **15 modules**, each handling a specific aspect of the application functionality. All modules are located in the `extension/js/` directory.

### Core Modules

#### 1. `config.js` (~60 lines)
**Purpose**: Configuration and constants management

**Functions**:
- `isChromeExtension()` - Detects if running in Chrome extension environment
- Exports API_URL, default card dimensions, masonry layout constants, and default RSS feeds

**Dependencies**: None

**Used by**: All other modules

---

#### 2. `state.js` (~80 lines)
**Purpose**: Global state management

**Exports**: State object with getters and setters for:
- `cards` - Array of card objects
- `tasks` - Array of task objects
- `reminders` - Array of reminder objects
- `currentUserId` - Current authenticated user ID
- `syncTimeout` - Timeout for debounced sync
- `reminderCheckInterval` - Interval for reminder checking
- Drag and drop state (draggedCard, offset, dragOverCard, dropIndicator)
- Resize state (resizingCard, resizeHandle)
- GMT time interval

**Dependencies**: None

**Used by**: All modules that need to access or modify global state

---

### Card Management Modules

#### 3. `card-core.js` (~200 lines)
**Purpose**: Core card operations (creation, rendering, deletion, updates)

**Functions**:
- `getDefaultCardWidth(type)` - Returns default width for card type
- `getDefaultCardHeight(type)` - Returns default height for card type
- `createCard(type, data)` - Creates a new card
- `renderCard(card)` - Renders a card to the DOM
- `renderLinkInput(container, cardId)` - Renders link input form
- `reloadCard(cardId)` - Reloads a card after content update
- `updateCardContent(cardId, content)` - Updates card content
- `deleteCard(cardId)` - Deletes a card

**Dependencies**: `config.js`, `state.js`

**Used by**: `storage.js`, `app-modal.js`, main initialization

---

#### 4. `card-layout.js` (~200 lines)
**Purpose**: Card layout and masonry positioning

**Functions**:
- `updateCanvasHeight()` - Updates canvas height based on card positions
- `checkCardOverlap(cardX, cardY, cardWidth, cardHeight, excludeCardId)` - Checks for card overlaps
- `findNearestMasonryPosition(cardWidth, cardHeight, excludeCardId)` - Finds valid masonry position
- `arrangeMasonryLayout()` - Arranges cards in masonry layout

**Dependencies**: `config.js`, `state.js`, `card-core.js`

**Used by**: `card-core.js`, `card-drag.js`, `storage.js`, main initialization

---

#### 5. `card-drag.js` (~220 lines)
**Purpose**: Drag and drop functionality

**Functions**:
- `startDrag(e)` - Initiates card dragging
- `drag(e)` - Handles drag movement with auto-scroll
- `stopDrag()` - Completes drag operation, handles card swapping
- `getCardAtPosition(clientX, clientY)` - Gets card at mouse position
- `createDropIndicator()` - Creates visual drop indicator
- `showDropIndicator(targetCard)` - Shows drop indicator on target
- `hideDropIndicator()` - Hides drop indicator

**Dependencies**: `state.js`, `card-core.js`, `card-layout.js`

**Used by**: `card-core.js` (via event listeners)

---

#### 6. `card-resize.js` (~80 lines)
**Purpose**: Card resize functionality

**Functions**:
- `startResize(cardId, e)` - Initiates card resizing

**Dependencies**: `state.js`, `card-core.js`, `storage.js`

**Used by**: `card-core.js` (via event listeners)

---

### Storage and Sync Module

#### 7. `storage.js` (~280 lines)
**Purpose**: Storage operations and backend synchronization

**Functions**:
- `saveCards()` - Saves cards to local storage and triggers sync
- `loadCards()` - Loads cards from storage and renders them
- `debouncedSync()` - Debounces backend sync (2 second delay)
- `syncStateToBackend()` - Syncs all state to backend
- `syncTokensToBackend()` - Syncs OAuth tokens to backend
- `loadStateFromBackend()` - Loads state from backend
- `loadTokensFromBackend()` - Loads tokens from backend
- `createOrUpdateUser(userInfo)` - Creates or updates user in backend
- `migrateLocalDataToBackend()` - Migrates local data to backend
- `getStarredSites()` - Gets starred sites from storage
- `getAllRssFeeds()` - Gets all RSS feeds from storage
- `loadToggledSites()` - Gets toggled sites from storage
- `showSyncStatus(status)` - Shows sync status indicator

**Dependencies**: `config.js`, `state.js`, `card-core.js`, `card-layout.js`

**Used by**: Most modules for data persistence

---

### Authentication Module

#### 8. `auth.js` (~250 lines)
**Purpose**: Authentication and user management

**Functions**:
- `checkAuthStatus()` - Checks current authentication status
- `signInWithGoogle()` - Initiates Google OAuth sign-in
- `signOutFromGoogle()` - Signs out user
- `refreshAuthToken(oldToken)` - Refreshes expired auth token
- `getUserInfo(token)` - Fetches user info from Google API
- `updateAuthUI(userInfo)` - Updates authentication UI elements
- `isMicrosoftEdge()` - Detects Microsoft Edge browser

**Dependencies**: `config.js`, `state.js`, `storage.js`, `ui-utils.js`

**Used by**: Main initialization, `ui-utils.js`

---

### App Card Modules

#### 9. `app-cards-mercury.js` (~180 lines)
**Purpose**: Mercury banking card functionality

**Functions**:
- `promptMercuryToken()` - Prompts user for Mercury API token
- `createMercuryCard()` - Creates Mercury card
- `fetchMercuryData(token)` - Fetches account and transaction data
- `renderMercuryCard(cardEl, cardId)` - Renders Mercury card content

**Dependencies**: `config.js`, `state.js`, `card-core.js`, `storage.js`

**Used by**: `app-modal.js`, `card-core.js`

---

#### 10. `app-cards-simple.js` (~90 lines)
**Purpose**: Simple app cards (ChatGPT, Google Search)

**Functions**:
- `createChatGPTCard()` - Creates ChatGPT card
- `renderChatGPTCard(cardEl, cardId)` - Renders ChatGPT card
- `createGoogleSearchCard()` - Creates Google Search card
- `renderGoogleSearchCard(cardEl, cardId)` - Renders Google Search card

**Dependencies**: `card-core.js`, `storage.js`

**Used by**: `app-modal.js`, `card-core.js`

---

#### 11. `app-cards-gmail.js` (~220 lines)
**Purpose**: Gmail card functionality

**Functions**:
- `authenticateGmail()` - Authenticates with Gmail OAuth
- `createGmailCard()` - Creates Gmail card
- `fetchGmailMessages(token)` - Fetches Gmail messages
- `renderGmailCard(cardEl, cardId)` - Renders Gmail card content

**Dependencies**: `config.js`, `state.js`, `card-core.js`, `storage.js`

**Used by**: `app-modal.js`, `card-core.js`

---

#### 12. `app-cards-other.js` (~300 lines)
**Purpose**: Other app cards (SSENSE, Weather, History, RSS)

**Functions**:
- **SSENSE**: `createSSENSECard()`, `fetchSSENSEProducts()`, `renderSSENSECard()`
- **Weather**: `createWeatherCard()`, `fetchWeatherData()`, `getWeatherDescription()`, `renderWeatherCard()`
- **History**: `createHistoryCard()`, `extractRootDomain()`, `fetchBrowsingHistory()`, `loadStarredSites()`, `saveStarredSites()`, `toggleStarredSite()`, `loadToggledSites()`, `saveToggledSites()`, `toggleSiteForOpening()`, `renderHistoryCard()`
- **RSS**: `createRssCard()`, `fetchRssFeed()`, `loadRssFeeds()`, `saveRssFeeds()`, `renderRssCard()`, `showFeedManager()`

**Dependencies**: `config.js`, `state.js`, `card-core.js`, `storage.js`

**Used by**: `app-modal.js`, `card-core.js`

---

### Tasks and Reminders Module

#### 13. `tasks-reminders.js` (~280 lines)
**Purpose**: Tasks and reminders management

**Functions**:
- **Tasks**: `createTasksCard()`, `renderTasksCard()`, `renderTasksList()`, `loadTasks()`, `saveTasks()`, `formatDate()`
- **Reminders**: `createReminderCard()`, `renderReminderCard()`, `renderRemindersList()`, `loadReminders()`, `saveReminders()`, `startReminderChecker()`, `showReminderBanner()`

**Dependencies**: `state.js`, `storage.js`, `card-core.js`

**Used by**: `app-modal.js`, `card-core.js`, main initialization

---

### UI and Modal Modules

#### 14. `app-modal.js` (~50 lines)
**Purpose**: App selection modal management

**Functions**:
- `openAppModal()` - Opens app selection modal
- `closeAppModal()` - Closes app selection modal
- `handleAppSelection(appType)` - Handles app type selection

**Dependencies**: All app card modules, `tasks-reminders.js`

**Used by**: Main initialization

---

#### 15. `ui-utils.js` (~280 lines)
**Purpose**: UI utilities and view management

**Functions**:
- `showLoadingState()` - Shows loading indicator
- `hideLoadingState()` - Hides loading indicator
- `showUnauthenticatedView()` - Shows unauthenticated view
- `showAuthenticatedView(userInfo)` - Shows authenticated view
- `updateUnauthenticatedUI(userInfo)` - Updates unauthenticated UI
- `updateAuthenticatedHeader(userInfo)` - Updates authenticated header
- `getOrdinalSuffix(day)` - Gets ordinal suffix for date
- `fetchWeatherForUnauth(element)` - Fetches weather for unauthenticated view
- `setSignInButtonLoading(loading)` - Sets sign-in button loading state
- `updateGMTTime()` - Updates GMT time display
- `startGMTTimeUpdate()` - Starts GMT time updates
- `stopGMTTimeUpdate()` - Stops GMT time updates

**Dependencies**: `config.js`, `state.js`, `storage.js`, `card-layout.js`, `app-cards-other.js`, `auth.js`

**Used by**: `auth.js`, main initialization

---

### Main Initialization

#### 16. `main.js` (~70 lines)
**Purpose**: Application initialization and event listener setup

**Functions**:
- Sets up all DOM event listeners
- Initializes data loading
- Handles window resize events
- Coordinates initial app startup

**Dependencies**: All other modules

**Used by**: Browser (loaded on page load)

---

## Module Loading Order

Modules must be loaded in the following order (as specified in `newtab.html`):

1. `config.js` - Configuration and constants
2. `state.js` - Global state management
3. `card-core.js` - Core card operations
4. `card-layout.js` - Layout management
5. `card-drag.js` - Drag and drop
6. `card-resize.js` - Resize functionality
7. `storage.js` - Storage and sync
8. `app-cards-mercury.js` - Mercury card
9. `app-cards-simple.js` - Simple cards
10. `app-cards-gmail.js` - Gmail card
11. `app-cards-other.js` - Other cards
12. `tasks-reminders.js` - Tasks and reminders
13. `auth.js` - Authentication
14. `app-modal.js` - App modal
15. `ui-utils.js` - UI utilities
16. `main.js` - Main initialization

## Key Design Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Dependency Management**: Modules clearly declare their dependencies
3. **State Management**: Centralized state management through `state.js`
4. **No Functionality Loss**: All original functionality is preserved
5. **Size Limits**: Each module is under 300 lines (most are under 250)
6. **Consistency**: Consistent naming conventions and code structure

## Module Communication

Modules communicate through:
- **Global State**: Via `State` object from `state.js`
- **Function Calls**: Direct function calls between modules
- **Event Listeners**: DOM event listeners for user interactions
- **Storage API**: Chrome storage API for persistence

## Notes

- All modules use a simple module pattern with conditional exports for potential Node.js compatibility
- The original `newtab.js` file should be kept as a backup but is no longer used
- All functionality from the original file has been preserved and organized into logical modules
- The codebase is now more maintainable, testable, and easier to extend

