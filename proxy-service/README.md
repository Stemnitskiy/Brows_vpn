# Brows VPN Proxy Service

Go-based proxy service with Xray-core integration for Brows VPN extension.

> **Статус:** ~30% — каркас готов, native messaging и Xray integration не завершены.  
> **План:** [docs/IMPLEMENTATION_ROADMAP.md](../docs/IMPLEMENTATION_ROADMAP.md)

## Features

| Feature | Status |
|---------|--------|
| VLESS URL parser | ✅ |
| Xray process controller | ✅ |
| Native messaging host | 🔴 Protocol/registry incorrect |
| System tray | 🔴 Disabled in main.go |
| Structured logging | ✅ |

## Requirements

- Go 1.21+
- Windows 11
- Xray-core binary (not in repo)

## Installation

### 1. Download Xray-core

From https://github.com/XTLS/Xray-core/releases — place binary at:

```
proxy-service/xray-core/xray.exe
```

### 2. Build

```powershell
cd proxy-service
go mod tidy
go build -o browsvpn-proxy.exe ./cmd
```

### 3. Native Messaging Host

> **⚠️ Pending fix (Roadmap Stage 1):** requires JSON manifest + corrected protocol.

Planned setup:
1. `com.browsvpn.host.json` — host manifest with `path`, `allowed_origins`
2. Registry key points to **manifest JSON**, not exe directly
3. Chrome launches exe without args → native messaging mode by default

See [NATIVE_MESSAGING_SETUP.md](./NATIVE_MESSAGING_SETUP.md) and [docs/FINAL_INSTRUCTIONS.md](../docs/FINAL_INSTRUCTIONS.md).

## Usage

### Standalone Mode (planned)

System tray mode — **currently disabled** in `cmd/main.go`.

### Native Messaging Mode

Chrome extension launches the host automatically when user enables VPN. Manual `--native-messaging` flag is a **temporary workaround** and will be removed.

## Project Structure

```
proxy-service/
├── cmd/main.go              # Entry point
├── internal/
│   ├── messaging/host.go    # Native messaging (needs fix)
│   ├── xray/controller.go   # Xray process management
│   ├── tray/tray.go         # System tray (not wired)
│   └── logging/logger.go
├── pkg/vless/parser.go      # VLESS parser + ToXrayConfig
├── xray-core/               # xray.exe + geo data
├── setup_registry.bat       # Needs update for JSON manifest
└── go.mod
```

## Configuration

VLESS URL format:

```
vless://uuid@host:port?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=...&fp=chrome&sni=...&sid=...&spx=%2F#name
```

## Logs

`logs/app.log` — rotation via lumberjack (100MB, 3 backups, 28 days).

## Troubleshooting

| Issue | Check |
|-------|-------|
| Go not found | `go version` |
| Xray not found | `xray-core/xray.exe` exists |
| Native messaging fails | See [CURRENT_STATUS.md](../docs/CURRENT_STATUS.md) blockers |

## License

MIT
