// Background service worker for Brows VPN

console.log('Brows VPN background script loaded');

// Native messaging client
class NativeMessagingClient {
  constructor(hostName = 'com.browsvpn.host') {
    this.hostName = hostName;
    this.port = null;
    this.messageQueue = [];
  }

  connect() {
    if (this.port) {
      return Promise.resolve(this.port);
    }

    return new Promise((resolve, reject) => {
      try {
        this.port = chrome.runtime.connectNative(this.hostName);
        
        this.port.onMessage.addListener((response) => {
          this.handleResponse(response);
        });
        
        this.port.onDisconnect.addListener(() => {
          if (chrome.runtime.lastError) {
            console.error('Native messaging disconnect error:', chrome.runtime.lastError);
          }
          this.port = null;
          this.processQueue();
        });
        
        setTimeout(() => {
          if (this.port && !chrome.runtime.lastError) {
            resolve(this.port);
          } else {
            reject(new Error('Failed to connect to native messaging host'));
          }
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendMessage(message) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.connect();
        
        const enhancedMessage = {
          version: '1.0',
          message_type: message.type || 'command',
          timestamp: new Date().toISOString(),
          message_id: this.generateMessageId(),
          payload: message.payload || {}
        };
        
        this.messageQueue.push({
          message: enhancedMessage,
          resolve,
          reject
        });
        
        this.processQueue();
      } catch (error) {
        reject(error);
      }
    });
  }

  processQueue() {
    if (!this.port || this.messageQueue.length === 0) {
      return;
    }

    const { message, resolve, reject } = this.messageQueue.shift();
    
    try {
      this.port.postMessage(message);
      
      const responseHandler = (response) => {
        if (response.message_id === message.message_id) {
          this.port.onMessage.removeListener(responseHandler);
          if (response.payload && response.payload.status === 'error') {
            reject(new Error(response.payload.error?.message || 'Unknown error'));
          } else {
            resolve(response);
          }
        }
      };
      
      this.port.onMessage.addListener(responseHandler);
      
      setTimeout(() => {
        this.port.onMessage.removeListener(responseHandler);
        reject(new Error('Message timeout'));
      }, 10000);
      
    } catch (error) {
      reject(error);
    }
  }

  handleResponse(response) {
    // Responses are handled in processQueue via message_id matching
  }

  generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async enableVPN(vlessConfig) {
    return this.sendMessage({
      type: 'command',
      payload: {
        command: 'enable_vpn',
        config: {
          vless_url: vlessConfig,
          mode: 'selective',
          socks_port: 1080
        }
      }
    });
  }

  async disableVPN() {
    return this.sendMessage({
      type: 'command',
      payload: {
        command: 'disable_vpn'
      }
    });
  }

  async getStatus() {
    return this.sendMessage({
      type: 'command',
      payload: {
        command: 'get_status'
      }
    });
  }

  disconnect() {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
    this.messageQueue = [];
  }
}

// Create native messaging client
const nativeMessaging = new NativeMessagingClient();

// VPN State
let vpnState = {
  enabled: false,
  mode: 'disabled',
  vlessConfig: null,
  domains: [],
  socksPort: 1080,
  connectionStatus: 'disconnected',
  autoReconnect: true
};

// PAC Script Generator
function generatePACScript(mode, domains, socksPort) {
  const proxyAddress = `SOCKS5 127.0.0.1:${socksPort}`;
  
  if (mode === 'global') {
    return `function FindProxyForURL(url, host) { return "${proxyAddress}"; }`;
  } else if (mode === 'selective' && domains.length > 0) {
    const sortedDomains = [...domains].sort();
    const domainsJSON = JSON.stringify(sortedDomains);
    
    return `
      function FindProxyForURL(url, host) {
        function isHostBlocked(array, target) {
          let left = 0, right = array.length - 1;
          while (left <= right) {
            const mid = left + Math.floor((right - left) / 2);
            if (array[mid] === target) return true;
            if (array[mid] < target) left = mid + 1;
            else right = mid - 1;
          }
          return false;
        }
        if (host.endsWith('.')) host = host.substring(0, host.length - 1);
        let lastDot = host.lastIndexOf('.');
        if (lastDot !== -1) {
          lastDot = host.lastIndexOf('.', lastDot - 1);
          if (lastDot !== -1) host = host.substr(lastDot + 1);
        }
        let domains = ${domainsJSON};
        if (isHostBlocked(domains, host)) return "${proxyAddress}";
        return "DIRECT";
      }
    `;
  }
  
  return `function FindProxyForURL(url, host) { return "DIRECT"; }`;
}

// Proxy Management
async function setProxy(mode, domains = [], socksPort = 1080) {
  try {
    const pacScript = generatePACScript(mode, domains, socksPort);
    
    await chrome.proxy.settings.set({
      scope: 'regular',
      value: {
        mode: 'pac_script',
        pacScript: {
          data: pacScript,
          mandatory: false
        }
      }
    });
    
    console.log('Proxy settings updated');
    return true;
  } catch (error) {
    console.error('Failed to set proxy:', error);
    return false;
  }
}

async function clearProxy() {
  try {
    await chrome.proxy.settings.clear({});
    console.log('Proxy settings cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear proxy:', error);
    return false;
  }
}

// VPN Control Functions
async function enableVPN() {
  try {
    if (!vpnState.vlessConfig) {
      throw new Error('No VLESS configuration');
    }
    
    console.log('Enabling VPN...');
    
    const response = await nativeMessaging.enableVPN(vpnState.vlessConfig);
    
    if (response.payload && response.payload.status === 'success') {
      await setProxy(vpnState.mode, vpnState.domains, vpnState.socksPort);
      
      vpnState.enabled = true;
      vpnState.connectionStatus = 'enabled';
      
      console.log('VPN enabled successfully');
      return true;
    }
  } catch (error) {
    console.error('Failed to enable VPN:', error);
    vpnState.connectionStatus = 'error';
    return false;
  }
}

async function disableVPN() {
  try {
    console.log('Disabling VPN...');
    
    await nativeMessaging.disableVPN();
    await clearProxy();
    
    vpnState.enabled = false;
    vpnState.connectionStatus = 'disabled';
    
    console.log('VPN disabled successfully');
    return true;
  } catch (error) {
    console.error('Failed to disable VPN:', error);
    return false;
  }
}

// Storage Management
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([
      'vlessConfig',
      'operationMode',
      'domainList',
      'socksPort',
      'autoReconnect'
    ]);
    
    if (data.vlessConfig) vpnState.vlessConfig = data.vlessConfig;
    if (data.operationMode) vpnState.mode = data.operationMode;
    if (data.domainList) vpnState.domains = data.domainList;
    if (data.socksPort) vpnState.socksPort = data.socksPort;
    if (data.autoReconnect !== undefined) vpnState.autoReconnect = data.autoReconnect;
    
    console.log('Settings loaded:', vpnState);
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Lifecycle Events
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Brows VPN extension installed');
  await loadSettings();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Brows VPN extension started');
  await loadSettings();
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'getProxyStatus') {
    sendResponse({
      enabled: vpnState.enabled,
      mode: vpnState.mode,
      status: vpnState.connectionStatus
    });
  } else if (request.action === 'enableVPN') {
    enableVPN().then(result => sendResponse({ success: result }));
  } else if (request.action === 'disableVPN') {
    disableVPN().then(result => sendResponse({ success: result }));
  } else if (request.action === 'updateSettings') {
    if (request.vlessConfig) vpnState.vlessConfig = request.vlessConfig;
    if (request.mode) vpnState.mode = request.mode;
    if (request.domains) vpnState.domains = request.domains;
    
    chrome.storage.local.set({
      vlessConfig: vpnState.vlessConfig,
      operationMode: vpnState.mode,
      domainList: vpnState.domains
    }).then(() => sendResponse({ success: true }));
  }
  
  return true;
});

// Auto-reconnect on proxy errors
chrome.proxy.onProxyError.addListener((error) => {
  console.error('Proxy error:', error);
  
  if (vpnState.enabled && vpnState.autoReconnect) {
    console.log('Attempting to reconnect...');
    setTimeout(() => enableVPN(), 5000);
  }
});