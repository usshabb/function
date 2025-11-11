// Other app cards module (SSENSE, Weather, History, RSS)

// Dependencies: config.js, state.js, card-core.js, storage.js

// SSENSE Card
function createSSENSECard() {
    const card = {
        id: Date.now().toString(),
        type: 'ssense',
        x: window.innerWidth / 2 - 250,
        y: window.innerHeight / 2 - 200,
        content: ''
    };
    
    State.getCards().push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

async function fetchSSENSEProducts() {
    try {
        const response = await fetch('https://ssense-scrape-ushabbir.replit.app/api/products', {
            method: 'GET',
            headers: {
                'X-API-KEY': '1234'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch SSENSE products');
        }
        
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching SSENSE products:', error);
        return [];
    }
}

async function renderSSENSECard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading products...</div>';
    
    const products = await fetchSSENSEProducts();
    
    if (products.length === 0) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No products available</div>';
        return;
    }
    
    const limitedProducts = products.slice(0, 15);
    
    content.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'ssense-grid';
    
    limitedProducts.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'ssense-product-card';
        productCard.style.cursor = 'pointer';
        
        const img = document.createElement('img');
        img.src = product.images[0]?.url || '';
        img.alt = product.images[0]?.alt_text || product.name;
        img.className = 'ssense-product-image';
        
        const name = document.createElement('div');
        name.className = 'ssense-product-name';
        name.textContent = product.name;
        
        const price = document.createElement('div');
        price.className = 'ssense-product-price';
        if (product.sale_price && product.sale_price < product.original_price) {
            price.innerHTML = `
                <span class="ssense-sale-price">$${product.sale_price}</span>
                <span class="ssense-original-price">$${product.original_price}</span>
            `;
        } else {
            price.textContent = `$${product.original_price}`;
        }
        
        productCard.appendChild(img);
        productCard.appendChild(name);
        productCard.appendChild(price);
        
        productCard.addEventListener('click', () => {
            window.open(product.link, '_blank');
        });
        
        grid.appendChild(productCard);
    });
    
    content.appendChild(grid);
}

// Weather Card
function createWeatherCard() {
    const card = {
        id: Date.now().toString(),
        type: 'weather',
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 100,
        content: ''
    };
    
    State.getCards().push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

async function fetchWeatherData(latitude, longitude) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch weather data');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
}

function getWeatherDescription(weatherCode) {
    const weatherCodes = {
        0: '☀️ Clear', 1: '🌤️ Mainly Clear', 2: '⛅ Partly Cloudy', 3: '☁️ Overcast',
        45: '🌫️ Foggy', 48: '🌫️ Foggy', 51: '🌦️ Light Drizzle', 53: '🌦️ Drizzle',
        55: '🌧️ Heavy Drizzle', 61: '🌧️ Light Rain', 63: '🌧️ Rain', 65: '🌧️ Heavy Rain',
        71: '🌨️ Light Snow', 73: '🌨️ Snow', 75: '🌨️ Heavy Snow', 77: '❄️ Snow Grains',
        80: '🌦️ Light Showers', 81: '🌧️ Showers', 82: '🌧️ Heavy Showers',
        85: '🌨️ Snow Showers', 86: '🌨️ Heavy Snow Showers', 95: '⛈️ Thunderstorm',
        96: '⛈️ Thunderstorm with Hail', 99: '⛈️ Heavy Thunderstorm'
    };
    
    return weatherCodes[weatherCode] || '🌤️ Unknown';
}

