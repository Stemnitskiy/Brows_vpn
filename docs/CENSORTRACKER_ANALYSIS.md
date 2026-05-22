# Censor Tracker - Analysis and Modification Strategy

## Overview

Этот документ анализирует open-source проект Censor Tracker как основу для Brows VPN проекта.

## Censor Tracker Architecture

### Project Components

#### 1. censortracker/censortracker (Browser Extension)

**Purpose**: Browser extension for proxy management with site selection

**Key Features:**
- Site-based proxy routing
- Support for multiple proxy protocols
- Domain whitelist/blacklist management
- PAC script generation
- User-friendly UI

**Technology Stack:**
- HTML/CSS/JavaScript
- Chrome Extension APIs (Manifest V2/V3)
- React (likely for UI components)
- Chrome Storage API
- Chrome Proxy API

#### 2. censortracker/proxy (Local Proxy Service)

**Purpose**: Lightweight proxy client that integrates with the extension

**Key Features:**
- Xray-core integration
- Support for VLESS, VMess, Shadowsocks, Trojan
- Local SOCKS5 proxy server
- Native messaging with extension
- Windows support

**Technology Stack:**
- C++ (based on repository language tag)
- Xray-core integration
- Windows-specific components
- Native messaging host

## Integration Points

### Extension-Proxy Communication

**Protocol**: Chrome Native Messaging Protocol

**Communication Flow:**
```
Extension → Native Messaging → Proxy Service → Xray-core → VPN Server
```

**Message Types (expected):**
- Configuration updates
- Connection status
- Domain list updates
- Error notifications
- Statistics

### Proxy Configuration Support

**Supported Protocols:**
- **VLESS**: Light-weight protocol, requires reliable channel (TLS)
- **VMess**: Dynamic protocol with time-based authentication
- **Shadowsocks**: AEAD ciphers, lightweight
- **Trojan**: TLS-based protocol

**Transport Methods:**
- TCP
- WebSocket
- HTTP/2
- gRPC
- mKCP

## Modification Strategy for Brows VPN

### 1. Extension Modifications

#### Required Changes:

**Manifest Updates:**
- Update to Manifest V3 (if currently V2)
- Add `nativeMessaging` permission
- Update extension name and description
- Add host permissions for native messaging

**UI Redesign:**
- Simplified popup for quick enable/disable
- Enhanced settings page with:
  - VLESS configuration input
  - Mode selection (Selective/Global)
  - Enhanced domain management
  - Import/Export functionality
  - Logging interface

**Functionality Additions:**
- VLESS Reality support
- Enhanced PAC script generation for selective mode
- Global mode implementation
- Auto-reconnect status display
- Enhanced error handling
- Configuration backup/restore

**Code Changes:**
```javascript
// VLESS Configuration Parser
class VLESSConfigParser {
  parseURL(url) {
    // Parse vless:// format
    // Extract Reality parameters
    // Validate configuration
  }
}

// Enhanced PAC Script Generator
class PACGenerator {
  generateSelectiveMode(domains) {
    // Generate script for selective routing
    // Include Reality-optimized routing
  }
  
  generateGlobalMode() {
    // Simple global routing script
  }
}

// Enhanced Native Messaging
class NativeMessagingClient {
  sendVLESSConfig(config) {
    // Send VLESS configuration
    // Handle Reality parameters
  }
  
  requestStatusUpdate() {
    // Request connection status
    // Get statistics
  }
}
```

#### Features to Keep:
- Domain management system (with enhancements)
- PAC script generation foundation
- Chrome Proxy API integration
- Storage management
- Basic UI structure

#### Features to Remove/Replace:
- Multi-protocol support (focus on VLESS only)
- Old protocol parsers (keep only VLESS)
- Complex subscription management (simplify for personal use)
- Cloud features (not needed for personal use)

### 2. Proxy Service Modifications

#### Required Changes:

**VLESS Reality Support:**
- Full Reality security implementation
- gRPC transport support
- TLS fingerprinting (chrome, firefox, etc.)
- Short ID support
- SPI X parameter support

**Enhanced Features:**
- Auto-reconnect logic
- Enhanced logging system
- System tray integration (Windows-specific)
- Configuration hot-reload
- Statistics collection

**Code Structure Changes:**
```go
// Enhanced VLESS Client
type VLESSRealityClient struct {
    config     *VLESSConfig
    xrayCore  *XrayCoreInstance
    monitor    *ConnectionMonitor
    reconnect  *AutoReconnect
}

// Reality Configuration
type RealityConfig struct {
    PublicKey string
    ShortID    string
    SNI        string
    Fingerprint string
    SPIX       string
}

// Enhanced SOCKS5 Server
type SOCKS5Server struct {
    listener   net.Listener
    logger     *EnhancedLogger
    statistics *StatisticsCollector
}

// System Tray Integration (Windows)
type SystemTray struct {
    icon       *systray.Icon
    menu       *systray.Menu
    notifier   *NotificationManager
}

// Enhanced Native Messaging Host
type NativeMessagingHost struct {
    protocol   *MessageProtocol
    dispatcher *CommandDispatcher
    events     *EventBroadcaster
}
```

#### Features to Keep:
- Xray-core integration
- SOCKS5 proxy server
- Native messaging host
- Basic configuration management
- Platform-specific optimizations

#### Features to Add:
- Windows system tray
- Auto-reconnect with exponential backoff
- Enhanced logging with rotation
- Log viewer API
- Configuration encryption
- Hot-reload capability
- Statistics collection

## Implementation Strategy

### Phase 1: Analysis and Forking

1. **Clone and Analyze**
   ```bash
   git clone https://github.com/censortracker/censortracker.git extension/base
   git clone https://github.com/censortracker/proxy.git proxy-service/base
   ```

