// Configuration and constants module

// Detect if we're in a Chrome extension (hostname will be extension ID, not localhost)
function isChromeExtension() {
    // Extension IDs are long alphanumeric strings (32 chars)
    // Also check if chrome.runtime exists
    return window.location.hostname.length > 20 && /^[a-z]+$/.test(window.location.hostname) || 
           (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
}

// Set API URL - always use localhost for Chrome extensions (global)
var API_URL = (window.location.hostname === 'localhost' || isChromeExtension())
    ? 'http://localhost:3000' 
    : `https://${window.location.hostname.replace(/^.*?\.replit\.dev$/, match => match.replace(/^.*?-/, ''))}/api`.replace('/api', ':3000');

console.log('🌐 API_URL set to:', API_URL);
console.log('🌐 Current hostname:', window.location.hostname);
console.log('🌐 Is Chrome Extension:', isChromeExtension());

// Default card dimensions (global constants)
var DEFAULT_CARD_WIDTHS = {
    'mercury': 350,
    'gmail': 400,
    'tasks': 300,
    'reminder': 350,
    'ssense': 500,
    'weather': 300,
    'history': 350,
    'rss': 450,
    'note': 300,
    'link': 300,
    'chatgpt': 400,
    'google': 400
};

var DEFAULT_CARD_HEIGHTS = {
    'mercury': 400,
    'gmail': 500,
    'tasks': 143,
    'reminder': 200,
    'ssense': 600,
    'weather': 250,
    'history': 500,
    'rss': 600,
    'note': 143,
    'link': 150,
    'chatgpt': 500,
    'google': 300
};

// Layout constants (global)
var MASONRY_GAP = 12; // Gap between cards in masonry layout
var MASONRY_COLUMN_WIDTH = 280; // Base column width for masonry

// Default RSS feeds (global)
var DEFAULT_RSS_FEEDS = [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss' }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_URL,
        DEFAULT_CARD_WIDTHS,
        DEFAULT_CARD_HEIGHTS,
        MASONRY_GAP,
        MASONRY_COLUMN_WIDTH,
        DEFAULT_RSS_FEEDS,
        isChromeExtension
    };
}