async function renderWeatherCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Getting location...</div>';
    
    if (!navigator.geolocation) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #d93025;">Location not supported</div>';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            
            content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading weather...</div>';
            
            const weatherData = await fetchWeatherData(latitude, longitude);
            
            if (!weatherData) {
                content.innerHTML = '<div style="text-align: center; padding: 20px; color: #d93025;">Failed to load weather</div>';
                return;
            }
            
            const current = weatherData.current_weather;
            const daily = weatherData.daily;
            const weatherDesc = getWeatherDescription(current.weathercode);
            
            content.innerHTML = `
                <div class="weather-container">
                    <div class="weather-main">
                        <div class="weather-icon">${weatherDesc.split(' ')[0]}</div>
                        <div class="weather-temp">${Math.round(current.temperature)}°C</div>
                    </div>
                    <div class="weather-description">${weatherDesc.substring(weatherDesc.indexOf(' ') + 1)}</div>
                    <div class="weather-details">
                        <div class="weather-detail">
                            <div class="weather-detail-label">Wind</div>
                            <div class="weather-detail-value">${Math.round(current.windspeed)} km/h</div>
                        </div>
                        <div class="weather-detail">
                            <div class="weather-detail-label">High/Low</div>
                            <div class="weather-detail-value">${Math.round(daily.temperature_2m_max[0])}° / ${Math.round(daily.temperature_2m_min[0])}°</div>
                        </div>
                    </div>
                </div>
            `;
        },
        (error) => {
            content.innerHTML = '<div style="text-align: center; padding: 20px; color: #d93025;">Location permission denied</div>';
        }
    );
}

// History Card
function createHistoryCard() {
    const card = {
        id: Date.now().toString(),
        type: 'history',
        x: window.innerWidth / 2 - 175,
        y: window.innerHeight / 2 - 150,
        content: ''
    };
    
    State.getCards().push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

function extractRootDomain(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const parts = hostname.split('.');
        
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }
        return hostname;
    } catch (e) {
        return null;
    }
}

async function fetchBrowsingHistory() {
    try {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        const historyItems = await chrome.history.search({
            text: '',
            startTime: sevenDaysAgo,
            maxResults: 10000
        });
        
        const domainCounts = {};
        
        for (const item of historyItems) {
            if (item.url) {
                const domain = extractRootDomain(item.url);
                if (domain && !domain.includes('chrome://') && !domain.includes('chrome-extension://')) {
                    const visits = await chrome.history.getVisits({ url: item.url });
                    
                    const recentVisits = visits.filter(visit => visit.visitTime >= sevenDaysAgo);
                    
                    if (recentVisits.length > 0) {
                        domainCounts[domain] = (domainCounts[domain] || 0) + recentVisits.length;
                    }
                }
            }
        }
        
        const sortedDomains = Object.entries(domainCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([domain, count]) => ({ domain, count }));
        
        return sortedDomains;
    } catch (error) {
        console.error('Error fetching history:', error);
        return [];
    }
}

async function loadStarredSites() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['starredSites'], (result) => {
            resolve(result.starredSites || []);
        });
    });
}

async function saveStarredSites(starredSites) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ starredSites: starredSites }, resolve);
    });
}

async function toggleStarredSite(domain) {
    const starredSites = await loadStarredSites();
    const index = starredSites.indexOf(domain);
    
    if (index > -1) {
        starredSites.splice(index, 1);
    } else {
        starredSites.push(domain);
    }
    
    await saveStarredSites(starredSites);
    return starredSites.includes(domain);
}

async function loadToggledSites() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['toggledSites'], (result) => {
            resolve(result.toggledSites || []);
        });
    });
}

async function saveToggledSites(toggledSites) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ toggledSites: toggledSites }, () => {
            debouncedSync();
            resolve();
        });
    });
}

async function toggleSiteForOpening(domain) {
    const toggledSites = await loadToggledSites();
    const index = toggledSites.indexOf(domain);
    
    if (index > -1) {
        toggledSites.splice(index, 1);
    } else {
        toggledSites.push(domain);
    }
    
    await saveToggledSites(toggledSites);
    return toggledSites.includes(domain);
}

