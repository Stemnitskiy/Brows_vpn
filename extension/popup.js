// Popup script for Brows VPN

document.addEventListener('DOMContentLoaded', () => {
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const enableBtn = document.getElementById('enableBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  
  // Check current proxy status
  chrome.runtime.sendMessage({ action: 'getProxyStatus' }, (response) => {
    if (response && response.status === 'enabled') {
      updateStatus(true);
    } else {
      updateStatus(false);
    }
  });
  
  // Enable/Disable button
  enableBtn.addEventListener('click', () => {
    const isEnabled = statusDiv.classList.contains('enabled');
    
    if (isEnabled) {
      // Disable VPN
      chrome.runtime.sendMessage({ action: 'setProxyMode', mode: 'direct' }, (response) => {
        if (response && response.success) {
          updateStatus(false);
        }
      });
    } else {
      // Enable VPN (will be implemented with VLESS integration)
      chrome.runtime.sendMessage({ action: 'setProxyMode', mode: 'pac_script' }, (response) => {
        if (response && response.success) {
          updateStatus(true);
        }
      });
    }
  });
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'options.html' });
  });
  
  function updateStatus(enabled) {
    if (enabled) {
      statusDiv.classList.remove('disabled');
      statusDiv.classList.add('enabled');
      statusText.textContent = 'VPN Enabled';
      enableBtn.textContent = 'Disable VPN';
    } else {
      statusDiv.classList.remove('enabled');
      statusDiv.classList.add('disabled');
      statusText.textContent = 'VPN Disabled';
      enableBtn.textContent = 'Enable VPN';
    }
  }
});