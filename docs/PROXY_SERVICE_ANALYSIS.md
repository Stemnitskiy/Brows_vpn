# Censor Tracker Proxy Service - Detailed Analysis

> **Справочный документ** (Phase 1). Brows VPN proxy переписан на Go, не C++/Qt.  
> План: [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)

## Project Overview

**Repository**: censortracker/proxy  
**Version**: 0.1.0.8  
**Language**: C++17  
**Framework**: Qt6  
**Platform**: Windows-only  
**Purpose**: Lightweight proxy client with Xray-core integration

## Technology Stack

### Core Technologies
- **C++17** with CMake build system
- **Qt6** (Core, Network, HttpServer, Widgets)
- **Xray-core** as git submodule
- **Windows-specific** APIs

### Qt6 Components
```cmake
find_package(Qt6 REQUIRED COMPONENTS 
    Core       # Core functionality
    Network    # Network operations
    HttpServer # HTTP server for API
    Widgets    # GUI components
)
```

## Architecture

### Directory Structure
```
proxy-service/base/
├── proxyserver/           # Main server application
│   └── src/
│       ├── main.cpp              # Application entry point
│       ├── proxyserver.h/cpp     # Main server class
│       ├── proxyservice.h/cpp    # Proxy service implementation
│       ├── xraycontroller.h/cpp  # Xray-core management
│       ├── configmanager.h/cpp   # Configuration management
│       ├── httpapi.h/cpp         # HTTP API for integration
│       ├── trayicon.h/cpp        # System tray integration
│       ├── logger.h/cpp          # Logging system
│       └── iproxyservice.h       # Interface definition
├── client_moc/            # Qt meta-object compiler
├── xray-prebuilt/         # Xray-core binaries (git submodule)
├── deploy/                # Deployment scripts
└── CMakeLists.txt         # Build configuration
```

## Core Components Analysis

### 1. Main Application (`main.cpp`)

**Purpose**: Qt application entry point

**Key Features**:
```cpp
- QApplication initialization
- Logger setup (AppDataLocation/logs/app.log)
- Window icon configuration
- ProxyServer start on port 49490
- Qt event loop
```

**Logging Configuration**:
- Path: `AppDataLocation/logs/app.log`
- Level: INFO
- Standard Qt logging approach

### 2. Proxy Server (`proxyserver.h/cpp`)

**Purpose**: Main server coordination

**Responsibilities**:
- HTTP API server (port 49490)
- Coordinate between components
- Application lifecycle management

**Architecture**:
- Qt-based HTTP server
- RESTful API for extension communication
- Integration with XrayController
- Configuration management

### 3. Xray Controller (`xraycontroller.h/cpp`)

**Purpose**: Xray-core process management

**Key Responsibilities**:
- Start/stop Xray-core process
- Configuration generation
- Process monitoring
- Health checks

**Integration Approach**:
- External process management
- Configuration file generation
- Stdout/stderr handling
- Process lifecycle control

### 4. Configuration Manager (`configmanager.h/cpp`)

**Purpose**: Configuration storage and management

**Features**:
- Configuration persistence
- Validation
- Hot-reload support
- Settings management

**Configuration Schema** (implied):
- Proxy server configurations
- Xray-core settings
- API settings
- Logging configuration

### 5. HTTP API (`httpapi.h/cpp`)

**Purpose**: RESTful API for extension integration

**API Endpoints** (based on OpenAPI spec):
- Configuration management
- Connection control
- Status monitoring
- Statistics retrieval

**Integration Pattern**:
```javascript
// Extension communicates via HTTP
fetch('http://localhost:49490/api/...', {
  method: 'POST',
  body: JSON.stringify({ ... })
})
```

### 6. Tray Icon (`trayicon.h/cpp`)

**Purpose**: Windows system tray integration

**Features**:
- System tray icon
- Context menu
- Status indication
- Quick actions
- Notifications

**Qt Implementation**:
- QSystemTrayIcon
- QMenu for context menu
- QIcon for status indication
- Platform-specific Windows integration

### 7. Logger (`logger.h/cpp`)

**Purpose**: Application logging

**Features**:
- File-based logging
- Log levels (DEBUG, INFO, WARNING, ERROR)
- Log rotation (implied)
- Thread-safe logging

**Configuration**:
- File location: AppDataLocation
- Default level: INFO
- Standard formatting

## Xray-Core Integration

### Current Approach
```
C++ Application → Configuration File → Xray-core Process
                                        ↓
                                SOCKS5 Proxy (127.0.0.1:1080)
```

