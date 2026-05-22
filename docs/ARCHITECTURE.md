# Brows VPN - Technical Architecture

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
├───────────────────────────┬─────────────────────────────────────┤
│   Browser Extension       │    System Tray Application         │
│   (Chrome/Edge/Brave)     │    (Windows Service)               │
│                           │                                     │
│  ┌─────────────────────┐  │  ┌─────────────────────────────┐  │
│  │   Popup UI          │  │  │   Tray Icon + Menu          │  │
│  │   - Enable/Disable  │  │  │   - Status Indicator        │  │
│  │   - Status          │  │  │   - Quick Actions           │  │
│  │   - Quick Settings  │  │  │   - Configuration            │  │
│  └─────────────────────┘  │  └─────────────────────────────┘  │
│  ┌─────────────────────┐  │                                     │
│  │   Settings Page     │  │                                     │
│  │   - Mode Selection  │  │                                     │
│  │   - Domain Lists    │  │                                     │
│  │   - VLESS Config    │  │                                     │
│  │   - Import/Export   │  │                                     │
│  │   - Logging         │  │                                     │
│  └─────────────────────┘  │                                     │
└───────────────────────────┴─────────────────────────────────────┘
            │                           │
            │ Native Messaging          │
            │ Protocol                  │
            ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Local Proxy Service                           │
│                    (Go + Xray-core)                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Native Messaging Host                      │   │
│  │   - Message Protocol Handler                            │   │
│  │   - Configuration Manager                               │   │
│  │   - Status Monitor                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              VLESS Client (Xray-core)                    │   │
│  │   - Reality Security                                     │   │
│  │   - gRPC Transport                                       │   │
│  │   - TLS Fingerprinting                                    │   │
│  │   - Auto-reconnect                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SOCKS5 Proxy Server                        │   │
│  │   - Localhost listener (127.0.0.1:1080)                 │   │
│  │   - Connection routing                                   │   │
│  │   - Traffic logging                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SOCKS5 Protocol
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VLESS VPN Server                            │
│                  (Reality + gRPC)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Browser Extension

#### Manifest V3 Structure
```json
{
  "manifest_version": 3,
  "name": "Brows VPN",
  "version": "1.0.0",
  "permissions": [
    "proxy",
    "storage",
    "nativeMessaging",
    "tabs",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "options_page": "settings.html"
}
```

#### Core Components

**Background Service Worker** (`background.js`)
- Manages extension lifecycle
- Handles native messaging communication
- Monitors connection status
- Generates PAC scripts
- Manages Chrome Proxy API

**Popup UI** (`popup.html`, `popup.js`)
- Quick enable/disable toggle
- Connection status display
- Current mode indicator
- Quick access to settings

**Settings Page** (`settings.html`, `settings.js`)
- Mode selection (Selective/Global/Disabled)
- VLESS configuration management
- Domain list management
- Import/Export functionality
- Logging configuration

#### PAC Script Generation

**Selective Mode PAC Script**
```javascript
function FindProxyForURL(url, host) {
  // Convert domain to lowercase for comparison
  host = host.toLowerCase();
  url = url.toLowerCase();
  
  // Check if domain is in whitelist
  for (var i = 0; i < whitelist.length; i++) {
    if (shExpMatch(host, whitelist[i]) || 
        dnsDomainIs(host, whitelist[i]) ||
        isInNet(dnsResolve(host), whitelist[i], "255.255.255.255")) {
      return "SOCKS5 127.0.0.1:1080";
    }
  }
  
  // Default: direct connection
  return "DIRECT";
}
```

**Global Mode PAC Script**
```javascript
function FindProxyForURL(url, host) {
  return "SOCKS5 127.0.0.1:1080";
}
```

**Disabled Mode PAC Script**
```javascript
function FindProxyForURL(url, host) {
  return "DIRECT";
}
```

### 2. Local Proxy Service

#### Application Structure
```
proxy-service/
├── main.go                 # Application entry point
├── native-messaging/       # Native messaging host
│   ├── host.go            # Message protocol handler
│   └── protocol.go        # Message definitions
├── vless-client/          # VLESS client wrapper
│   ├── client.go          # Xray-core integration
│   ├── config.go          # Configuration management
│   └── reality.go         # Reality security
├── socks-server/          # SOCKS5 proxy server
│   ├── server.go          # SOCKS5 implementation
│   ├── auth.go            # Authentication (optional)
│   └── logging.go         # Connection logging
├── system-tray/           # Windows system tray
│   ├── tray.go            # Tray icon management
│   ├── menu.go            # Context menu
│   └── notifications.go   # Status notifications
├── config/                # Configuration management
│   ├── storage.go         # Configuration persistence
│   ├── validation.go      # Configuration validation
│   └── hotreload.go       # Hot-reload functionality
└── logging/               # Logging system
    ├── logger.go          # Structured logging
    ├── rotation.go        # Log rotation
    └── viewer.go          # Log viewer API
```

