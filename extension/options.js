// Options page script for Brows VPN

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  loadSettings();
  
  // Save VLESS configuration
  document.getElementById('saveConfig').addEventListener('click', () => {
    const vlessConfig = document.getElementById('vlessConfig').value;
    
    if (vlessConfig) {
      chrome.storage.local.set({ vlessConfig }, () => {
        showStatus('configStatus', 'Configuration saved successfully!', 'success');
      });
    } else {
      showStatus('configStatus', 'Please enter a VLESS configuration', 'error');
    }
  });
  
  // Validate VLESS configuration
  document.getElementById('validateConfig').addEventListener('click', () => {
    const vlessConfig = document.getElementById('vlessConfig').value;
    
    if (vlessConfig.startsWith('vless://')) {
      showStatus('configStatus', 'Configuration format looks valid!', 'success');
    } else {
      showStatus('configStatus', 'Invalid VLESS configuration format', 'error');
    }
  });
  
  // Save operation mode
  document.getElementById('saveMode').addEventListener('click', () => {
    const operationMode = document.getElementById('operationMode').value;
    
    chrome.storage.local.set({ operationMode }, () => {
      showStatus('configStatus', 'Operation mode saved successfully!', 'success');
    });
  });
  
  // Save domain list
  document.getElementById('saveDomains').addEventListener('click', () => {
    const domainListText = document.getElementById('domainList').value;
    const domainList = domainListText.split('\n').filter(domain => domain.trim());
    
    chrome.storage.local.set({ domainList }, () => {
      showStatus('configStatus', `Saved ${domainList.length} domains`, 'success');
    });
  });
  
  // Clear domain list
  document.getElementById('clearDomains').addEventListener('click', () => {
    document.getElementById('domainList').value = '';
    chrome.storage.local.set({ domainList: [] }, () => {
      showStatus('configStatus', 'Domain list cleared', 'success');
    });
  });
  
  // Save connection settings
  document.getElementById('saveSettings').addEventListener('click', () => {
    const socksPort = parseInt(document.getElementById('socksPort').value);
    const logLevel = document.getElementById('logLevel').value;
    const autoReconnect = document.getElementById('autoReconnect').checked;
    
    chrome.storage.local.set({
      socksPort,
      logLevel,
      autoReconnect
    }, () => {
      showStatus('configStatus', 'Connection settings saved successfully!', 'success');
    });
  });
  
  function loadSettings() {
    chrome.storage.local.get([
      'vlessConfig',
      'operationMode',
      'domainList',
      'socksPort',
      'logLevel',
      'autoReconnect'
    ], (result) => {
      if (result.vlessConfig) {
        document.getElementById('vlessConfig').value = result.vlessConfig;
      }
      
      if (result.operationMode) {
        document.getElementById('operationMode').value = result.operationMode;
      }
      
      if (result.domainList && Array.isArray(result.domainList)) {
        document.getElementById('domainList').value = result.domainList.join('\n');
      }
      
      if (result.socksPort) {
        document.getElementById('socksPort').value = result.socksPort;
      }
      
      if (result.logLevel) {
        document.getElementById('logLevel').value = result.logLevel;
      }
      
      if (result.autoReconnect !== undefined) {
        document.getElementById('autoReconnect').checked = result.autoReconnect;
      }
    });
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