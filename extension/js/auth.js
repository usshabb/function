// Authentication and user management module

// Dependencies: config.js, state.js, storage.js, ui-utils.js

// Check if running in Microsoft Edge
function isMicrosoftEdge() {
    return navigator.userAgent.indexOf('Edg') !== -1;
}

async function checkAuthStatus() {
    // Check if we're in Microsoft Edge
    if (isMicrosoftEdge()) {
        // For Edge, check if we have a stored token
        chrome.storage.local.get(['userInfo', 'authToken'], async (result) => {
            if (result.userInfo && result.authToken) {
                // Verify token is still valid
                const userInfo = await getUserInfo(result.authToken);
                if (userInfo) {
                    console.log('✅ Edge: User authenticated, userInfo:', userInfo);
                    showAuthenticatedView(userInfo);
                    updateAuthUI(userInfo);
                    State.setCurrentUserId(userInfo.id);
                    console.log('✅ Edge: currentUserId set to:', State.getCurrentUserId());
                    // IMPORTANT: Create/update user in DB and load state
                    await createOrUpdateUser(userInfo);
                } else {
                    console.error('❌ Edge: Token invalid, removing auth data');
                    chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                        showUnauthenticatedView();
                        State.setCurrentUserId(null);
                    });
                }
            } else {
                console.log('ℹ️ Edge: No stored auth data, showing unauthenticated view');
                showUnauthenticatedView();
                State.setCurrentUserId(null);
            }
        });
        return;
    }
    
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
        if (chrome.runtime.lastError || !token) {
            console.log('ℹ️ Chrome: No auth token, showing unauthenticated view');
            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                showUnauthenticatedView();
                State.setCurrentUserId(null);
            });
            return;
        }
        
        console.log('🔑 Chrome: Got auth token, fetching user info');
        const userInfo = await getUserInfo(token);
        if (userInfo) {
            console.log('✅ Chrome: User authenticated, userInfo:', userInfo);
            chrome.storage.local.set({ userInfo: userInfo, authToken: token }, async () => {
                showAuthenticatedView(userInfo);
                updateAuthUI(userInfo);
                await createOrUpdateUser(userInfo);
            });
        } else {
            // Token might be expired, try to refresh it
            await refreshAuthToken(token);
        }
    });
}

async function signInWithGoogle() {
    // Show spinner immediately
    setSignInButtonLoading(true);
    
    // Check if we're in Microsoft Edge
    if (isMicrosoftEdge()) {
        // Use alternative OAuth flow for Edge
        const clientId = chrome.runtime.getManifest().oauth2.client_id;
        const redirectUri = chrome.identity.getRedirectURL();
        const scopes = chrome.runtime.getManifest().oauth2.scopes.join(' ');
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=token&` +
            `scope=${encodeURIComponent(scopes)}`;
        
        // Launch OAuth flow - modal opens immediately, so hide spinner
        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, async (responseUrl) => {
            // Hide spinner when callback is triggered (modal opened)
            setSignInButtonLoading(false);
            
            if (chrome.runtime.lastError) {
                console.error('Auth error:', chrome.runtime.lastError);
                const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
                alert(`Authentication failed: ${errorMsg}\n\nPlease check:\n1. Your OAuth client ID is correct\n2. The redirect URI (${redirectUri}) is configured in Google Cloud Console\n3. You're using the correct Google account`);
                return;
            }
            
            if (!responseUrl) {
                alert('Authentication failed: No response received. Please try again.');
                return;
            }
            
            // Extract access token from response URL
            const hashPart = responseUrl.split('#')[1];
            if (!hashPart) {
                alert('Authentication failed: Invalid response URL. Please try again.');
                return;
            }
            
            const urlParams = new URLSearchParams(hashPart);
            const token = urlParams.get('access_token');
            const error = urlParams.get('error');
            
            if (error) {
                const errorDescription = urlParams.get('error_description') || error;
                alert(`Authentication failed: ${error}\n\n${errorDescription}\n\nPlease check your OAuth configuration in Google Cloud Console.`);
                return;
            }
            
            if (!token) {
                alert('Authentication failed: No access token received. Please try again.');
                return;
            }
            
            const userInfo = await getUserInfo(token);
            if (userInfo) {
                chrome.storage.local.set({ userInfo: userInfo, authToken: token }, async () => {
                    showAuthenticatedView(userInfo);
                    updateAuthUI(userInfo);
                    await createOrUpdateUser(userInfo);
                });
            } else {
                alert('Authentication failed: Could not retrieve user information. The token may be invalid. Please try again.');
            }
        });
        // Note: Spinner will be hidden in the callback when modal opens
        return;
    }
    
    // Standard Chrome OAuth flow
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        // Hide spinner when callback is triggered (account selector appeared)
        setSignInButtonLoading(false);
        
        if (chrome.runtime.lastError) {
            console.error('Auth error:', chrome.runtime.lastError);
            const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
            alert(`Authentication failed: ${errorMsg}\n\nPlease check:\n1. Your OAuth client ID is correct\n2. The redirect URI is configured in Google Cloud Console\n3. You're using the correct Google account`);
            return;
        }
        
        if (!token) {
            alert('Authentication failed: No token received. Please try again.');
            return;
        }
        
        const userInfo = await getUserInfo(token);
        if (userInfo) {
            chrome.storage.local.set({ userInfo: userInfo, authToken: token }, async () => {
                showAuthenticatedView(userInfo);
                updateAuthUI(userInfo);
                await createOrUpdateUser(userInfo);
            });
        } else {
            alert('Authentication failed: Could not retrieve user information. The token may be invalid or expired. Please try again.');
            // Remove invalid token
            chrome.identity.removeCachedAuthToken({ token: token }, () => {
                console.log('Removed invalid cached token');
            });
        }
    });
    
    // For Chrome, hide spinner after a brief delay to ensure account selector UI appears
    setTimeout(() => {
        const signInBtn = document.getElementById('signInBtn');
        if (signInBtn && signInBtn.disabled) {
            setSignInButtonLoading(false);
        }
    }, 500);
}

