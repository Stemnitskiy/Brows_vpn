# Brows VPN - Development Plan

> **⚠️ Исторический документ.** Создан на этапе планирования (Phase 0).  
> **Актуальный план:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)  
> **Статус:** [CURRENT_STATUS.md](./CURRENT_STATUS.md)

---

# Brows VPN - Development Plan (original)

## Immediate Next Steps

### Phase 0: Environment Setup (Days 1-2)

#### 0.1 Repository Setup
```bash
# Create main project structure
cd D:/Projects/Brows_vpn
mkdir -p {extension,proxy-service,docs,scripts}
```

#### 0.2 Clone and Analyze Censor Tracker
```bash
# Clone Censor Tracker repositories
git clone https://github.com/censortracker/censortracker.git extension/base
git clone https://github.com/censortracker/proxy.git proxy-service/base
```

#### 0.3 Development Tools Installation

**For Extension Development**
- Node.js LTS
- npm or yarn
- TypeScript
- React (if using)
- Chrome/Edge browser for testing

**For Proxy Service Development**
- Go (latest stable)
- Git
- Make (optional)
- Windows SDK (for system tray integration)

#### 0.4 IDE and Tools
- VS Code with extensions:
  - ES6 JavaScript/TypeScript
  - Go
  - Chrome Extension
  - REST Client
  - GitLens

### Phase 1: Analysis and Planning (Days 3-4)

#### 1.1 Censor Tracker Extension Analysis

**Tasks:**
- [ ] Review extension manifest and permissions
- [ ] Analyze popup UI structure
- [ ] Study settings page implementation
- [ ] Examine PAC script generation logic
- [ ] Review native messaging implementation
- [ ] Document extension architecture
- [ ] Identify modification points for VLESS support

**Deliverable:** `docs/censortracker_extension_analysis.md`

#### 1.2 Censor Tracker Proxy Analysis

**Tasks:**
- [ ] Review Go application structure
- [ ] Analyze Xray-core integration
- [ ] Study SOCKS5 proxy implementation
- [ ] Examine configuration management
- [ ] Review logging system
- [ ] Document proxy service architecture
- [ ] Identify enhancement points

**Deliverable:** `docs/censortracker_proxy_analysis.md`

#### 1.3 VLESS Configuration Parser Design

**Tasks:**
- [ ] Design URL parser for VLESS format
- [ ] Define configuration validation rules
- [ ] Design internal configuration structure
- [ ] Plan configuration security (encryption)
- [ ] Design configuration migration strategy

**Deliverable:** `docs/vless_parser_design.md`

#### 1.4 UI/UX Design

**Tasks:**
- [ ] Sketch extension popup redesign
- [ ] Design settings page layout
- [ ] Plan domain management interface
- [ ] Design system tray menu structure
- [ ] Create wireframes/mockups

**Deliverable:** `docs/ui_design.md`

### Phase 2: Extension Development (Week 2)

#### 2.1 Extension Foundation

**Tasks:**
- [ ] Copy Censor Tracker extension to working directory
- [ ] Update manifest.json for Brows VPN
- [ ] Update package.json and dependencies
- [ ] Set up build configuration
- [ ] Configure TypeScript/JavaScript tooling
- [ ] Set up development build scripts

**Commands:**
```bash
cd extension
cp -r ../base/* .
npm install
# Modify manifest.json
# Update package.json
npm run build
```

#### 2.2 Popup UI Implementation

**Tasks:**
- [ ] Redesign popup HTML structure
- [ ] Implement popup CSS styling
- [ ] Create enable/disable toggle
- [ ] Add status indicator component
- [ ] Implement quick actions menu
- [ ] Add settings button
- [ ] Test popup responsiveness

**Files:**
- `popup/popup.html`
- `popup/popup.css`
- `popup/popup.js`

#### 2.3 Settings Page Implementation

**Tasks:**
- [ ] Create settings page HTML structure
- [ ] Implement settings CSS styling
- [ ] Create mode selection component
- [ ] Add VLESS configuration input
- [ ] Implement domain list management UI
- [ ] Add import/export functionality
- [ ] Add logging configuration section
- [ ] Implement settings persistence

**Files:**
- `settings/settings.html`
- `settings/settings.css`
- `settings/settings.js`

#### 2.4 Domain Management System

**Tasks:**
- [ ] Implement domain input validation
- [ ] Create domain list storage structure
- [ ] Implement domain CRUD operations
- [ ] Add wildcard support (*.domain.com)
- [ ] Implement bulk import functionality
- [ ] Add domain categories/groups
- [ ] Test domain matching logic

**Files:**
- `src/domain-manager.js`
- `src/domain-validator.js`

#### 2.5 PAC Script Generator

