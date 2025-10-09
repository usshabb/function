FUNCTION - Chrome Extension Installation

This folder contains ONLY the Chrome extension files. Do NOT load the entire project folder.

INSTALLATION STEPS:
1. Open Chrome and go to: chrome://extensions/
2. Enable "Developer mode" (toggle in top right corner)
3. Click "Load unpacked"
4. Select THIS FOLDER (the "extension" folder)
5. The extension is now installed!

USAGE:
- Open a new tab to see your Function workspace
- Sign in with Google to enable cloud sync across devices
- Your data syncs automatically to the cloud (you'll see "Saving" and "Saved" indicators)

CLOUD SYNC FEATURES:
- Cross-device synchronization (same workspace on all browsers)
- Encrypted storage for API keys (Mercury, etc.)
- Auto-save with 2-3 second delay
- Offline-first (works without internet, syncs when back online)

IMPORTANT NOTES:
- This extension folder should NOT contain any Python files or __pycache__ folders
- The backend API runs separately on Replit at port 3000
- All your cards, tasks, reminders, and settings sync automatically when signed in

BACKEND API CONFIGURATION:
The extension needs a backend API for cloud sync. The default configuration uses localhost.

DEFAULT SETUP - Local Development:
- Current API_URL: http://localhost:3000 (default in newtab.js line 11)
- Run the backend: node server.js
- Backend must be running for extension to work (RSS feeds, cloud sync, etc.)
- Cloud sync only works on this computer

PRODUCTION SETUP - Cross-device sync:
- Deploy the backend to Replit, Heroku, Railway, or any cloud platform
- Edit newtab.js line 11: const API_URL = 'https://your-deployed-backend-url';
- Cloud sync works across all devices

IMPORTANT: The backend MUST be running for the extension to function. Without it, RSS feeds, cloud sync, and all integrations will fail to load.

TROUBLESHOOTING:
- If you see errors about files starting with "_", you're loading the wrong folder
- Make sure you load the "extension" folder, not the parent project folder
- Check that the backend API is running and accessible at the API_URL
- If CORS errors appear, ensure the backend CORS settings allow your extension origin
- For development, use localhost; for production, deploy the backend to a cloud platform
