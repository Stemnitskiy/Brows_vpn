// Popup script for Brows VPN

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const enableBtn = document.getElementById('enableBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  
  // Load initial status
  await loadProxyStatus();
  
  // Enable/Disable button
  enableBtn.addEventListener('click', async () => {
    const currentStatus = statusDiv.classList.contains('enabled');
    
    if (currentStatus) {
      // Disable VPN
      const result = await chrome.runtime.sendMessage({ action: 'disableVPN' });
      if (result.success) {
        updateStatus(false);
      }
    } else {
      // Enable VPN
      const result = await chrome.runtime.sendMessage({ action: 'enableVPN' });
      if (result.success) {
        updateStatus(true);
      }
    }
  });
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'options.html' });
  });
  
  async function loadProxyStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProxyStatus' });
      if (response) {
        updateStatus(response.enabled);
      }
    } catch (error) {
      console.error('Failed to get proxy status:', error);
      updateStatus(false);
    }
  }
  
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