# Brows VPN — Proxy Service

> **Статус:** ✅ Production path — Native Messaging host + Xray controller  
> **Extension:** v2.2.1 · **SOCKS:** `127.0.0.1:10808`  
> **Security:** [../docs/SECURITY.md](../docs/SECURITY.md)

---

## Overview

Go binary `browsvpn-proxy.exe` — Chrome Native Messaging host. Принимает length-prefixed JSON, управляет процессом Xray, отдаёт preflight/health/logs.

---

## Build & Install

```powershell
cd proxy-service
.\install.bat
```

Или из исходников:

```powershell
.\install.ps1 -Build
```

`-ExtensionId` — только override для debug (другой unpacked ID).
`-Release` — строгая установка: требует `xray-core\xray.exe.sha256`.

Поместите `xray.exe` + `geoip.dat` + `geosite.dat` в `xray-core/`.
Реальный native manifest создаётся как `com.browsvpn.host.local.json` и регистрируется в HKCU.

---

## Commands (native messaging)

| Command | Description |
|---------|-------------|
| `enable_vpn` | Parse VLESS, write config, start Xray |
| `disable_vpn` | Stop Xray, wipe config file |
| `get_status` | VPN + Xray state |
| `preflight` | Checks before enable |
| `health_check` | Runtime checks |
| `get_logs` | Redacted log tails |
| `find_free_port` | Pick SOCKS port |

Protocol: **4-byte LE length + JSON** (not line-delimited). See [../docs/API.md](../docs/API.md).

---

## Layout

```
proxy-service/
├── cmd/main.go              # Entry; --standalone stub (v3 tray)
├── internal/messaging/      # NM host, handler, auth
├── internal/xray/           # Process + integrity check
├── internal/singleinstance/ # Windows mutex
├── pkg/vless/               # VLESS → Xray JSON
├── com.browsvpn.host.json   # Template; install creates com.browsvpn.host.local.json
└── xray-core/               # xray.exe (external download)
```

---

## Tests

```powershell
go test ./...
```

---

## Related

- [NATIVE_MESSAGING_SETUP.md](./NATIVE_MESSAGING_SETUP.md)
- [../docs/TESTING.md](../docs/TESTING.md)
