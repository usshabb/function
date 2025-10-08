CANVAS TAB - Chrome Extension Installation

This folder contains ONLY the Chrome extension files. Do NOT load the entire project folder.

INSTALLATION STEPS:
1. Open Chrome and go to: chrome://extensions/
2. Enable "Developer mode" (toggle in top right corner)
3. Click "Load unpacked"
4. Select THIS FOLDER (the "extension" folder)
5. The extension is now installed!

USAGE:
- Open a new tab to see your Canvas Tab workspace
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

BACKEND API:
The extension connects to: https://76d9489c-0e19-4d83-beab-8f54819c405c-00-2y5fxagw85mdi.kirk.replit.dev:3000

TROUBLESHOOTING:
- If you see errors about files starting with "_", you're loading the wrong folder
- Make sure you load the "extension" folder, not the parent project folder
- Check that the backend API is running on Replit (Backend workflow must be active)
- If CORS errors appear, ensure the backend is running on port 3000
