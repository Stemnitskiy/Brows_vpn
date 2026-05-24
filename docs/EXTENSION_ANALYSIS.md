# Censor Tracker Extension - Detailed Analysis

> **Справочный документ** (Phase 1). Активный extension — корневой `extension/`, не `src/`.  
> План: [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)

## Project Overview

**Repository**: censortracker/censortracker  
**Version**: 20.0.0  
**Language**: JavaScript (with webpack + React support)  
**Manifest Version**: V3  
**Target Browsers**: Chrome, Firefox

## Technology Stack

### Core Technologies
- **JavaScript** (ES6+) with Babel transpilation
- **React** (implied by presets and structure)
- **Webpack 5** for bundling
- **TypeScript** support (though main code is JS)

### Dependencies
```json
{
  "axios": "^1.7.9",              // HTTP requests
  "codemirror": "^5.65.3",        // Code editor for configs
  "tldts": "^5.7.93",             // Domain parsing
  "validator": "^13.6.0"          // Input validation
}
```

### Build Tools
- **webpack** 5.72.0 with custom config
- **babel** for transpilation
- **web-ext** for Firefox packaging
- **eslint** for code quality
- **stylelint** for CSS quality

## Architecture

### Directory Structure
```
src/
├── chrome/
│   ├── manifest/
│   │   └── chrome.json         # Chrome manifest V3
│   └── pages/
│       └── installed.html      # Installation page
├── firefox/                    # Firefox-specific files
└── shared/                     # Shared code
    ├── css/                    # Stylesheets
    ├── js/
    │   ├── background/         # Background scripts
    │   │   ├── background.js   # Main entry point
    │   │   ├── browser-api.js  # Browser API abstraction
    │   │   ├── constants.js    # Constants
    │   │   ├── handlers.js     # Event handlers
    │   │   ├── ignore.js       # Ignore list management
    │   │   ├── localproxy.js   # Local proxy integration
    │   │   ├── pac.js          # PAC script generation
    │   │   ├── proxy.js        # Proxy management
    │   │   ├── registry.js     # Domain registry
    │   │   ├── server.js       # Server communication
    │   │   ├── settings.js     # Settings management
    │   │   ├── task.js         # Task management
    │   │   └── utilities.js    # Utility functions
    │   └── pages/              # Page scripts
    │       ├── popup.js        # Popup interface
    │       ├── options.js      # Settings page
    │       ├── advanced-options.js
    │       ├── controlled.js
    │       ├── proxy-options.js
    │       ├── registry-options.js
    │       ├── rules-editor.js
    │       └── translator.js
    └── images/                  # Icons and images
```

## Chrome Extension Manifest

### Permissions
```json
{
  "permissions": [
    "alarms",           # For async tasks
    "activeTab",        # Current tab access
    "management",       # Extension management
    "notifications",    # User notifications
    "proxy",            # Proxy settings control
    "storage",          # Local storage
    "unlimitedStorage", # Unlimited storage
    "webNavigation"     # Navigation events
  ],
  "optional_host_permissions": ["http://*/*", "https://*/*"]
}
```

### Key Features
- **Manifest V3** with service worker
- **Proxy API** for PAC script management
- **Storage API** for configuration
- **Web Navigation API** for request interception

## Core Components Analysis

### 1. Background Script (`background.js`)

**Purpose**: Main entry point for extension lifecycle

**Event Listeners**:
```javascript
- browser.alarms.onAlarm           // Async tasks
- browser.runtime.onStartup        // Startup events
- browser.runtime.onInstalled      // Installation/update
- browser.runtime.onUpdateAvailable // Updates
- browser.tabs.onUpdated           // Tab changes
- browser.tabs.onCreated           // New tabs
- browser.storage.onChanged        // Settings changes
- browser.webNavigation.onBeforeNavigate // Navigation (Chrome)
- browser.webRequest.onBeforeRequest // Requests (Firefox)
- browser.proxy.onProxyError       // Proxy errors
```