#### Native Messaging Protocol

**Message Format (JSON)**
```json
{
  "version": "1.0",
  "message_type": "command|response|event",
  "timestamp": "2024-01-01T00:00:00Z",
  "payload": {
    // Command-specific data
  }
}
```

**Command Types**

**Enable VPN**
```json
{
  "message_type": "command",
  "payload": {
    "command": "enable_vpn",
    "config": {
      "vless_url": "vless://...",
      "mode": "selective|global"
    }
  }
}
```

**Disable VPN**
```json
{
  "message_type": "command",
  "payload": {
    "command": "disable_vpn"
  }
}
```

**Update Domain List**
```json
{
  "message_type": "command",
  "payload": {
    "command": "update_domains",
    "domains": ["example.com", "*.google.com"]
  }
}
```

**Get Status**
```json
{
  "message_type": "command",
  "payload": {
    "command": "get_status"
  }
}
```

**Response Types**

**Status Response**
```json
{
  "message_type": "response",
  "payload": {
    "status": "enabled|disabled|connecting|error",
    "mode": "selective|global",
    "connected_since": "2024-01-01T00:00:00Z",
    "bytes_transferred": 1024000,
    "connection_count": 5
  }
}
```

**Error Response**
```json
{
  "message_type": "response",
  "payload": {
    "error": "connection_failed",
    "message": "Failed to connect to VPN server",
    "code": 1001
  }
}
```

#### VLESS Configuration Parser

**URL Format**
```
vless://uuid@address:port?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=publicKey&fp=chrome&sni=serverName&sid=sessionId&spx=%2F#name
```

**Parser Implementation**
```go
type VLESSConfig struct {
    UUID         string
    Address      string
    Port         int
    Type         string
    Encryption   string
    ServiceName  string
    Authority    string
    Security     string
    PublicKey    string
    Fingerprint  string
    SNI          string
    ShortID      string
    SPIX         string
    Name         string
}

func ParseVLESSURL(url string) (*VLESSConfig, error) {
    // Parse URL components
    // Validate parameters
    // Return structured configuration
}
```

#### Xray-core Integration

**Configuration Generation**
```go
func GenerateXrayConfig(vlessConfig *VLESSConfig) (*xray.Config, error) {
    return &xray.Config{
        Inbounds: []xray.InboundConfig{
            {
                Protocol: "socks",
                Listen:   "127.0.0.1",
                Port:     1080,
                Settings: &xray.SocksConfig{
                    Auth: "noauth",
                    UDP:  true,
                },
            },
        },
        Outbounds: []xray.OutboundConfig{
            {
                Protocol: "vless",
                Settings: &xray.VLESSOutboundConfig{
                    VNext: []xray.VLESSServerConfig{
                        {
                            Address: vlessConfig.Address,
                            Port:    vlessConfig.Port,
                            Users: []xray.VLESSUser{
                                {
                                    ID:         vlessConfig.UUID,
                                    Encryption: vlessConfig.Encryption,
                                },
                            },
                        },
                    },
                },
                StreamSettings: &xray.StreamSettings{
                    Network:  vlessConfig.Type,
                    Security: vlessConfig.Security,
                    TLSSettings: &xray.TLSSettings{
                        ServerName:    vlessConfig.SNI,
                        AllowInsecure: false,
                    },
                    RealitySettings: &xray.RealitySettings{
                        Dest:        vlessConfig.Address + ":" + strconv.Itoa(vlessConfig.Port),
                        ServerNames: []string{vlessConfig.SNI},
                        PrivateKey:  "", // Generated or loaded
                        ShortIds:    []string{vlessConfig.ShortID},
                    },
                    GRPCConfig: &xray.GRPCConfig{
                        ServiceName: vlessConfig.ServiceName,
                    },
                },
            },
        },
    }
}
```

### 3. Data Flow

