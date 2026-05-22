# Brows VPN — Quick Start (для разработчика)

> **Обновлено:** 2026-05-22  
> **Статус:** v2.2.0 — рабочий MVP + hardening  
> **План:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) · [SECURITY.md](./SECURITY.md)

---

## Что это

Brows VPN — расширение Chromium + локальный Go-сервис + Xray-core для VLESS Reality VPN с выборочной маршрутизацией сайтов.

**Платформа:** Windows 11, Chromium (Chrome, Edge, Brave).

---

## Архитектура (кратко)

```
Extension (PAC) → SOCKS5 127.0.0.1:10808 → Xray → VLESS Server
       ↕ Native Messaging
   Go proxy-service
```

---

## Требования

| Компонент | Версия |
|-----------|--------|
| Windows | 11 |
| Go | 1.21+ |
| Chromium | последний stable |
| Xray-core | [releases](https://github.com/XTLS/Xray-core/releases) → `proxy-service/xray-core/xray.exe` |

Node.js нужен только если работаете с `extension/src/` (Censor Tracker reference) — **не обязателен** для текущей сборки.

---

## Структура (актуальная)

```
Brows_vpn/
├── extension/           ← Load unpacked в Chrome
│   ├── manifest.json
│   ├── background.js    ← активный service worker
│   ├── popup.* / options.*
│   └── src/             ← Censor Tracker (reference only)
├── proxy-service/
│   ├── cmd/main.go
│   ├── browsvpn-proxy.exe   ← после go build
│   └── xray-core/xray.exe   ← скачать вручную
└── docs/
```

---

## Сборка proxy-service

```powershell
cd D:\Projects\Brows_vpn\proxy-service
go mod tidy
go build -o browsvpn-proxy.exe ./cmd
```

---

## Загрузка extension

1. `chrome://extensions/`
2. Developer mode → ON
3. Load unpacked → `D:\Projects\Brows_vpn\extension`

---

## Native Messaging (текущее состояние)

> **⚠️ Не работает out-of-the-box.** Требуется Этап 1 из [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md).

Известные проблемы:
- `host.go` — неверный протокол (нужен length-prefixed)
- `setup_registry.bat` — неверный формат registry entry
- `main.go` — требует `--native-messaging`, Chrome args не передаёт

После исправления: registry → JSON manifest → `com.browsvpn.host.json`.

---

## VLESS конфигурация

Формат (пример с placeholder):

```
vless://UUID@HOST:PORT?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=PUBLIC_KEY&fp=chrome&sni=SNI&sid=SHORT_ID&spx=%2F#ProfileName
```

Сохраняется в extension options → `chrome.storage.local`.

**Не коммитьте реальные credentials в git.**

---

## Режимы

| Mode | PAC behaviour |
|------|---------------|
| selective | Whitelist → SOCKS5 |
| global | All → SOCKS5 |
| disabled | DIRECT |

---

## С чего начать разработку

1. Прочитать [CURRENT_STATUS.md](./CURRENT_STATUS.md)
2. Открыть [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) → **Этап 1**
3. Скачать `xray.exe`
4. Исправить native messaging → wire Xray → E2E test

---

## Документация

| Файл | Назначение |
|------|------------|
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | План по этапам |
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | Статус компонентов |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура |
| [API.md](./API.md) | Native messaging API |

---

## License

Персональный проект. Censor Tracker — MIT.
