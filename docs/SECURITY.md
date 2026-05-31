# Brows VPN — Security

> **Extension:** v3.0.0 · **Обновлено:** 2026-05-24

Документ описывает модель угроз, реализованные меры (P0–P2) и рекомендации по эксплуатации. Tray и multi-protocol в scope v3.0.0 не входят.

---

## Модель доверия

| Компонент | Доверие |
|-----------|---------|
| Chrome extension (ваш ID в `allowed_origins`) | Полный контроль над Go host |
| Локальные процессы на ПК | Могут использовать SOCKS `127.0.0.1:10808` (noauth) |
| VLESS credentials | Хранятся в `chrome.storage.local` и временно в `xray-config.json` |
| Сторонние сервисы | `api.ipify.org` при проверке IP в popup |

---

## Реализованные меры

### P0 — критичное

| Мера | Где |
|------|-----|
| Валидация `updateSettings` в background (зеркало UI) | `validators.applySettingsUpdate`, `background.js` |
| Строгий integer для SOCKS-порта в PAC | `validateSocksPort`, `sanitizeSocksPort` |
| Single-instance native host (Windows mutex) | `internal/singleinstance` |
| Xray config `0600`, wipe on disable | `xray/controller.go`, `handler.handleDisableVPN` |
| Redacted diagnostics (без PAC/VLESS) | `background.getDiagnostics`, `messaging/redact.go` |
| Xray access log отключён по умолчанию | `pkg/vless.ToXrayConfig` |
| NM origin deny-by-default (manifest load/parse/empty origins) | `origin.go`, `native-manifest.ps1` |

### P1 — hardening

| Мера | Где |
|------|-----|
| NM security (Chrome standard) | `allowed_origins` + fail-closed origin gate | `origin.go`, `install.ps1`, `native-manifest.ps1` |
| Xray integrity (`.sha256` optional for dev, required for release) | `xray/integrity.go`, `install.ps1 -Release` |
| Удалён неиспользуемый `activeTab` | `manifest.json` |
| Логи: debug-only для info/request; redact URLs | `DiagnosticLog` |
| Export: safe download по умолчанию; VLESS export явно подписан и требует confirm | `options.html/js` |
| Explicit CSP | `manifest.json` |
| `sender.id` check на privileged messages | `background.js` |

### P2 — качество и privacy

| Мера | Где |
|------|-----|
| CI: `go test`, PAC/import/assets scripts | `.github/workflows/test.yml` |
| `go.sum` в репозитории | `.gitignore` |
| WebRTC `disable_non_proxied_udp` при VPN ON | `background.js` + `privacy` permission |
| PAC для incognito (если разрешено) | `setProxy` / `clearProxy` |
| Node-тесты hardening | `scripts/test-settings-import-export.js` |

---

## Native Messaging (как у типичных расширений)

По [документации Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging):

1. **Chrome** проверяет, что Extension ID есть в `allowed_origins` manifest host.
2. **Go host** получает origin вызывающего расширения первым аргументом CLI (`chrome-extension://…/`) и сверяет с manifest.
3. **Deny-by-default:** если manifest не загружен, JSON битый или `allowed_origins` пуст — chrome caller отклоняется (`Access denied for extension origin`).
4. **Manifest UTF-8 без BOM** — tracked template `com.browsvpn.host.json`, локальный `com.browsvpn.host.local.json` создаёт `install.ps1`.
5. **Стабильный GitHub Extension ID** — `manifest.key` + `EXTENSION_ID.txt`; private PEM в `secrets/` (gitignored).
6. **Установка одной командой** — `proxy-service\install.bat`.

```powershell
cd proxy-service
.\install.bat
```

Override только для debug: `.\install.ps1 -ExtensionId <id> -Build`

ID расширения автоматически показывается в **мастере настройки** (`chrome.runtime.id`).

---

## Manifest permissions

| Permission | Зачем нужен | Статус |
|------------|-------------|--------|
| `proxy` | Установка PAC через `chrome.proxy.settings` | required |
| `nativeMessaging` | Связь с Go host | required |
| `storage` | Настройки, профили, diagnostics | required |
| `tabs` | Определить текущий сайт для popup/context actions | required пока нет `activeTab` flow |
| `alarms` | Health monitor / auto-recovery | required |
| `contextMenus` | Добавить/исключить текущий домен | required |
| `privacy` | WebRTC `disable_non_proxied_udp` при VPN ON | required для leak protection |
| `webRequest` + `http://*/*`, `https://*/*` | Debug request tracing | optional permission, запрашивается только при включении подробных логов |

Обычная установка не запрашивает доступ ко всем URL. При включении "Подробных логов" Chrome отдельно попросит разрешение на трассировку HTTP/HTTPS-запросов.

---

## Xray integrity (опционально)

```powershell
cd proxy-service
certutil -hashfile xray-core\xray.exe SHA256
# Запишите hex в xray-core\xray.exe.sha256 (одна строка)
.\install.ps1 -Release -Build
```

Без sidecar-файла проверка пропускается только в dev-установке. В `-Release` режиме отсутствие `xray.exe.sha256` — ошибка.

---