### Xray Configuration
- Generated dynamically by ConfigManager
- JSON-based configuration
- Support for VLESS, VMess, Shadowsocks, Trojan
- Transport: TCP, WebSocket, gRPC, mKCP
- Security: TLS, Reality

### Process Management
- External process execution
- Configuration file passing
- Stdout/stderr monitoring
- Process lifecycle control
- Health monitoring

## HTTP API Architecture

### Communication Pattern
```
Browser Extension → HTTP Request → Qt HTTP Server → Internal Logic → Response
```

### API Structure (based on OpenAPI)
- **Configuration endpoints**: CRUD for proxy configs
- **Control endpoints**: Start/Stop/Status operations
- **Monitoring endpoints**: Statistics and health
- **Settings endpoints**: Application settings

### Integration with Extension
```javascript
// Current Censor Tracker approach
fetch('http://localhost:49490/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    protocol: 'vless',
    config: { ... }
  })
})
```

## Build System

### CMake Configuration
```cmake
cmake_minimum_required(VERSION 3.25)
project(desktopproxy VERSION 0.1.0.8 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 REQUIRED COMPONENTS Core Network HttpServer Widgets)
```

### Build Process
1. CMake configuration
2. Qt MOC/RCC/UIC processing
3. C++ compilation
4. Linking with Qt libraries
5. Windows executable generation

### Deployment
- Windows executable (.exe)
- Xray-core binary inclusion
- Qt runtime dependencies
- Installation scripts

## Windows-Specific Features

### System Tray Integration
- QSystemTrayIcon for tray icon
- Windows-specific notification API
- Context menu with native look
- Auto-start on Windows startup

### File System
- QStandardPaths for standard locations
- AppDataLocation for configs and logs
- Windows registry integration (implied)
- Windows service capabilities (potential)

### Platform Limitations
- **Windows-only** as stated in README
- No macOS/Linux support planned
- Windows SDK dependencies
- Platform-specific Qt modules

## Key Findings for Brows VPN

### 1. Complexity Assessment

**High Complexity Areas**:
- Qt6 framework dependency
- C++ compilation and linking
- Windows-specific Qt modules
- Xray-core process management
- Cross-language debugging (C++ + JS)

**Moderate Complexity Areas**:
- HTTP API implementation
- Configuration management
- Logging system
- File system operations

### 2. Valuable Components to Port

**HTTP API Pattern**:
- RESTful design
- JSON communication
- Status monitoring
- Configuration management

**Xray-Core Integration**:
- External process approach (good for Go)
- Configuration generation
- Process lifecycle management
- Health monitoring

**System Tray**:
- Status indication
- Context menu
- Quick actions
- User notifications

**Logging System**:
- File-based logging
- Log levels
- Structured logging
- Log rotation

### 3. Components to Reimplement in Go

**HTTP API** → Go HTTP server (net/http)
**Configuration Manager** → Go struct + JSON encoding
**Xray Controller** → Go os/exec + configuration generation
**Logger** → Go log packages (logrus, zap)
**Tray Icon** → Go tray library (systray, getlantern/systray)

### 4. Xray-Core Integration Strategy

**Go Approach**:
```go
// Similar to C++ approach
func (x *XrayController) Start(config *XrayConfig) error {
    // 1. Generate Xray config JSON
    configFile := x.generateConfig(config)
    
    // 2. Start Xray-core process
    cmd := exec.Command("./xray", "-c", configFile)
    cmd.Stdout = &x.stdout
    cmd.Stderr = &x.stderr
    
    // 3. Start process
    return cmd.Start()
}
```

**Advantages**:
- Simpler process management in Go
- Better concurrency support
- Easier error handling
- Cross-platform potential

## Go Implementation Strategy

