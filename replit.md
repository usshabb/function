# Canvas Tab - Chrome Extension

## Overview

Canvas Tab is a browser extension that replaces the default new tab page with a Notion-like canvas interface. Users can create and position draggable cards (notes, links, and app widgets) on an infinite canvas workspace. The extension provides a minimalist, clean interface for organizing information directly in the browser's new tab experience.

**Available Apps:**
- Mercury: Banking widget showing account balance and transactions
- ChatGPT: Quick access to ask ChatGPT questions
- Google Search: Quick search widget
- Gmail: View last 20 emails (requires OAuth setup)
- Tasks: To-do list manager with due dates and checkboxes
- Reminder: Set timed reminders with banner alerts at the top of the page
- SSENSE: Browse curated fashion products in a 3x5 grid with images, prices, and clickable links
- Weather: Current weather for your location with temperature, conditions, and forecast

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Single-Page Application (SPA) Pattern**
- The extension uses a pure HTML/CSS/JavaScript implementation without any framework dependencies
- Chosen for minimal bundle size and fast load times (critical for new tab experience)
- Alternative considered: React/Vue frameworks were avoided to reduce complexity and maintain performance
- Pros: Lightweight, instant load, no build step required
- Cons: More manual DOM manipulation required

**Canvas-Based UI Pattern**
- Implements an infinite canvas metaphor where cards can be positioned freely
- Uses absolute positioning with pixel-based coordinates stored for each card
- Drag-and-drop interaction model for repositioning cards
- Pros: Intuitive spatial organization, familiar Notion-like experience
- Cons: No automatic layout or grid snapping (could be added later)

**Component Structure**
- Toolbar: Fixed-position controls for adding new cards
- Canvas: Main workspace area containing all cards
- Cards: Individual draggable components with type-specific content (notes vs links)

### Data Storage

**Firebase Cloud Storage with Multi-Device Sync**
- **October 2025**: Migrated from local-only Chrome storage to Firebase Firestore for cloud synchronization
- Users can sign in with Google to sync their workspace across all devices
- Firestore structure:
  - `/users/{uid}/cards/` - All user cards
  - `/users/{uid}/tasks/` - Tasks from Tasks app
  - `/users/{uid}/reminders/` - Reminders from Reminder app
  - `/users/{uid}/credentials/tokens` - Encrypted API credentials (Mercury, etc.)
- Real-time listeners sync changes instantly across devices
- Fallback to Chrome local storage for anonymous (non-logged-in) users
- One-time migration automatically transfers local data to cloud on first login
- Pros: Cloud backup, multi-device sync, real-time collaboration potential
- Cons: Requires internet connection, external Firebase dependency

**Authentication Flow**
- Google OAuth via Firebase Authentication
- Login button in toolbar for easy access
- User email displayed when logged in with logout option
- Anonymous users can still use extension with local storage only
- Migration from local to cloud happens transparently on first login

**Data Model**
```
Card {
  id: string (timestamp-based)
  type: 'note' | 'link' | 'mercury' | 'chatgpt' | 'google' | 'gmail' | 'tasks' | 'reminder' | 'ssense' | 'weather'
  x: number (pixel position)
  y: number (pixel position)  
  content: string (varies by card type)
}

Task {
  id: string (timestamp-based)
  text: string
  completed: boolean
  dueDate: string (ISO date)
}

Reminder {
  id: string (timestamp-based)
  text: string
  dateTime: string (ISO datetime)
  triggered: boolean
}
```

### Chrome Extension Architecture

**Manifest V3 Structure**
- Uses the latest Manifest V3 specification for Chrome extensions
- Overrides the `newtab` page to replace default browser behavior
- Requires only `storage` permission for minimal user privacy impact
- Pros: Modern extension standards, minimal permissions
- Cons: MV3 is more restrictive than MV2, but not a concern for this use case

**File Organization**
- `manifest.json`: Extension configuration and permissions
- `newtab.html`: Main application entry point
- `newtab.js`: Core application logic and state management
- `styles.css`: All visual styling
- `index.html`: Installation guide/landing page (separate from extension)
- Icon files: Extension branding at multiple resolutions

### State Management

**In-Memory Card Array**
- Cards are maintained in a JavaScript array during runtime
- All operations (create, update, delete, move) modify this array and trigger saves
- Load operation populates array from Chrome storage on initialization
- Pros: Simple, predictable state management
- Cons: No undo/redo functionality (could be added with command pattern)

### Interaction Model

**Drag and Drop System**
- Custom implementation using mouse events (not HTML5 drag API)
- Tracks dragged card reference and mouse offset for smooth dragging
- Updates card position in real-time and persists on drop
- Pros: Full control over drag behavior and visual feedback
- Cons: Touch device support would require additional event handlers

## External Dependencies

**Chrome Extension APIs**
- `chrome.storage`: For persisting card data across sessions (fallback for anonymous users)
- `chrome_url_overrides`: To replace the new tab page

**Firebase Services (Added October 2025)**
- Firebase Authentication: Google OAuth sign-in
- Firebase Firestore: Cloud database for real-time multi-device sync
- Firebase SDK v11.0.1 (modular imports)
- Configuration stored in Replit Secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_APP_ID`
- Rationale: Enable cross-device synchronization and cloud backup

**Third-Party APIs**
- Mercury API: Banking data integration
- Open-Meteo API: Weather data (free, no API key required)
- SSENSE API: Fashion products (custom endpoint)
- Vanilla JavaScript implementation for all other features
- Rationale: Minimize load time while enabling powerful integrations

**Browser Compatibility**
- Designed specifically for Chromium-based browsers (Chrome, Edge, Brave, etc.)
- Uses modern CSS (flexbox, CSS variables) and ES6+ JavaScript with async/await
- Firebase requires modern browser with ES6 module support
- Not compatible with Firefox or Safari without manifest adjustments