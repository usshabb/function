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
                    // Token expired, but keep user logged in with stored info
                    // Try to refresh token in background (non-blocking)
                    console.log('⚠️ Edge: Token expired, keeping user logged in with stored info');
                    showAuthenticatedView(result.userInfo);
                    updateAuthUI(result.userInfo);
                    State.setCurrentUserId(result.userInfo.id);
                    // Try to refresh token silently in background
                    refreshAuthTokenForEdge(result.authToken).catch(err => {
                        console.log('⚠️ Edge: Background token refresh failed, user remains logged in');
                    });
                }
            } else if (result.userInfo) {
                // We have userInfo but no token - keep logged in
                console.log('⚠️ Edge: No token but have userInfo, keeping user logged in');
                showAuthenticatedView(result.userInfo);
                updateAuthUI(result.userInfo);
                State.setCurrentUserId(result.userInfo.id);
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
            // Check if we have stored userInfo - if so, keep user logged in
            chrome.storage.local.get(['userInfo'], (result) => {
                if (result.userInfo) {
                    console.log('⚠️ Chrome: No fresh token but have stored userInfo, keeping user logged in');
                    showAuthenticatedView(result.userInfo);
                    updateAuthUI(result.userInfo);
                    State.setCurrentUserId(result.userInfo.id);
                    // Try to refresh token in background (non-blocking)
                    chrome.storage.local.get(['authToken'], (tokenResult) => {
                        if (tokenResult.authToken) {
                            refreshAuthToken(tokenResult.authToken).catch(err => {
                                console.log('⚠️ Chrome: Background token refresh failed, user remains logged in');
                            });
                        }
                    });
                } else {
                    console.log('ℹ️ Chrome: No auth token and no stored userInfo, showing unauthenticated view');
                    chrome.storage.local.remove(['userInfo', 'authToken'], () => {
                        showUnauthenticatedView();
                        State.setCurrentUserId(null);
                    });
                }
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
            // But first check if we have stored userInfo to keep user logged in
            chrome.storage.local.get(['userInfo'], async (result) => {
                if (result.userInfo) {
                    console.log('⚠️ Chrome: Token expired but have stored userInfo, keeping user logged in');
                    showAuthenticatedView(result.userInfo);
                    updateAuthUI(result.userInfo);
                    State.setCurrentUserId(result.userInfo.id);
                }
                // Try to refresh token in background
                await refreshAuthToken(token);
            });
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
                    console.log('⚠️ Chrome: Token refresh failed (non-interactive):', error);
                    
                    // Don't log out - just keep user logged in with stored info
                    // The token will be refreshed when user tries to use a feature that needs it
                    chrome.storage.local.get(['userInfo'], (result) => {
                        if (result.userInfo) {
                            console.log('⚠️ Chrome: Keeping user logged in with stored info, token will refresh when needed');
                            // Don't update UI here - it should already be showing authenticated view
                            resolve(false);
                        } else {
                            // Only log out if we truly have no user info
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
                    // Token refresh succeeded but verification failed - likely network issue
                    chrome.storage.local.get(['userInfo'], (result) => {
                        if (result.userInfo) {
                            console.log('⚠️ Chrome: Token refresh succeeded but verification failed (likely network issue)');
                            // Update token in storage even if verification failed
                            chrome.storage.local.set({ authToken: newToken }, () => {
                                // Keep showing existing userInfo
                            });
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

// Helper function for Edge to refresh token (uses same approach as Chrome)
async function refreshAuthTokenForEdge(oldToken) {
    // For Edge, we need to use launchWebAuthFlow to refresh
    // But since we're keeping user logged in, we'll just return
    // The token will be refreshed when user explicitly signs in again or uses a feature
    console.log('⚠️ Edge: Token refresh requires user interaction, will refresh when needed');
    return Promise.resolve(false);
}

// Helper function to get a fresh token, with interactive refresh if needed
// Use this when a feature needs authentication
async function getFreshAuthToken(interactive = false) {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: interactive }, async (token) => {
            if (chrome.runtime.lastError || !token) {
                // If non-interactive failed and we're allowed to be interactive, try again
                if (!interactive) {
                    console.log('⚠️ Non-interactive token fetch failed, trying interactive...');
                    return getFreshAuthToken(true).then(resolve).catch(() => resolve(null));
                }
                console.error('❌ Failed to get auth token:', chrome.runtime.lastError?.message);
                resolve(null);
                return;
            }
            
            // Verify token works
            const userInfo = await getUserInfo(token);
            if (userInfo) {
                // Update stored token
                chrome.storage.local.set({ userInfo: userInfo, authToken: token }, () => {
                    resolve(token);
                });
            } else {
                // Token doesn't work, try to refresh
                if (!interactive) {
                    console.log('⚠️ Token invalid, trying interactive refresh...');
                    return getFreshAuthToken(true).then(resolve).catch(() => resolve(null));
                }
                resolve(null);
            }
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
        refreshAuthTokenForEdge,
        getFreshAuthToken,
        getUserInfo,
        updateAuthUI,
        isMicrosoftEdge
    };
}

