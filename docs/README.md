# Brows VPN — Browser Extension with VLESS Integration

> **Статус:** ~40% MVP — интеграция Extension ↔ Go ↔ Xray **не завершена**  
> **План работ:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)  
> **Текущее состояние:** [CURRENT_STATUS.md](./CURRENT_STATUS.md)

---

## Overview

Brows VPN — браузерное расширение для Chromium на Windows 11 с выборочным проксированием сайтов через VLESS (Reality + gRPC). Локальный Go-сервис управляет Xray-core; расширение маршрутизирует трафик через PAC-скрипты.

**Назначение:** личное использование на Windows 11.

---

## Key Features (целевые)

| Функция | Статус |
|---------|--------|
| Selective site proxying (whitelist) | 🟡 PAC есть, E2E не проверен |
| Global VPN mode | 🟡 PAC есть |
| VLESS Reality + gRPC | 🔴 Parser есть, Xray не запускается |
| Native Messaging (extension ↔ Go) | 🔴 Протокол/registry неверны |
| System tray | 🔴 Код есть, отключён |
| Auto-reconnect | 🟡 Только в extension (proxy error) |
| Import/Export | 🔴 Не реализовано |
| Logging | 🟡 Go logger есть, UI viewer нет |

---

## Architecture

```
Browser Extension (MV3)  ←── Native Messaging ──→  Go Proxy Service
        │                                              │
   chrome.proxy (PAC)                            Xray-core (VLESS)
        │                                              │
   SOCKS5 127.0.0.1:1080  ←──────────────────────────┘
        │
   VPN Server (Reality)
```

Подробнее: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Technology Stack (фактический)

### Browser Extension (активный код в корне `extension/`)

- JavaScript (ES6+), **без React** в текущей сборке
- Manifest V3
- Chrome APIs: `proxy`, `storage`, `runtime` (nativeMessaging)

### Local Proxy Service

- Go 1.21+
- Xray-core (внешний процесс, binary не в repo)
- getlantern/systray, logrus, lumberjack

### Reference (не используется в сборке)

- Censor Tracker codebase в `extension/src/` (webpack, React presets)

---

## Project Structure

```
Brows_vpn/
├── docs/
│   ├── IMPLEMENTATION_ROADMAP.md   ← основной план
│   ├── CURRENT_STATUS.md
│   ├── ROADMAP.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── ...
├── extension/                      ← загружается в Chrome
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html / popup.js
│   ├── options.html / options.js
│   └── src/                        ← Censor Tracker (reference)
├── proxy-service/
│   ├── cmd/main.go
│   ├── internal/
│   ├── pkg/vless/
│   └── xray-core/                  ← xray.exe — скачать вручную
└── scripts/                        ← (планируется)
```

---

## VLESS Configuration

Формат URL:

```
vless://uuid@address:port?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=...&fp=chrome&sni=...&sid=...&spx=%2F#name
```

Конфигурация хранится локально в `chrome.storage` (шифрование — в планах, этап 5).

---

## Modes of Operation

| Mode | Поведение |
|------|-----------|
| **Selective** | Whitelist → SOCKS5; остальное → DIRECT |
| **Global** | Весь трафик → SOCKS5 |
| **Disabled** | DIRECT, Xray stopped |

---

## Development

### Prerequisites

- Windows 11
- Go 1.21+
- Chromium browser
- Xray-core binary → `proxy-service/xray-core/xray.exe`

### Quick commands

```powershell
# Build proxy service
cd proxy-service
go build -o browsvpn-proxy.exe ./cmd

# Load extension
# chrome://extensions → Developer mode → Load unpacked → extension/
```

Полнее: [QUICK_START.md](./QUICK_START.md)

---

## Open Source Foundation

Основан на [Censor Tracker](https://github.com/censortracker) (MIT). Proxy-сервис переписан с C++/Qt на Go.

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | План реализации по этапам |
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | Актуальный статус кода |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Техническая архитектура |
| [API.md](./API.md) | Native messaging protocol |
| [QUICK_START.md](./QUICK_START.md) | Быстрый старт для разработчика |
| [FINAL_INSTRUCTIONS.md](./FINAL_INSTRUCTIONS.md) | Инструкция пользователя (после MVP) |

---

## License

Персональный проект. Основан на Censor Tracker (MIT License).