async function renderHistoryCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading history...</div>';
    
    const topSites = await fetchBrowsingHistory();
    
    if (topSites.length === 0) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No history found</div>';
        return;
    }
    
    const starredSites = await loadStarredSites();
    const toggledSites = await loadToggledSites();
    
    const sitesWithRank = topSites.map((site, index) => ({
        ...site,
        originalRank: index + 1
    }));
    
    const starredList = sitesWithRank.filter(site => starredSites.includes(site.domain));
    const unstarredList = sitesWithRank.filter(site => !starredSites.includes(site.domain));
    const sortedSites = [...starredList, ...unstarredList];
    
    content.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'history-header';
    
    const openTabsBtn = document.createElement('button');
    openTabsBtn.className = 'open-tabs-btn';
    openTabsBtn.textContent = `Open Tabs (${toggledSites.length})`;
    openTabsBtn.disabled = toggledSites.length === 0;
    openTabsBtn.addEventListener('click', async () => {
        const sitesToOpen = await loadToggledSites();
        sitesToOpen.forEach(domain => {
            window.open(`https://${domain}`, '_blank');
        });
    });
    
    header.appendChild(openTabsBtn);
    content.appendChild(header);
    
    const list = document.createElement('div');
    list.className = 'history-list';
    list.id = `history-list-${cardId}`;
    
    sortedSites.forEach((site) => {
        const isStarred = starredSites.includes(site.domain);
        const isToggled = toggledSites.includes(site.domain);
        const siteItem = document.createElement('div');
        siteItem.className = 'history-item' + (isStarred ? ' starred' : '');
        
        const toggleCheckbox = document.createElement('input');
        toggleCheckbox.type = 'checkbox';
        toggleCheckbox.className = 'history-toggle';
        toggleCheckbox.checked = isToggled;
        toggleCheckbox.addEventListener('change', async (e) => {
            e.stopPropagation();
            await toggleSiteForOpening(site.domain);
            
            const updatedCard = document.querySelector(`[data-id="${cardId}"]`);
            if (updatedCard) {
                renderHistoryCard(updatedCard, cardId);
            }
        });
        
        const rank = document.createElement('div');
        rank.className = 'history-rank';
        if (isStarred) {
            rank.innerHTML = '📌';
        } else {
            rank.textContent = `#${site.originalRank}`;
        }
        
        const favicon = document.createElement('img');
        favicon.className = 'history-favicon';
        favicon.src = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`;
        favicon.alt = site.domain;
        favicon.onerror = () => {
            favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><circle cx="12" cy="12" r="10"/></svg>';
        };
        
        const siteInfo = document.createElement('div');
        siteInfo.className = 'history-info';
        
        const siteName = document.createElement('div');
        siteName.className = 'history-domain';
        siteName.textContent = site.domain;
        
        const siteCount = document.createElement('div');
        siteCount.className = 'history-count';
        siteCount.textContent = `${site.count} visits`;
        
        siteInfo.appendChild(siteName);
        siteInfo.appendChild(siteCount);
        
        const starBtn = document.createElement('button');
        starBtn.className = 'history-star-btn';
        starBtn.innerHTML = isStarred ? '★' : '☆';
        starBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleStarredSite(site.domain);
            
            const updatedCard = document.querySelector(`[data-id="${cardId}"]`);
            if (updatedCard) {
                renderHistoryCard(updatedCard, cardId);
            }
        });
        
        siteItem.appendChild(toggleCheckbox);
        siteItem.appendChild(rank);
        siteItem.appendChild(favicon);
        siteItem.appendChild(siteInfo);
        siteItem.appendChild(starBtn);
        
        siteItem.addEventListener('click', (e) => {
            if (e.target !== starBtn && e.target !== toggleCheckbox) {
                window.open(`https://${site.domain}`, '_blank');
            }
        });
        
        list.appendChild(siteItem);
    });
    
    content.appendChild(list);
}