**Browser-Specific Handling**:
- Chrome uses `webNavigation.onBeforeNavigate`
- Firefox uses `webRequest.onBeforeRequest`
- Separate proxy error handlers

### 2. Proxy Manager (`proxy.js`)

**Purpose**: Chrome Proxy API management

**Key Methods**:

**`getProxyingRules()`** - Determines proxy configuration
```javascript
// Priority order:
1. localProxyURI (Censor Tracker Proxy Server)
2. customProxyProtocol + customProxyServerURI
3. proxyServerURI (default HTTPS)
```

**`setProxy()`** - Applies proxy settings via PAC script
```javascript
- Gets domains from registry
- Generates PAC script
- Sets Chrome proxy settings
- Handles Firefox blob URL differently
```

**`alive()`**, **`ping()`** - Health checks
- Periodic ping to proxy server
- Custom proxy support

**`enableProxy()`**, **`disableProxy()`** - State management
- Updates storage flags
- Controls proxy state

**Extension Management**:
- `controlledByOtherExtensions()` - Detect conflicts
- `takeControl()` - Disable conflicting extensions

### 3. PAC Script Generator (`pac.js`)

**Purpose**: Generate PAC script for domain-based routing

**Function Signature**:
```javascript
getPacScript({ domains, proxyServerURI, proxyServerProtocol })
```

**Algorithm**:
1. Sort domains alphabetically (binary search optimization)
2. Define `isHostBlocked()` with binary search
3. Normalize host (remove trailing dot, extract second-level domain)
4. Special handling for `*.onion` and `*.i2p` domains
5. Return proxy or DIRECT based on domain match

**Performance Optimization**:
- Binary search for domain lookup
- Domain normalization to second-level
- Alphabetically sorted array

### 4. Domain Registry (`registry.js`)

**Purpose**: Manage domain lists for proxying

**Storage Keys**:
```javascript
{
  domains: [],              // Main registry
  customProxiedDomains: [], // User-added domains
  ignoredHosts: [],         // Excluded hosts
  useRegistry: true,        // Registry enable flag
  disseminators: []         // Special data for Russia
}
```

**Key Methods**:

**`getDomains()`** - Get effective domain list
```javascript
// Logic:
1. If useRegistry = false: return customProxiedDomains only
2. Merge domains + customProxiedDomains
3. Filter out ignoredHosts
4. Return empty array if no domains
```

**`add(url)`, **`remove(url)`** - Domain CRUD operations
- Extract domain from URL
- Update customProxiedDomains array
- Log operations

**`contains(url)`** - Check if URL should be proxied
- Extract domain
- Check against both domains and customProxiedDomains
- Respect ignoredHosts

**`enableRegistry()`**, **`disableRegistry()`** - Registry control
**`clearRegistry()`** - Reset main registry

### 5. Popup Interface (`popup.js`)

**Purpose**: Quick access interface for users

**UI Elements**:
- Status indicator (image)
- Enable/Disable extension button
- Current domain display
- Site actions (add/remove from proxy list)
- Proxy connection status
- Options page button
- Network indicators (Tor, I2P)

**Key Interactions**:
- Quick enable/disable
- Add current site to proxy list
- View connection status
- Access settings

### 6. Browser API Abstraction (`browser-api.js`)

**Purpose**: Cross-browser compatibility layer

**Features**:
- Abstract Chrome vs Firefox API differences
- Provide unified interface
- Handle browser-specific behaviors

## Storage Schema