#### VPN Connection Process
```
1. User enables VPN in extension
   ↓
2. Extension sends enable command via native messaging
   ↓
3. Service receives command and parses VLESS config
   ↓
4. Service generates Xray-core configuration
   ↓
5. Service starts Xray-core with VLESS config
   ↓
6. Service starts SOCKS5 proxy server
   ↓
7. Extension generates PAC script
   ↓
8. Extension sets Chrome proxy settings
   ↓
9. Chrome routes traffic based on PAC script
   ↓
10. SOCKS5 proxy forwards to Xray-core
    ↓
11. Xray-core connects via VLESS to VPN server
    ↓
12. Service sends status back to extension
    ↓
13. Extension updates UI
```

#### Domain Routing Process
```
1. User navigates to website
   ↓
2. Chrome checks PAC script
   ↓
3. PAC script evaluates domain against whitelist
   ↓
4. If in whitelist: Route to SOCKS5 (127.0.0.1:1080)
   If not: Route DIRECT
   ↓
5. SOCKS5 proxy receives connection
   ↓
6. SOCKS5 proxy forwards to Xray-core
   ↓
7. Xray-core encapsulates in VLESS protocol
   ↓
8. Xray-core sends to VPN server
   ↓
9. VPN server forwards to destination
   ↓
10. Response follows reverse path
```

## Security Architecture

### 1. Data Protection

**Configuration Storage**
- VLESS configurations encrypted at rest
- Windows DPAPI for encryption
- No plaintext storage of sensitive data

**Communication Security**
- Native messaging uses browser's secure channel
- Localhost-only binding for SOCKS5 proxy
- No external network communication except VPN server

### 2. Access Control

**Browser Extension**
- Requires explicit user permission
- Native messaging restricted to specific host
- Configuration changes require user confirmation

**System Tray Application**
- Windows service security context
- UAC prompts for administrative operations
- Secure inter-process communication

### 3. Threat Mitigation

**DNS Leak Prevention**
- Force DNS through VPN tunnel
- DNS over VPN configuration
- Monitor DNS requests

**WebRTC Leak Prevention**
- Block WebRTC in selective mode
- Configure WebRTC IP handling policy
- Monitor for leaks

**Transparent Proxy**
- System-level proxy configuration
- Application-specific routing
- Fallback mechanisms

## Performance Considerations

### 1. Extension Performance

**Memory Management**
- Lightweight background script
- Efficient DOM manipulation
- Lazy loading of resources

**Network Performance**
- Minimal extension overhead
- Optimized PAC script evaluation
- Connection pooling in SOCKS5

### 2. Service Performance

**Connection Management**
- Connection pooling and reuse
- Efficient buffer management
- Asynchronous I/O operations

**Resource Usage**
- Memory monitoring
- CPU usage optimization
- Garbage collection tuning

## Monitoring and Logging

### 1. Logging Levels

**DEBUG**
- Detailed connection information
- Protocol-level details
- Performance metrics

**INFO**
- Connection status changes
- Configuration updates
- User actions

**WARNING**
- Connection failures
- Retry attempts
- Performance degradation

**ERROR**
- Critical failures
- Configuration errors
- Security issues

### 2. Metrics Collected

**Connection Metrics**
- Connection success/failure rate
- Connection establishment time
- Reconnection frequency
- Active connection count

**Traffic Metrics**
- Bytes transferred
- Connection duration
- Request/response times
- Error rates

**System Metrics**
- CPU usage
- Memory usage
- Disk I/O
- Network interface stats

## Error Handling Strategy

### 1. Connection Errors

**Retriable Errors**
- Network timeouts
- Temporary server unavailability
- Connection drops

**Non-Retriable Errors**
- Authentication failures
- Configuration errors
- Protocol mismatches

### 2. Fallback Mechanisms

**Connection Failures**
- Exponential backoff retry
- Alternative server selection (if available)
- Direct connection fallback

**Service Failures**
- Graceful degradation
- Cache-based operation
- User notification

## Deployment Architecture

### 1. Extension Deployment

**Packaging**
- Chrome Extension Package (.crx)
- Signed for distribution
- Auto-update mechanism

**Installation**
- Browser Web Store (optional for personal use)
- Side-loading for development
- Configuration wizard

### 2. Service Deployment

**Packaging**
- Windows Installer (.msi)
- Service registration
- Auto-start configuration

**Installation**
- Administrator privileges required
- Firewall configuration
- Path configuration

## Upgrade Strategy

### 1. Extension Updates

**Auto-Update**
- Chrome Web Store updates
- Background update checks
- Configuration migration

**Manual Updates**
- Configuration preservation
- Backup before update
- Rollback capability

### 2. Service Updates

**Auto-Update**
- Built-in updater
- Signature verification
- Safe update process

**Manual Updates**
- Service stop before update
- Configuration migration
- Service restart after update