# Brows VPN — Browser Extension with VLESS Integration

> **Статус:** v2 завершён (extension **v2.2.1**), hardening P0–P2 ✅  
> **Актуальный прогресс:** [CURRENT_STATUS.md](./CURRENT_STATUS.md)  
> **Безопасность:** [SECURITY.md](./SECURITY.md)  
> **План (v3 отложен):** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)

---

## Overview

Brows VPN — расширение Chromium (Windows) для выборочного или полного проксирования через **VLESS Reality + gRPC**. Локальный **Go native host** управляет **Xray-core**; маршрутизация в браузере — **PAC** (`chrome.proxy`).

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

Подробнее: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Quick Start

```powershell
cd proxy-service
.\install.ps1 -ExtensionId YOUR_ID -Build
```

Chrome → `chrome://extensions` → Load unpacked → `extension/` → Settings → VLESS → Enable VPN.

Полная инструкция: [QUICK_START.md](./QUICK_START.md)

---

## Project Structure

```
Brows_vpn/
├── docs/                 # Документация (CURRENT_STATUS — source of truth)
├── extension/            # ← Загружается в Chrome (manifest v2.2.1)
├── proxy-service/        # Go native host + Xray
└── scripts/              # PAC / import tests, integration
```

Legacy Censor Tracker код: `extension/src/` — **не используется** в текущей сборке.

---

## Testing

```powershell
cd proxy-service
go test ./...

cd ..
node scripts/test-pac-whitelist.js
node scripts/test-settings-import-export.js
```

См. [TESTING.md](./TESTING.md)

---

## Documentation Index

| Документ | Назначение |
|----------|------------|
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | Прогресс по версиям |
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | Этапы v1/v2/v3 |
| [SECURITY.md](./SECURITY.md) | Модель угроз, P0–P2 |
| [API.md](./API.md) | Native messaging протокол |
| [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) | Решения по функциям |
