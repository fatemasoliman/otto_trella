chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
  });
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in background script:', request);
    if (request.action === 'authenticate') {
      console.log('Starting authentication process');
      authenticate().then(token => {
        console.log('Authentication result:', token ? 'Success' : 'Failure');
        if (token) {
          // Store the token and its expiration time
          const expiresAt = Date.now() + 3600 * 1000; // Token expires in 1 hour
          chrome.storage.local.set({ token: token, expiresAt: expiresAt }, () => {
            console.log('Token stored in local storage');
            sendResponse({ token: token });
          });
        } else {
          console.log('Authentication failed, sending error response');
          sendResponse({ error: 'Authentication failed' });
        }
      });
      return true;  // Will respond asynchronously
    } else if (request.action === 'getToken') {
      chrome.storage.local.get(['token', 'expiresAt'], (result) => {
        if (result.token && result.expiresAt > Date.now()) {
          console.log('Valid token found in storage');
          sendResponse({ token: result.token });
        } else {
          console.log('No valid token found in storage');
          sendResponse({ error: 'No valid token found' });
        }
      });
      return true;  // Will respond asynchronously
    }
  });
  
  function authenticate() {
    console.log('Authenticate function called');
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        console.log('getAuthToken result:', token ? 'Token received' : 'No token');
        if (chrome.runtime.lastError) {
          console.error('getAuthToken error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(token);
        }
      });
    });
  }