async function signOutFromGoogle() {
    chrome.storage.local.get(['authToken'], (result) => {
        if (result.authToken) {
            // Only try to remove cached token if not in Edge
            if (!isMicrosoftEdge()) {
                chrome.identity.removeCachedAuthToken({ token: result.authToken }, () => {
                    chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                        showUnauthenticatedView();
                        State.setCurrentUserId(null);
                    });
                });
            } else {
                // For Edge, just remove from storage
                chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                    showUnauthenticatedView();
                    State.setCurrentUserId(null);
                });
            }
        } else {
            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                showUnauthenticatedView();
                State.setCurrentUserId(null);
            });
        }
    });
}

// Helper function to refresh auth token with better error handling
async function refreshAuthToken(oldToken) {
    return new Promise((resolve) => {
        console.log('🔄 Chrome: Attempting to refresh auth token...');
        
        // Remove old cached token
        chrome.identity.removeCachedAuthToken({ token: oldToken }, () => {
            // Try to get a fresh token (Chrome will auto-refresh if possible)
            chrome.identity.getAuthToken({ interactive: false }, async (newToken) => {
                if (chrome.runtime.lastError || !newToken) {
                    const error = chrome.runtime.lastError?.message || 'Unknown error';
                    console.error('❌ Chrome: Token refresh failed:', error);
                    
                    // Check if we have stored userInfo for graceful degradation
                    chrome.storage.local.get(['userInfo'], (result) => {
                        if (result.userInfo) {
                            const isNetworkError = error.includes('network') || error.includes('timeout') || 
                                                  error.includes('ECONNREFUSED') || !error.includes('invalid');
                            
                            if (isNetworkError) {
                                console.log('⚠️ Chrome: Network issue detected, keeping user logged in with stored info');
                                showAuthenticatedView(result.userInfo);
                                updateAuthUI(result.userInfo);
                                resolve(false);
                            } else {
                                console.error('❌ Chrome: Auth error detected, logging out');
                                chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                                    showUnauthenticatedView();
                                    State.setCurrentUserId(null);
                                });
                                resolve(false);
                            }
                        } else {
                            console.error('❌ Chrome: No stored userInfo, showing unauthenticated view');
                            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                                showUnauthenticatedView();
                                State.setCurrentUserId(null);
                            });
                            resolve(false);
                        }
                    });
                    return;
                }
                
                // Verify the new token works
                console.log('🔄 Chrome: Got refreshed token, verifying...');
                const refreshedUserInfo = await getUserInfo(newToken);
                
                if (refreshedUserInfo) {
                    console.log('✅ Chrome: Token refreshed successfully');
                    chrome.storage.local.set({ userInfo: refreshedUserInfo, authToken: newToken }, async () => {
                        showAuthenticatedView(refreshedUserInfo);
                        updateAuthUI(refreshedUserInfo);
                        await createOrUpdateUser(refreshedUserInfo);
                    });
                    resolve(true);
                } else {
                    chrome.storage.local.get(['userInfo'], (result) => {
                        if (result.userInfo) {
                            console.log('⚠️ Chrome: Token refresh succeeded but verification failed (likely network issue)');
                            showAuthenticatedView(result.userInfo);
                            updateAuthUI(result.userInfo);
                            resolve(false);
                        } else {
                            console.error('❌ Chrome: Refreshed token invalid and no stored userInfo');
                            chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                                showUnauthenticatedView();
                                State.setCurrentUserId(null);
                            });
                            resolve(false);
                        }
                    });
                }
            });
        });
    });
}

async function getUserInfo(token) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            return await response.json();
        }
        
        if (response.status === 401) {
            console.log('⚠️ Token returned 401 - may need refresh');
            return null;
        }
        
        console.warn('⚠️ getUserInfo error:', response.status, response.statusText);
        return null;
    } catch (error) {
        console.error('⚠️ Network error fetching user info (not treating as auth failure):', error);
        return null;
    }
}

function updateAuthUI(userInfo) {
    document.getElementById('signInBtn').style.display = 'none';
    document.getElementById('userProfile').style.display = 'flex';
    document.getElementById('userName').textContent = userInfo.name || userInfo.email;
    
    if (userInfo.picture) {
        document.getElementById('userAvatar').src = userInfo.picture;
    } else {
        document.getElementById('userAvatar').style.display = 'none';
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkAuthStatus,
        signInWithGoogle,
        signOutFromGoogle,
        refreshAuthToken,
        getUserInfo,
        updateAuthUI,
        isMicrosoftEdge
    };
}

