# Brows VPN Proxy Service

Go-based proxy service with Xray-core integration for Brows VPN extension.

## Features

- **VLESS Protocol Support**: Full support for VLESS with Reality security
- **Xray-core Integration**: Manages Xray-core as external process
- **Native Messaging**: Chrome native messaging protocol for extension communication
- **System Tray**: Windows system tray integration for easy control
- **Configuration Management**: Dynamic configuration generation and hot-reload
- **Logging**: Structured logging with log rotation

## Requirements

- Go 1.21 or higher
- Windows 11 (for system tray integration)
- Xray-core binary

## Installation

### 1. Install Go

Download and install Go from https://golang.org/dl/

### 2. Download Xray-core

Download Xray-core binary from https://github.com/XTLS/Xray-core/releases

Place the binary in the `xray-core/` directory:
```
proxy-service/xray-core/xray.exe
```

### 3. Build the Service

```bash
cd proxy-service
go mod tidy
go build -o browsvpn-proxy.exe ./cmd
```

### 4. Configure Native Messaging

Create Chrome native messaging host configuration:

**Windows Registry**:
```
HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host
```

Value: `C:\path\to\browsvpn-proxy.exe --native-messaging`

## Usage

### Standalone Mode (with System Tray)

```bash
browsvpn-proxy.exe
```

This will start the application with system tray icon.

### Native Messaging Mode (for Chrome Extension)

```bash
browsvpn-proxy.exe --native-messaging
```

This mode is used by Chrome extension via native messaging protocol.

## Development

### Project Structure

```
proxy-service/
├── cmd/                 # Application entry points
│   └── main.go         # Main application
├── internal/           # Internal packages
│   ├── api/           # HTTP API (optional)
│   ├── xray/          # Xray-core management
│   ├── config/        # Configuration management
│   ├── tray/          # System tray integration
│   ├── logging/       # Logging system
│   └── messaging/     # Native messaging protocol
├── pkg/              # Public packages
│   ├── vless/        # VLESS protocol utilities
│   └── utils/        # Utility functions
├── xray-core/       # Xray-core binary
├── configs/         # Configuration files
├── logs/            # Log files
└── go.mod          # Go module definition
```

### Building

```bash
# Build for Windows
GOOS=windows GOARCH=amd64 go build -o browsvpn-proxy.exe ./cmd

# Build with debug symbols
go build -gcflags="all=-N -l" -o browsvpn-proxy-debug.exe ./cmd
```

### Testing

```bash
# Run tests
go test ./...

# Run with coverage
go test -cover ./...
```

## Configuration

The service expects VLESS configuration URLs in the format:
```
vless://uuid@address:port?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=publicKey&fp=chrome&sni=serverName&sid=sessionId&spx=%2F#name
```

## Logs

Logs are stored in the `logs/` directory with automatic rotation:
- Maximum size: 100 MB per file
- Maximum backups: 3 files
- Maximum age: 28 days
- Compression: enabled

## Troubleshooting

### Go command not found
Make sure Go is installed and added to your PATH:
```bash
go version
```

### Xray-core not found
Ensure Xray-core binary is in the `xray-core/` directory.

### Native messaging not working
Check Chrome native messaging configuration in Windows Registry.

## License

MIT License - see LICENSE file for details.