### Main Storage Keys
```javascript
{
  // Extension State
  useProxy: boolean,                    // Main enable/disable flag
  proxyIsAlive: boolean,                // Connection health
  
  // Proxy Configuration
  proxyServerURI: string,              // Default proxy server
  proxyPingURI: string,                // Health check endpoint
  customProxyProtocol: string,         // Custom proxy protocol
  customProxyServerURI: string,        // Custom proxy URI
  localProxyURI: string,               // Local proxy server
  useOwnProxy: boolean,                // Use custom proxy flag
  useLocalProxy: boolean,              // Use local proxy flag
  
  // Domain Management
  domains: string[],                    // Main domain registry
  customProxiedDomains: string[],       // User domains
  ignoredHosts: string[],              // Excluded hosts
  useRegistry: boolean,                 // Registry enable flag
  
  // Special Features
  disseminators: object[],              // Russia-specific data
  privateBrowsingPermissionsRequired: boolean, // Firefox
  
  // Bad Proxy Management
  badProxies: string[]                  // Failed proxies
}
```

## Integration Points for Brows VPN

### 1. What We'll Keep

**Core Architecture**:
- Background script with event listeners
- ProxyManager with Chrome Proxy API
- PAC script generation (enhanced for VLESS)
- Domain registry system
- Storage schema (extended)
- Browser API abstraction

**UI Components**:
- Popup structure (redesigned)
- Settings page foundation
- Domain management UI (enhanced)

### 2. What We'll Modify

**PAC Script Generator**:
- Add VLESS-specific optimizations
- Support global mode (all traffic through proxy)
- Enhanced domain matching with wildcards
- Add bypass list support

**Proxy Manager**:
- Remove Censor Tracker server dependencies
- Add VLESS configuration support
- Enhanced error handling for VLESS
- Add mode switching (selective/global/disabled)

**Domain Registry**:
- Enhanced wildcard support
- Domain categories/groups
- Import/export functionality
- Bulk operations

**Storage Schema**:
```javascript
// Additions for Brows VPN
{
  vlessConfig: string,                 // VLESS configuration URL
  operationMode: 'selective' | 'global' | 'disabled',
  autoReconnect: boolean,              // Auto-reconnect flag
  logLevel: 'debug' | 'info' | 'warning' | 'error',
  domainCategories: object[],         // Domain groups
  proxyPort: number,                   // SOCKS5 port (default 10808)
  connectionStatistics: object         // Usage statistics
}
```

### 3. What We'll Remove

**Censor Tracker Specific**:
- Server communication logic
- Registry updates from remote
- Russia-specific disseminator logic
- Tor/I2P special handling
- Censor Tracker server dependencies

**Multi-protocol Support**:
- Keep only VLESS-focused logic
- Simplify configuration to VLESS only

## Key Insights for Implementation

### 1. Modular Architecture
- Clean separation between background, pages, and shared code
- Event-driven architecture
- Cross-browser compatibility layer

### 2. Storage-Heavy Design
- Heavy reliance on chrome.storage.local
- No sensitive data in code
- Configuration persistence

### 3. PAC Script Approach
- Efficient binary search for domain lookup
- Domain normalization for second-level matching
- Good performance for large domain lists

### 4. Proxy Management
- Chrome Proxy API integration
- Health check mechanism
- Conflict detection with other extensions

### 5. Error Handling
- Graceful degradation
- Fallback mechanisms
- User notifications

## Development Recommendations

### 1. Extension Development
- Keep the modular architecture
- Use existing PAC script generation as base
- Enhance domain management with better UI
- Simplify by removing Censor Tracker-specific features

### 2. Storage Strategy
- Extend existing storage schema
- Add migration path for future changes
- Use encryption for sensitive VLESS configs

### 3. Testing Approach
- Test PAC script logic thoroughly
- Test domain matching edge cases
- Test proxy API interactions
- Test storage persistence

### 4. Performance Considerations
- Keep binary search optimization
- Minimize storage operations
- Efficient event handling
- Lazy loading of UI components

## Conclusion

Censor Tracker extension provides an excellent foundation with:
- Clean modular architecture
- Efficient PAC script generation
- Robust domain management
- Good Chrome Proxy API integration
- Cross-browser compatibility

For Brows VPN, we can:
- Remove Censor Tracker-specific features
- Enhance for VLESS Reality support
- Add global VPN mode
- Improve domain management UI
- Add better error handling and logging
- Implement auto-reconnect logic

This approach balances development speed with customization needs.