**Tasks:**
- [ ] Design PAC script template system
- [ ] Implement selective mode script
- [ ] Implement global mode script
- [ ] Add bypass list support
- [ ] Implement script caching
- [ ] Test PAC script validity
- [ ] Add script error handling

**Files:**
- `src/pac-generator.js`
- `src/pac-templates.js`

#### 2.6 Chrome Proxy Integration

**Tasks:**
- [ ] Implement proxy API wrapper
- [ ] Add PAC script dynamic setting
- [ ] Implement proxy error handling
- [ ] Add fallback mechanisms
- [ ] Implement proxy status monitoring
- [ ] Test proxy switching
- [ ] Handle browser-specific quirks

**Files:**
- `src/proxy-manager.js`
- `src/proxy-error-handler.js`

#### 2.7 Native Messaging Client

**Tasks:**
- [ ] Implement native messaging wrapper
- [ ] Create message protocol handler
- [ ] Implement command queue system
- [ ] Add response handling
- [ ] Implement event listening
- [ ] Add error handling
- [ ] Test communication with mock service

**Files:**
- `src/native-messaging.js`
- `src/protocol-handler.js`

### Phase 3: Proxy Service Development (Week 3)

#### 3.1 Service Foundation

**Tasks:**
- [ ] Copy Censor Tracker proxy to working directory
- [ ] Set up Go module structure
- [ ] Update dependencies (go.mod)
- [ ] Create main application entry point
- [ ] Set up build configuration
- [ ] Create Windows service wrapper

**Commands:**
```bash
cd proxy-service
cp -r ../base/* .
go mod init browsvpn-proxy
go mod tidy
# Update go.mod
# Create main.go
```

#### 3.2 Native Messaging Host

**Tasks:**
- [ ] Implement native messaging protocol
- [ ] Create message parser
- [ ] Implement command dispatcher
- [ ] Add response generator
- [ ] Implement event broadcaster
- [ ] Add error handling
- [ ] Test with mock extension

**Files:**
- `native-messaging/host.go`
- `native-messaging/protocol.go`
- `native-messaging/dispatcher.go`

#### 3.3 VLESS Client Implementation

**Tasks:**
- [ ] Integrate Xray-core dependency
- [ ] Implement VLESS configuration parser
- [ ] Create Xray config generator
- [ ] Implement Reality security support
- [ ] Add gRPC transport support
- [ ] Implement TLS fingerprinting
- [ ] Test VLESS connection with provided config

**Files:**
- `vless-client/client.go`
- `vless-client/config.go`
- `vless-client/reality.go`

#### 3.4 SOCKS5 Proxy Server

**Tasks:**
- [ ] Implement SOCKS5 protocol
- [ ] Create localhost listener
- [ ] Implement connection handling
- [ ] Add connection logging
- [ ] Implement authentication (optional)
- [ ] Add connection statistics
- [ ] Test SOCKS5 functionality

**Files:**
- `socks-server/server.go`
- `socks-server/handler.go`
- `socks-server/logging.go`

#### 3.5 System Tray Integration

**Tasks:**
- [ ] Implement Windows system tray icon
- [ ] Create context menu
- [ ] Add status indicator
- [ ] Implement tooltip
- [ ] Add event handling
- [ ] Integrate with service control
- [ ] Test tray functionality

**Files:**
- `system-tray/tray.go`
- `system-tray/menu.go`
- `system-tray/status.go`

#### 3.6 Configuration Management

**Tasks:**
- [ ] Implement configuration storage
- [ ] Add configuration validation
- [ ] Implement hot-reload
- [ ] Add encryption for sensitive data
- [ ] Implement backup/restore
- [ ] Add configuration migration
- [ ] Test configuration persistence

**Files:**
- `config/storage.go`
- `config/validation.go`
- `config/encryption.go`
- `config/hotreload.go`

#### 3.7 Auto-reconnect Logic

**Tasks:**
- [ ] Implement connection monitoring
- [ ] Add reconnection triggers
- [ ] Implement exponential backoff
- [ ] Add max retry limits
- [ ] Implement connection state machine
- [ ] Add reconnection logging
- [ ] Test reconnection scenarios

**Files:**
- `reconnect/monitor.go`
- `reconnect/backoff.go`
- `reconnect/statemachine.go`

#### 3.8 Logging System

**Tasks:**
- [ ] Implement structured logging
- [ ] Add log levels
- [ ] Implement log rotation
- [ ] Add log filtering
- [ ] Create log storage
- [ ] Implement log viewer API
- [ ] Test logging performance

**Files:**
- `logging/logger.go`
- `logging/rotation.go`
- `logging/viewer.go`

### Phase 4: Integration and Testing (Week 4)

#### 4.1 Extension-Service Integration