// RSS Card
function createRssCard() {
    const card = {
        id: Date.now().toString(),
        type: 'rss',
        x: window.innerWidth / 2 - 225,
        y: window.innerHeight / 2 - 150,
        content: ''
    };
    
    State.getCards().push(card);
    renderCard(card);
    saveCards();
    updateCanvasHeight();
}

async function fetchRssFeed(feedUrl) {
    const CORS_PROXY = 'https://api.cors.lol/?url=';
    
    try {
        const response = await fetch(CORS_PROXY + encodeURIComponent(feedUrl));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        
        const items = xmlDoc.querySelectorAll('item');
        const feedItems = Array.from(items).slice(0, 5).map(item => ({
            title: item.querySelector('title')?.textContent || '',
            link: item.querySelector('link')?.textContent || '',
            pubDate: item.querySelector('pubDate')?.textContent || ''
        }));
        
        return feedItems;
    } catch (error) {
        console.error('RSS fetch error:', error);
        return [];
    }
}

async function loadRssFeeds(cardId) {
    return new Promise((resolve) => {
        chrome.storage.local.get([`rssFeeds_${cardId}`], (result) => {
            resolve(result[`rssFeeds_${cardId}`] || DEFAULT_RSS_FEEDS);
        });
    });
}

async function saveRssFeeds(cardId, feeds) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [`rssFeeds_${cardId}`]: feeds }, () => {
            debouncedSync();
            resolve();
        });
    });
}