2. **Document Current Architecture**
   - Extension components and structure
   - Proxy service architecture
   - Communication protocol
   - Configuration format
   - Dependencies and build process

3. **Identify Modification Points**
   - Configuration parsing (add VLESS Reality)
   - UI components (redesign for requirements)
   - Communication protocol (enhance for new features)
   - Logging system (enhance functionality)

### Phase 2: Extension Development

1. **Setup Development Environment**
   - Node.js and npm/yarn
   - TypeScript configuration
   - React setup (if using)
   - Chrome Extension loading

2. **Incremental Modifications**
   - Update manifest.json
   - Modify popup UI
   - Enhance settings page
   - Implement VLESS parser
   - Update PAC script generator
   - Enhance native messaging client

3. **Testing After Each Change**
   - Load unpacked extension
   - Test UI components
   - Test configuration parsing
   - Test proxy settings

### Phase 3: Proxy Service Development

1. **Setup Development Environment**
   - Go installation
   - Xray-core integration
   - Windows SDK for system tray
   - Build configuration

2. **Incremental Modifications**
   - Implement VLESS Reality support
   - Enhance SOCKS5 server
   - Add system tray
   - Implement auto-reconnect
   - Enhance logging system
   - Update native messaging host

3. **Testing After Each Change**
   - Build proxy service
   - Test VLESS connection
   - Test SOCKS5 functionality
   - Test system tray
   - Test auto-reconnect

### Phase 4: Integration

1. **Native Messaging Setup**
   - Configure native messaging host
   - Register with Chrome/Edge
   - Test communication

2. **End-to-End Testing**
   - Enable VPN from extension
   - Test domain routing
   - Test mode switching
   - Test auto-reconnect
   - Test error handling

3. **Performance Optimization**
   - Profile extension performance
   - Profile service performance
   - Optimize memory usage
   - Optimize connection handling

## Key Differences from Original Censor Tracker

### Feature Comparison

| Feature | Censor Tracker | Brows VPN |
|---------|---------------|-----------|
| **Protocol Support** | VLESS, VMess, Shadowsocks, Trojan | VLESS (Reality) only |
| **Security** | TLS, Reality | Reality enhanced |
| **Transport** | TCP, WS, HTTP/2, gRPC, mKCP | gRPC (primary) |
| **Platform Focus** | Cross-platform | Windows 11 focused |
| **System Tray** | Basic/None | Enhanced Windows tray |
| **Auto-reconnect** | Basic | Enhanced with backoff |
| **Logging** | Basic | Enhanced with rotation |
| **Domain Management** | Basic | Enhanced with categories |
| **Import/Export** | Basic | Enhanced functionality |
| **Global Mode** | Maybe | Full implementation |
| **UI Focus** | Multi-protocol | VLESS-optimized |

### Architectural Differences

**Simplification:**
- Remove multi-protocol complexity
- Focus on VLESS Reality optimization
- Simplify configuration management
- Remove cloud/sync features

**Enhancement:**
- Enhanced Windows integration
- Better system tray functionality
- Improved logging and monitoring
- Better error handling and recovery
- Enhanced UI for personal use

## Risk Analysis

### Dependency Risks

**Censor Tracker Maintenance:**
- Risk: Original project may not be actively maintained
- Mitigation: Fork and maintain custom version
- Plan: Regular updates from upstream if beneficial

**Xray-core Updates:**
- Risk: Xray-core may have breaking changes
- Mitigation: Pin to specific version initially
- Plan: Test thoroughly before updating

**Chrome API Changes:**
- Risk: Chrome Extension APIs may change
- Mitigation: Follow Chrome release notes
- Plan: Quick adaptation to changes

### Integration Risks

**Native Messaging:**
- Risk: Protocol incompatibilities
- Mitigation: Comprehensive testing of message formats
- Plan: Version the protocol for backward compatibility

**Configuration Compatibility:**
- Risk: VLESS format changes
- Mitigation: Flexible parser with validation
- Plan: Support multiple format versions

## Benefits of Using Censor Tracker as Base

### Proven Architecture
- Working extension-service communication
- Tested Xray-core integration
- Proven proxy routing logic
- Established patterns for domain management

### Time Savings
- Don't reinvent native messaging
- Reuse PAC script generation patterns
- Leverage existing Chrome API integration
- Build on tested Xray-core wrapper

### Learning Curve
- Understand working example
- Identify proven patterns
- Learn from existing issues/PRs
- Community knowledge base

### Customization Points
- Clear separation of concerns
- Modular architecture
- Well-defined interfaces
- Extensible design

## Next Steps

1. **Immediate Actions:**
   - Clone both repositories
   - Analyze code structure
   - Document current functionality
   - Identify specific modification points

2. **Short-term Planning:**
   - Create fork strategy
   - Plan incremental modifications
   - Set up development environment
   - Create testing framework

3. **Long-term Maintenance:**
   - Monitor upstream changes
   - Evaluate useful updates
   - Maintain custom enhancements
   - Document custom modifications

## Conclusion

Censor Tracker provides an excellent foundation for Brows VPN project with:
- Proven architecture for extension-proxy communication
- Working Xray-core integration
- Established patterns for domain management
- Solid base for customization

The strategy will be to:
1. Fork and understand the existing codebase
2. Make targeted modifications for VLESS Reality support
3. Enhance Windows-specific features (system tray)
4. Simplify for personal use (remove multi-protocol complexity)
5. Add personal project requirements (enhanced logging, import/export)

This approach balances:
- **Speed**: Leverage existing working code
- **Customization**: Build exactly what's needed
- **Maintainability**: Understand and control the codebase
- **Reliability**: Build on proven patterns