**Tasks:**
- [ ] End-to-end communication test
- [ ] Configuration sync test
- [ ] Status synchronization test
- [ ] Control integration test
- [ ] Error handling test
- [ ] Performance test

**Test Scenarios:**
- Enable VPN from extension
- Disable VPN from system tray
- Switch modes from both interfaces
- Update domain lists
- Import/export configurations
- Error recovery

#### 4.2 Comprehensive Testing

**Tasks:**
- [ ] Unit tests for extension
- [ ] Unit tests for proxy service
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Performance tests
- [ ] Security tests

**Testing Framework:**
- Extension: Jest + Testing Library
- Service: Go testing package
- Integration: Custom test scripts

#### 4.3 Bug Fixes and Optimization

**Tasks:**
- [ ] Fix identified bugs
- [ ] Optimize performance
- [ ] Memory leak detection
- [ ] Resource usage optimization
- [ ] UI responsiveness improvement

### Phase 5: Documentation and Packaging (Week 5)

#### 5.1 Documentation

**Tasks:**
- [ ] Write user guide
- [ ] Write installation instructions
- [ ] Write troubleshooting guide
- [ ] Update API documentation
- [ ] Create FAQ

#### 5.2 Packaging

**Tasks:**
- [ ] Create extension package
- [ ] Create Windows installer
- [ ] Test installation process
- [ ] Create uninstaller
- [ ] Add auto-update mechanism

#### 5.3 Final Testing

**Tasks:**
- [ ] Test on clean Windows 11 installation
- [ ] Test on different Chromium browsers
- [ ] Test with different VLESS configurations
- [ ] Performance benchmarking
- [ ] Security audit

## Development Guidelines

### Code Style

**Extension (JavaScript/TypeScript):**
- Use ESLint for code quality
- Follow Airbnb style guide
- Use meaningful variable names
- Add JSDoc comments
- Implement error handling

**Service (Go):**
- Follow Effective Go guidelines
- Use gofmt for formatting
- Add godoc comments
- Handle errors properly
- Use idiomatic Go patterns

### Git Workflow

**Branch Strategy:**
- `main` - stable production code
- `develop` - integration branch
- `feature/*` - feature branches
- `bugfix/*` - bug fix branches
- `doc/*` - documentation updates

**Commit Messages:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: feat, fix, docs, style, refactor, test, chore

### Testing Strategy

**Unit Tests:**
- Extension: Jest with >80% coverage
- Service: Go tests with >80% coverage

**Integration Tests:**
- End-to-end scenarios
- Cross-component communication
- Real configuration testing

**Performance Tests:**
- Extension load time < 500ms
- Service startup time < 3s
- Memory usage < 100MB
- Connection establishment < 5s

### Security Considerations

**Extension:**
- Validate all user inputs
- Encrypt sensitive data
- Use secure storage APIs
- Follow content security policy

**Service:**
- Bind to localhost only
- Validate all configurations
- Implement proper authentication
- Secure inter-process communication
- Regular security updates

## Milestones

### Milestone 1: Working Prototype (Week 2)
- Basic extension UI
- Connection to VPN server
- Simple domain routing

### Milestone 2: Full Feature Set (Week 3)
- All UI components
- Domain management
- Import/export
- Logging

### Milestone 3: Integration Complete (Week 4)
- Extension-service communication
- System tray integration
- Auto-reconnect
- Configuration sync

### Milestone 4: Production Ready (Week 5)
- Comprehensive testing
- Documentation complete
- Installation packages
- Performance optimized

## Risk Mitigation

**Technical Risks:**
- **Xray-core compatibility**: Test early with provided VLESS config
- **Chrome API changes**: Monitor Chrome releases and adapt
- **Performance issues**: Regular profiling and optimization

**Development Risks:**
- **Timeline delays**: Build in buffer time
- **Complex integration**: Incremental approach with frequent testing
- **Dependencies**: Monitor open-source project updates

## Success Criteria

- ✅ VLESS Reality connection works with provided config
- ✅ Selective site proxying functional
- ✅ Global VPN mode operational
- ✅ Domain management user-friendly
- ✅ Auto-reconnect works consistently
- ✅ System tray integration functional
- ✅ Logging comprehensive and useful
- ✅ Import/export works seamlessly
- ✅ Performance acceptable for daily use
- ✅ Installation process straightforward

## Next Immediate Actions

1. **Today:**
   - Set up development environment
   - Clone Censor Tracker repositories
   - Set up project structure

2. **Tomorrow:**
   - Analyze Censor Tracker extension
   - Analyze Censor Tracker proxy
   - Create analysis documents

3. **This Week:**
   - Complete analysis phase
   - Design VLESS parser
   - Create UI mockups
   - Start extension development

4. **Next Week:**
   - Complete extension UI
   - Start proxy service development
   - Implement VLESS client