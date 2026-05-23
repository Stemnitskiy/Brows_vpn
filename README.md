# Brows VPN

**Brows VPN** — расширение для Chromium (Windows) с локальным Go-сервисом и **Xray-core**. Проксирует трафик браузера через **VLESS Reality + gRPC**: выборочно (whitelist), глобально или с исключениями.

**Версия:** 2.2.1 · **Платформа:** Windows 11 · **Браузер:** Chrome / Edge / Brave

---

## Скачать

| Способ | Ссылка |
|--------|--------|
| **Clean archive (рекомендуется)** | [Brows_vpn-v2.2.1-clean.zip](https://github.com/Stemnitskiy/Brows_vpn/releases/download/v2.2.1/Brows_vpn-v2.2.1-clean.zip) |
| Все релизы | [Releases](https://github.com/Stemnitskiy/Brows_vpn/releases) |

Архив содержит исходники без `*.exe`, secrets и локальных путей. После распаковки см. `ARCHIVE_README.txt`.

---

## Быстрый старт

### 1. Xray-core

1. Скачайте [Xray-windows-64.zip](https://github.com/XTLS/Xray-core/releases)
2. Положите `xray.exe` в `proxy-service\xray-core\`

### 2. Native host (Go-сервис)

```powershell
cd proxy-service
.\install.bat
```

Скрипт собирает `browsvpn-proxy.exe`, регистрирует Native Messaging host и открывает `chrome://extensions/`.

### 3. Расширение Chrome

1. `chrome://extensions/` → **Режим разработчика**
2. **Load unpacked** → папка **`extension`** (не корень репозитория)
3. Перезапустите Chrome

**Extension ID** для GitHub/unpacked стабилен: `faiiagkkabmhbiafomcbopfgeddmobdl` (см. `extension/EXTENSION_ID.txt`, `manifest.key`).

### 4. Настройка и включение

1. Иконка расширения → **Settings** (или мастер первого запуска)
2. Вставьте **VLESS URL** → сохраните
3. Добавьте домены в whitelist (режим *Selective*)
4. Popup → **Enable VPN**

---

## Возможности

| Функция | Описание |
|---------|----------|
| Selective / Global / Global exclude | PAC-маршрутизация через `chrome.proxy` |
| VLESS профили | Несколько конфигов, import/export |
| Native Messaging | Chrome ↔ Go ↔ Xray, без ручного запуска exe |
| Preflight & health | Проверки перед включением, auto-reconnect |
| Smart routing | Правила маршрутизации с приоритетом |
| Onboarding wizard | Пошаговая первичная настройка |
| Diagnostics | ID расширения, native host, логи |

---

## Архитектура

```
Browser Extension (MV3)  ←── Native Messaging ──→  Go Proxy Service
        │                                              │
   chrome.proxy (PAC)                            Xray-core (VLESS)
        │                                              │
   SOCKS5 127.0.0.1:10808  ←──────────────────────────┘
```

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Структура проекта

```
Brows_vpn/
├── extension/          ← Load unpacked в Chrome
├── proxy-service/      ← Go native host + install.bat
│   └── xray-core/      ← xray.exe (скачать отдельно)
├── docs/               ← документация
└── scripts/            ← тесты и утилиты
```

---

## Разработка

### Требования

- Windows 11
- Go 1.21+
- Chromium (последний stable)
- Node.js — только для скриптов тестов (`scripts/`)

### Тесты

```powershell
cd proxy-service
go test ./...

cd ..
node scripts/extension-identity.js verify
node scripts/validate-extension-assets.js
node scripts/test-pac-whitelist.js
node scripts/test-settings-import-export.js
```

### Clean archive (для релиза)

```powershell
.\make-clean-archive.bat
```

Результат: `dist\Brows_vpn-<branch>-<hash>-clean.zip`

---

## Troubleshooting

| Симптом | Решение |
|---------|---------|
| «Файл манифеста отсутствует» | Load unpacked → папка **`extension/`**, не корень проекта |
| Native host not found | `proxy-service\install.bat`, перезапуск Chrome |
| Access forbidden | ID не совпадает → Settings → Диагностика → `install.ps1 -ExtensionId <id> -Build` |
| xray.exe не найден | Скачайте Xray-core в `proxy-service\xray-core\` |
| VPN enabled, IP не меняется | Проверьте whitelist и SOCKS-порт (по умолчанию **10808**) |

Полнее: [docs/TESTING.md](docs/TESTING.md) · [docs/SECURITY.md](docs/SECURITY.md)

---

## Документация

| Документ | Описание |
|----------|----------|
| [docs/QUICK_START.md](docs/QUICK_START.md) | Подробный старт для разработчика |
| [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md) | Текущий статус и версии |
| [docs/SECURITY.md](docs/SECURITY.md) | Модель безопасности Native Messaging |
| [docs/API.md](docs/API.md) | Протокол extension ↔ Go |
| [docs/FINAL_INSTRUCTIONS.md](docs/FINAL_INSTRUCTIONS.md) | Полная инструкция установки |

---

## Безопасность

- VLESS credentials хранятся локально в `chrome.storage` — **не коммитьте** реальные URL в git
- Private key расширения (`secrets/*.pem`) — в `.gitignore`, не входит в clean archive
- Go host проверяет `allowed_origins` (fail-closed)

---

## License

Компоненты third-party: [Xray-core](https://github.com/XTLS/Xray-core) (MPL-2.0). См. `proxy-service/xray-core/LICENSE`.
