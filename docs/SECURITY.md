# Brows VPN — Security

> **Extension:** v2.2.1 · **Обновлено:** 2026-05-22

Документ описывает модель угроз, реализованные меры (P0–P2) и рекомендации по эксплуатации. **v3 (tray, multi-protocol) в scope не входит.**

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
| Redacted diagnostics (без PAC/access.log) | `background.getDiagnostics`, `messaging/redact.go` |
| NM origin deny-by-default (manifest load/parse/empty origins) | `origin.go`, `native-manifest.ps1` |

### P1 — hardening

| Мера | Где |
|------|-----|
| NM security (Chrome standard) | `allowed_origins` + fail-closed origin gate | `origin.go`, `install.ps1`, `native-manifest.ps1` |
| Xray integrity (optional `.sha256` sidecar) | `xray/integrity.go` |
| Удалён неиспользуемый `activeTab` | `manifest.json` |
| Логи: debug-only для info/request; redact URLs | `DiagnosticLog` |
| Export: download по умолчанию, clipboard с confirm, export без секретов | `options.html/js` |
| Explicit CSP | `manifest.json` |
| `sender.id` check на privileged messages | `background.js` |

### P2 — качество и privacy (не v3)

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
4. **Manifest UTF-8 без BOM** — `native-manifest.ps1`, `install.ps1`.
5. **Один установщик** — `install.ps1` (или `setup_registry.bat` как wrapper).

```powershell
cd proxy-service
.\install.ps1 -ExtensionId YOUR_ID -Build
```

ID расширения автоматически показывается в **мастере настройки** (`chrome.runtime.id`).

---

## Xray integrity (опционально)

```powershell
certutil -hashfile xray-core\xray.exe SHA256
# Запишите hex в xray-core\xray.exe.sha256 (одна строка)
```

Без sidecar-файла проверка пропускается (удобно для dev).

---

## Секреты — что не коммитить

- `proxy-service/xray-core/xray-config*.json` (в `.gitignore`)
- `%LOCALAPPDATA%\BrowsVPN\` (legacy, не используется)
- Export JSON с VLESS URL
- Локальные логи с access/error

---

## Известные остаточные риски

1. **Plaintext VLESS** в storage — шифрование OS profile вне scope.
2. **Registry/manifest hijacking** same-user malware — стандартная слабость NM; нет code signing.
3. **webRequest** — только для debug URL tracing; держите debug выключенным.
4. **ipify** — утечка факта проверки IP третьей стороне.

---

## Связанные документы

- [CURRENT_STATUS.md](./CURRENT_STATUS.md)
- [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) — этап v2.12
- [TESTING.md](./TESTING.md)