async function renderRssCard(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading feeds...</div>';
    
    const feeds = await loadRssFeeds(cardId);
    
    const allArticles = [];
    for (const feed of feeds) {
        const articles = await fetchRssFeed(feed.url);
        articles.forEach(article => {
            allArticles.push({
                ...article,
                source: feed.name
            });
        });
    }
    
    allArticles.sort((a, b) => {
        const dateA = new Date(a.pubDate);
        const dateB = new Date(b.pubDate);
        return dateB - dateA;
    });
    
    const latestArticles = allArticles.slice(0, 5);
    
    content.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'rss-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Latest Tech News';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    
    const manageBtn = document.createElement('button');
    manageBtn.className = 'rss-manage-btn';
    manageBtn.textContent = 'Manage Feeds';
    manageBtn.addEventListener('click', () => showFeedManager(cardEl, cardId));
    
    header.appendChild(title);
    header.appendChild(manageBtn);
    content.appendChild(header);
    
    if (latestArticles.length === 0) {
        const noArticles = document.createElement('div');
        noArticles.style.textAlign = 'center';
        noArticles.style.padding = '20px';
        noArticles.style.color = '#888';
        noArticles.textContent = 'No articles found';
        content.appendChild(noArticles);
        return;
    }
    
    const articleList = document.createElement('div');
    articleList.className = 'rss-article-list';
    
    latestArticles.forEach(article => {
        const articleEl = document.createElement('a');
        articleEl.className = 'rss-article';
        articleEl.href = article.link;
        articleEl.target = '_blank';
        
        const articleTitle = document.createElement('div');
        articleTitle.className = 'rss-article-title';
        articleTitle.textContent = article.title;
        
        const articleMeta = document.createElement('div');
        articleMeta.className = 'rss-article-meta';
        
        const source = document.createElement('span');
        source.textContent = article.source;
        
        const date = document.createElement('span');
        if (article.pubDate) {
            const pubDate = new Date(article.pubDate);
            const now = new Date();
            const diffTime = Math.abs(now - pubDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            
            if (diffDays === 0) {
                if (diffHours === 0) {
                    date.textContent = 'Just now';
                } else if (diffHours === 1) {
                    date.textContent = '1 hour ago';
                } else {
                    date.textContent = `${diffHours} hours ago`;
                }
            } else if (diffDays === 1) {
                date.textContent = 'Yesterday';
            } else if (diffDays < 7) {
                date.textContent = `${diffDays} days ago`;
            } else {
                date.textContent = pubDate.toLocaleDateString();
            }
        }
        
        articleMeta.appendChild(source);
        if (article.pubDate) {
            const separator = document.createElement('span');
            separator.textContent = ' • ';
            articleMeta.appendChild(separator);
            articleMeta.appendChild(date);
        }
        
        articleEl.appendChild(articleTitle);
        articleEl.appendChild(articleMeta);
        articleList.appendChild(articleEl);
    });
    
    content.appendChild(articleList);
}

function showFeedManager(cardEl, cardId) {
    const content = cardEl.querySelector('.card-content');
    
    loadRssFeeds(cardId).then(feeds => {
        content.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'rss-header';
        
        const title = document.createElement('h3');
        title.textContent = 'Manage RSS Feeds';
        title.style.margin = '0 0 10px 0';
        title.style.fontSize = '16px';
        title.style.fontWeight = '600';
        
        const backBtn = document.createElement('button');
        backBtn.className = 'rss-manage-btn';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => renderRssCard(cardEl, cardId));
        
        header.appendChild(title);
        header.appendChild(backBtn);
        content.appendChild(header);
        
        const feedList = document.createElement('div');
        feedList.className = 'rss-feed-list';
        
        feeds.forEach((feed, index) => {
            const feedItem = document.createElement('div');
            feedItem.className = 'rss-feed-item';
            
            const feedInfo = document.createElement('div');
            feedInfo.className = 'rss-feed-info';
            
            const feedName = document.createElement('div');
            feedName.className = 'rss-feed-name';
            feedName.textContent = feed.name;
            
            const feedUrl = document.createElement('div');
            feedUrl.className = 'rss-feed-url';
            feedUrl.textContent = feed.url;
            
            feedInfo.appendChild(feedName);
            feedInfo.appendChild(feedUrl);
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'rss-remove-btn';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', async () => {
                feeds.splice(index, 1);
                await saveRssFeeds(cardId, feeds);
                showFeedManager(cardEl, cardId);
            });
            
            feedItem.appendChild(feedInfo);
            feedItem.appendChild(removeBtn);
            feedList.appendChild(feedItem);
        });
        
        content.appendChild(feedList);
        
        const addSection = document.createElement('div');
        addSection.className = 'rss-add-section';
        
        const addTitle = document.createElement('div');
        addTitle.textContent = 'Add New Feed';
        addTitle.style.fontSize = '14px';
        addTitle.style.fontWeight = '600';
        addTitle.style.marginBottom = '8px';
        
        const nameInput = document.createElement('input');
        nameInput.className = 'rss-input';
        nameInput.placeholder = 'Feed name (e.g., TechCrunch)';
        
        const urlInput = document.createElement('input');
        urlInput.className = 'rss-input';
        urlInput.placeholder = 'RSS feed URL';
        
        const addBtn = document.createElement('button');
        addBtn.className = 'rss-add-btn';
        addBtn.textContent = 'Add Feed';
        addBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const url = urlInput.value.trim();
            
            if (name && url) {
                feeds.push({ name, url });
                await saveRssFeeds(cardId, feeds);
                showFeedManager(cardEl, cardId);
            }
        });
        
        addSection.appendChild(addTitle);
        addSection.appendChild(nameInput);
        addSection.appendChild(urlInput);
        addSection.appendChild(addBtn);
        
        content.appendChild(addSection);
    });
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createSSENSECard,
        fetchSSENSEProducts,
        renderSSENSECard,
        createWeatherCard,
        fetchWeatherData,
        getWeatherDescription,
        renderWeatherCard,
        createHistoryCard,
        extractRootDomain,
        fetchBrowsingHistory,
        loadStarredSites,
        saveStarredSites,
        toggleStarredSite,
        loadToggledSites,
        saveToggledSites,
        toggleSiteForOpening,
        renderHistoryCard,
        createRssCard,
        fetchRssFeed,
        loadRssFeeds,
        saveRssFeeds,
        renderRssCard,
        showFeedManager
    };
}

