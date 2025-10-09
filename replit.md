# Function - Chrome Extension

## Overview

Function is a browser extension that replaces the default new tab page with a personalized dashboard interface. Users can create and position draggable cards (notes, links, and app widgets) on an infinite canvas workspace. The extension provides a minimalist, clean interface for organizing information directly in the browser's new tab experience.

**Available Apps:**
- Mercury: Banking widget showing account balance and transactions
- ChatGPT: Quick access to ask ChatGPT questions
- Google Search: Quick search widget
- Gmail: View last 20 emails (requires OAuth setup)
- Tasks: To-do list manager with due dates and checkboxes
- Reminder: Set timed reminders with banner alerts at the top of the page
- SSENSE: Browse curated fashion products in a 3x5 grid with images, prices, and clickable links
- Weather: Current weather for your location with temperature, conditions, and forecast
- Top Sites: Ranked list of top 20 most visited websites from past 7 days with logos and visit counts. Users can star/pin favorite sites to keep them at the top while preserving original rank numbers for unstarred sites
- RSS Reader: Follow tech blogs and news sources with latest 5 articles displayed. Starts with 5 default feeds (TechCrunch, The Verge, Hacker News, Ars Technica, Wired). Users can add/remove custom RSS feeds via the Manage Feeds interface

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Updates

**Cloud Sync with PostgreSQL Backend (Added October 2025)**
- Complete state synchronization across browsers and devices
- PostgreSQL database backend hosted on Replit
- Auto-save with 2-3 second debounce for optimal performance
- Encrypted storage for sensitive API tokens (Mercury, etc.)
- Visual sync status indicator in toolbar (saving/saved/error states)
- Offline-first architecture with automatic sync when reconnected

**Google Authentication (Added October 2025)**
- Users can now sign in with their Google account
- One-click authentication using Chrome's built-in OAuth
- Displays user profile (avatar, name) in toolbar
- Persistent authentication across browser sessions
- Automatic token validation and cleanup on page load

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

**Hybrid Storage Architecture**
- Local: Chrome Storage API (`chrome.storage.local`) for offline-first capability
- Cloud: PostgreSQL database on Replit for cross-device sync
- Auto-sync triggered on all state changes with debounced saves (2-3s delay)
- Encrypted token storage using Fernet (AES-128) for sensitive API keys
- User identified by Google ID for cloud state lookup

**Chrome Storage API (Local)**
- Uses `chrome.storage.local` for immediate offline access
- Cards stored as JSON array with properties: id, type, x/y coordinates, and content
- Chosen over localStorage for better Chrome extension integration
- Pros: Native extension API, instant access, offline capability
- Cons: Chrome-only, requires explicit permission in manifest

**Data Model**
```
Card {
  id: string (timestamp-based)
  type: 'note' | 'link'
  x: number (pixel position)
  y: number (pixel position)  
  content: string
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
- `extension/` folder: Contains ONLY extension files for Chrome installation
  - `manifest.json`: Extension configuration and permissions
  - `newtab.html`: Main application entry point
  - `newtab.js`: Core application logic and state management
  - `styles.css`: All visual styling
  - `README.txt`: Installation instructions
  - Icon files: Extension branding at multiple resolutions
- `main.py`: Flask backend API for cloud sync
- `models.py`: Database models (User, UserState, UserToken)
- `index.html`: Installation guide/landing page (separate from extension)

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

### RSS Reader Implementation

**Feed Fetching and Parsing**
- Uses CORS proxy (https://api.cors.lol/?url=) to fetch RSS feeds from external sources
- Parses XML using browser's native DOMParser API
- Extracts article titles, links, and publication dates from RSS items
- Combines articles from all feeds and sorts by date (newest first)
- Displays top 5 most recent articles across all sources

**Feed Management**
- Each RSS card stores its own feed list in chrome.storage.local using card ID as key
- Default feeds: TechCrunch, The Verge, Hacker News, Ars Technica, Wired
- Users can add custom RSS feeds by providing name and URL
- Users can remove unwanted feeds from their collection
- Feed customizations persist across browser sessions

**Article Display**
- Shows article title, source, and relative time ("2 hours ago", "Yesterday", etc.)
- Articles are clickable and open in new browser tabs
- Clean card-based layout with hover effects
- "Manage Feeds" button toggles between article view and feed management interface

## Backend Architecture

**Python Flask API (Cloud Sync)**
- REST API endpoints for state management
- PostgreSQL database with SQLAlchemy ORM
- Encryption using Fernet (cryptography library) for token storage
- CORS enabled for cross-origin extension requests

**API Endpoints**
- `POST /api/user`: Create or update user profile
- `GET /api/state/<user_id>`: Retrieve user's complete state
- `POST /api/state/<user_id>`: Save user's complete state
- `GET /api/tokens/<user_id>/<token_type>`: Retrieve encrypted token
- `POST /api/tokens/<user_id>/<token_type>`: Save encrypted token
- `DELETE /api/tokens/<user_id>/<token_type>`: Delete token

**Database Tables**
- `users`: User profiles (id, email, name, picture)
- `user_state`: Complete canvas state (cards, tasks, reminders, RSS feeds)
- `user_tokens`: Encrypted API tokens (Mercury, etc.)

**Security**
- API keys encrypted with Fernet (32-byte key derived from SESSION_SECRET)
- User authentication via Google OAuth token validation
- HTTPS-only communication between extension and backend

## External Dependencies

**Chrome Extension APIs**
- `chrome.storage`: For persisting card data across sessions
- `chrome.identity`: For Google OAuth authentication
- `chrome_url_overrides`: To replace the new tab page

**Frontend Dependencies**
- No third-party libraries - pure vanilla JavaScript
- All functionality implemented with native browser APIs
- Rationale: Minimize load time, reduce security surface area, simplify distribution

**Backend Dependencies (Python)**
- Flask: Web framework for API endpoints
- Flask-CORS: Cross-origin request handling
- Flask-SQLAlchemy: Database ORM
- cryptography: Token encryption (Fernet)
- psycopg2-binary: PostgreSQL adapter

**Browser Compatibility**
- Designed specifically for Chromium-based browsers (Chrome, Edge, Brave, etc.)
- Uses modern CSS (flexbox, CSS variables if present) and ES6+ JavaScript
- Not compatible with Firefox or Safari without manifest adjustments