# Brows VPN — Browser Extension with VLESS Integration

> **Статус:** v2 завершён (extension **v2.2.1**), hardening P0–P2 ✅  
> **Безопасность:** [SECURITY.md](docs/SECURITY.md)

---

## Overview

Brows VPN — расширение Chromium (Windows) для выборочного или полного проксирования через **VLESS Reality + gRPC**. Локальный **Go native host** управляет **Xray-core**; маршрутизация в браузере — **PAC** (`chrome.proxy`).

**Extension ID (GitHub/unpacked):** `faiiagkkabmhbiafomcbopfgeddmobdl` — стабилен благодаря `manifest.key` (см. `extension/EXTENSION_ID.txt`).

---

## Скачать

| Способ | Ссылка |
|--------|--------|
| Clean archive | [Brows_vpn-v2.2.1-clean.zip](https://github.com/Stemnitskiy/Brows_vpn/releases/download/v2.2.1/Brows_vpn-v2.2.1-clean.zip) |
| Все релизы | [Releases](https://github.com/Stemnitskiy/Brows_vpn/releases) |

---

## Key Features (реализовано)

| Функция | Статус |
|---------|--------|
| Selective / global / global_exclude / disabled | ✅ |
| VLESS профили, import/export | ✅ |
| Native Messaging ↔ Go ↔ Xray | ✅ |
| Preflight, health, recovery (3× → disable) | ✅ |
| Smart routing, context menu, onboarding | ✅ |
| Dark theme, diagnostics page | ✅ |
| Security hardening P0–P2 | ✅ v2.2.1 |

**Не в scope (v3):** system tray, multi-protocol, Firefox/Edge.

---

## Architecture

```
Browser Extension (MV3)  ←── Native Messaging ──→  Go Proxy Service
        │                                              │
   chrome.proxy (PAC)                            Xray-core (VLESS)
        │                                              │
   SOCKS5 127.0.0.1:10808  ←──────────────────────────┘
```

Подробнее: [ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Quick Start

### 1. Xray-core

1. Скачайте [Xray-windows-64.zip](https://github.com/XTLS/Xray-core/releases)
2. Положите `xray.exe` в `proxy-service\xray-core\`
3. Рядом должны быть `geoip.dat` и `geosite.dat` (уже в репозитории)

### 2. Go-сервис и Native Messaging

```powershell
cd proxy-service
.\install.bat
```

Скрипт собирает `browsvpn-proxy.exe`, регистрирует native host с Extension ID из `manifest.key` и открывает `chrome://extensions/`. После установки **перезапустите Chrome**.

**Debug override** (если unpacked ID другой): `.\install.ps1 -ExtensionId <chrome.runtime.id> -Build`

### 3. Расширение Chrome

1. `chrome://extensions/` → **Режим разработчика**
2. **Load unpacked** → папка **`extension/`** (не корень репозитория)
3. Проверка: Settings → **Диагностика** → Native host: **Подключён**

### 4. VLESS и включение VPN

1. Settings (или мастер первого запуска) → вставьте **VLESS URL** → сохраните
2. Добавьте домены в whitelist (режим *Selective*)
3. Popup → **Enable VPN**

Полная инструкция: [QUICK_START.md](docs/QUICK_START.md) · [FINAL_INSTRUCTIONS.md](docs/FINAL_INSTRUCTIONS.md)

---

## Project Structure

```
Brows_vpn/
├── docs/                 # Документация
├── extension/            # ← Load unpacked в Chrome (manifest v2.2.1)
├── proxy-service/        # Go native host + install.bat + xray-core/
└── scripts/              # PAC / import tests, extension identity
```

Legacy Censor Tracker код: `extension/src/` — **не используется** в текущей сборке.

---

## Testing

```powershell
cd proxy-service
go test ./...

cd ..
node scripts/extension-identity.js verify
node scripts/validate-extension-assets.js
node scripts/test-pac-whitelist.js
node scripts/test-settings-import-export.js
```

См. [TESTING.md](docs/TESTING.md)

---

## Troubleshooting

| Симптом | Решение |
|---------|---------|
| «Файл манифеста отсутствует» | Load unpacked → **`extension/`**, не корень проекта |
| Native host not found | `proxy-service\install.bat`, перезапуск Chrome |
| Access forbidden | ID не совпадает → `install.ps1 -ExtensionId <id> -Build` |
| xray.exe не найден | Скачайте Xray-core в `proxy-service\xray-core\` |

---

## Documentation Index

| Документ | Назначение |
|----------|------------|
| [CURRENT_STATUS.md](docs/CURRENT_STATUS.md) | Прогресс по версиям |
| [QUICK_START.md](docs/QUICK_START.md) | Подробный старт |
| [SECURITY.md](docs/SECURITY.md) | Модель угроз, P0–P2 |
| [API.md](docs/API.md) | Native messaging протокол |
| [TESTING.md](docs/TESTING.md) | Ручное и автоматическое тестирование |

---

## License

Third-party: [Xray-core](https://github.com/XTLS/Xray-core) (MPL-2.0). См. `proxy-service/xray-core/LICENSE`.
