// Options page script for Brows VPN

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  loadSettings();
  
  // Save VLESS configuration
  document.getElementById('saveConfig').addEventListener('click', async () => {
    const vlessConfig = document.getElementById('vlessConfig').value;
    
    if (vlessConfig) {
      try {
        // Validate VLESS format
        if (!vlessConfig.startsWith('vless://')) {
          throw new Error('Invalid VLESS URL format');
        }
        
        // Save to storage and update background
        await chrome.storage.local.set({ vlessConfig });
        await chrome.runtime.sendMessage({
          action: 'updateSettings',
          vlessConfig: vlessConfig
        });
        
        showStatus('configStatus', 'Configuration saved successfully!', 'success');
      } catch (error) {
        showStatus('configStatus', error.message, 'error');
      }
    } else {
      showStatus('configStatus', 'Please enter a VLESS configuration', 'error');
    }
  });
  
  // Validate VLESS configuration
  document.getElementById('validateConfig').addEventListener('click', () => {
    const vlessConfig = document.getElementById('vlessConfig').value;
    
    if (vlessConfig) {
      try {
        // Basic validation
        if (!vlessConfig.startsWith('vless://')) {
          throw new Error('Must start with vless://');
        }
        
        // Check for required parameters
        const url = new URL(vlessConfig);
        const requiredParams = ['type', 'security'];
        const missingParams = requiredParams.filter(param => 
          !url.searchParams.has(param)
        );
        
        if (missingParams.length > 0) {
          throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
        }
        
        showStatus('configStatus', 'Configuration format looks valid!', 'success');
      } catch (error) {
        showStatus('configStatus', error.message, 'error');
      }
    } else {
      showStatus('configStatus', 'Please enter a VLESS configuration', 'error');
    }
  });
  
  // Save operation mode
  document.getElementById('saveMode').addEventListener('click', async () => {
    const operationMode = document.getElementById('operationMode').value;
    
    await chrome.storage.local.set({ operationMode });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      mode: operationMode
    });
    
    showStatus('configStatus', 'Operation mode saved successfully!', 'success');
  });
  
  // Save domain list
  document.getElementById('saveDomains').addEventListener('click', async () => {
    const domainListText = document.getElementById('domainList').value;
    const domainList = domainListText.split('\n')
      .map(domain => domain.trim())
      .filter(domain => domain.length > 0);
    
    await chrome.storage.local.set({ domainList });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      domains: domainList
    });
    
    showStatus('configStatus', `Saved ${domainList.length} domains`, 'success');
  });
  
  // Clear domain list
  document.getElementById('clearDomains').addEventListener('click', async () => {
    document.getElementById('domainList').value = '';
    await chrome.storage.local.set({ domainList: [] });
    await chrome.runtime.sendMessage({
      action: 'updateSettings',
      domains: []
    });
    
    showStatus('configStatus', 'Domain list cleared', 'success');
  });
  
  // Save connection settings
  document.getElementById('saveSettings').addEventListener('click', async () => {
    const socksPort = parseInt(document.getElementById('socksPort').value);
    const logLevel = document.getElementById('logLevel').value;
    const autoReconnect = document.getElementById('autoReconnect').checked;
    
    await chrome.storage.local.set({
      socksPort,
      logLevel,
      autoReconnect
    });
    
    showStatus('configStatus', 'Connection settings saved successfully!', 'success');
  });
  
  async function loadSettings() {
    const data = await chrome.storage.local.get([
      'vlessConfig',
      'operationMode',
      'domainList',
      'socksPort',
      'logLevel',
      'autoReconnect'
    ]);
    
    if (data.vlessConfig) {
      document.getElementById('vlessConfig').value = data.vlessConfig;
    }
    
    if (data.operationMode) {
      document.getElementById('operationMode').value = data.operationMode;
    }
    
    if (data.domainList && Array.isArray(data.domainList)) {
      document.getElementById('domainList').value = data.domainList.join('\n');
    }
    
    if (data.socksPort) {
      document.getElementById('socksPort').value = data.socksPort;
    }
    
    if (data.logLevel) {
      document.getElementById('logLevel').value = data.logLevel;
    }
    
    if (data.autoReconnect !== undefined) {
      document.getElementById('autoReconnect').checked = data.autoReconnect;
    }
  }
  
  function showStatus(elementId, message, type) {
    const statusElement = document.getElementById(elementId);
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
    
    setTimeout(() => {
      statusElement.className = 'status';
      statusElement.textContent = '';
    }, 3000);
  }
});