### 1. Project Structure
```
proxy-service/
├── cmd/
│   └── main.go              # Application entry point
├── internal/
│   ├── api/                 # HTTP API
│   │   ├── server.go        # HTTP server
│   │   ├── handlers.go      # Request handlers
│   │   └── middleware.go    # HTTP middleware
│   ├── xray/               # Xray-core management
│   │   ├── controller.go    # Process controller
│   │   ├── config.go        # Config generation
│   │   └── health.go        # Health monitoring
│   ├── config/             # Configuration management
│   │   ├── storage.go       # Configuration persistence
│   │   ├── validation.go    # Config validation
│   │   └── hotreload.go     # Hot-reload logic
│   ├── proxy/              # SOCKS5 proxy
│   │   ├── server.go        # SOCKS5 server (optional)
│   │   └── handler.go       # Connection handler
│   ├── tray/               # System tray
│   │   ├── icon.go          # Tray icon
│   │   ├── menu.go          # Context menu
│   │   └── notifications.go # Notifications
│   ├── logging/            # Logging system
│   │   ├── logger.go        # Structured logger
│   │   ├── rotation.go      # Log rotation
│   │   └── levels.go        # Log levels
│   └── messaging/          # Alternative to HTTP API
│       ├── protocol.go      # Message protocol
│       └── host.go          # Native messaging host
├── pkg/
│   ├── vless/              # VLESS utilities
│   │   ├── parser.go        # URL parser
│   │   ├── config.go        # Config structures
│   │   └── validation.go    # Validation logic
│   └── utils/              # Utilities
│       ├── domain.go        # Domain utilities
│       └── network.go       # Network utilities
├── xray-core/              # Xray-core binary
├── configs/                # Configuration files
├── logs/                   # Log files
└── go.mod                  # Go module definition
```

### 2. Key Libraries

**HTTP Server**:
- `net/http` (standard library)
- `github.com/gin-gonic/gin` (optional, for REST API)

**System Tray**:
- `github.com/getlantern/systray` (cross-platform)
- `github.com/fyne-io/systray` (alternative)

**Configuration**:
- `encoding/json` (standard library)
- `github.com/spf13/viper` (configuration management)

**Logging**:
- `logrus` or `zap` (structured logging)
- `lumberjack` (log rotation)

**Process Management**:
- `os/exec` (standard library)
- `github.com/kardianos/service` (Windows service)

### 3. Integration with Extension

**Option 1: HTTP API (like Censor Tracker)**
```go
// Go HTTP server
router := gin.Default()
router.POST("/api/config", api.SetConfig)
router.POST("/api/control", api.ControlProxy)
router.GET("/api/status", api.GetStatus)
router.Run(":49490")
```

**Option 2: Native Messaging (better for Chrome)**
```go
// Native messaging protocol
func handleNativeMessage(msg []byte) {
    // Parse JSON message
    // Process command
    // Send response
}
```

**Recommendation**: Native Messaging for better integration with Chrome security model

### 4. Xray-Core Binary Distribution

**Options**:
1. Include binary in repository
2. Download on first run
3. Use Xray-core as Go library (complex)

**Recommendation**: Include binary for simplicity, with download fallback

## Development Roadmap

### Phase 1: Core Go Application
- [ ] Set up Go module structure
- [ ] Implement basic HTTP server
- [ ] Create configuration structures
- [ ] Implement logging system

### Phase 2: Xray Integration
- [ ] Download/include Xray-core binary
- [ ] Implement Xray config generator
- [ ] Implement process controller
- [ ] Add health monitoring

### Phase 3: System Tray
- [ ] Integrate systray library
- [ ] Create context menu
- [ ] Add status indication
- [ ] Implement notifications

### Phase 4: Extension Integration
- [ ] Implement native messaging host
- [ ] Create message protocol
- [ ] Test communication
- [ ] Handle errors

### Phase 5: Advanced Features
- [ ] Auto-reconnect logic
- [ ] Enhanced logging
- [ ] Configuration hot-reload
- [ ] Statistics collection

## Benefits of Go Approach

### 1. Development Speed
- Faster compilation than C++
- Simpler dependency management
- Easier testing
- Better tooling

### 2. Cross-Platform Potential
- Go runs on Windows, macOS, Linux
- Easier to maintain multi-platform support
- Consistent behavior across platforms

### 3. Concurrency
- Goroutines for concurrent operations
- Better handling of multiple connections
- Efficient resource usage

### 4. Maintenance
- Simpler codebase
- Easier onboarding
- Better documentation generation
- Easier debugging

### 5. Deployment
- Single binary distribution
- No runtime dependencies
- Smaller footprint
- Easier installation

## Conclusion

Censor Tracker proxy service provides valuable architectural patterns:
- Xray-core as external process (good pattern)
- HTTP API for integration (proven approach)
- System tray integration (user-friendly)
- Configuration management (solid foundation)

However, the C++/Qt stack introduces unnecessary complexity for our use case.

**Go Implementation Benefits**:
- Simpler development and maintenance
- Faster iteration cycle
- Cross-platform potential
- Better concurrency support
- Easier deployment

**Strategy**: Port architectural patterns to Go, reimplement components with Go libraries, maintain compatibility with extension through same API interface (native messaging preferred).

This approach balances proven patterns with modern development practices.