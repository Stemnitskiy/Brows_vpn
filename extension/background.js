// Background service worker for Brows VPN

console.log('Brows VPN background script loaded');

// Basic proxy management
chrome.runtime.onInstalled.addListener(() => {
  console.log('Brows VPN extension installed');
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Brows VPN extension started');
});

// Simple proxy control (placeholder for future implementation)
async function setProxy(mode) {
  console.log('Setting proxy mode:', mode);
  
  if (mode === 'direct') {
    await chrome.proxy.settings.clear({});
  } else if (mode === 'pac_script') {
    // PAC script will be implemented later
    console.log('PAC script mode to be implemented');
  }
}

// Message handling for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'getProxyStatus') {
    sendResponse({ status: 'disabled' });
  } else if (request.action === 'setProxyMode') {
    setProxy(request.mode);
    sendResponse({ success: true });
  }
  
  return true; // For async response
});