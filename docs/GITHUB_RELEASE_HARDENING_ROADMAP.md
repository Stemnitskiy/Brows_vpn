# Brows VPN — GitHub Release Hardening Roadmap

> Created: 2026-05-24
> Scope: проверка безопасности, корректности заявленных функций, автоматизация установки и первый запуск перед публикацией на GitHub.

---

## Цель

Подготовить проект к публичной выкладке так, чтобы:

- в репозитории не было секретов, локальных путей, runtime-логов и лишних бинарников;
- основные функции расширения были проверяемы автоматическими тестами и ручным smoke-чеклистом;
- установка native host и первый запуск были максимально воспроизводимыми;
- остаточные риски были явно описаны в документации.

---

## P0 — блокеры перед публикацией

### 1. Репозиторий и секреты

**Проблема:** локальная папка `secrets/` игнорируется, но в рабочем дереве есть PEM. Это нормально локально, но нужно исключить случайную публикацию. Также `proxy-service/xray-core/xray` без `.exe` сейчас не покрывается `.gitignore`.

**Сделать:**

- Добавить в `.gitignore`:
  - `proxy-service/xray-core/xray`
  - `proxy-service/browsvpn-proxy.exe`
  - `proxy-service/browsvpn-proxy.exe~`
  - `proxy-service/logs/`
- Проверить, что в clean archive не попадают:
  - `secrets/**`
  - `dist/**`
  - `*.exe`
  - `proxy-service/xray-core/xray*`
  - `proxy-service/xray-core/access.log`
  - `proxy-service/xray-core/error.log`
  - `proxy-service/xray-core/xray-config*.json`
- Прогнать secret scan по clean copy.

**Проверка:**

```powershell
git status --short
git check-ignore -v secrets\chrome-extension-github.pem proxy-service\xray-core\xray proxy-service\xray-core\xray.exe
rg -n "(ghp_|github_pat_|sk-|BEGIN (RSA|OPENSSH|PRIVATE) KEY|vless://)" -S -g "!dist/**" -g "!proxy-service/xray-core/**" .
```

**Статус:** implemented in P0/P3: `.gitignore` covers local artifacts; `scripts/check-env.ps1 -Release` checks tracked PEM/runtime artifacts and scans tracked files for token/private-key/real VLESS patterns. `scripts/make-clean-archive.ps1` now verifies the final zip and removes cleanup scripts from both git/worktree archives.

**Готово, когда:** публичный архив/репозиторий не содержит приватного PEM, VLESS URL, runtime config, логов и локальных binaries.

### 2. Native manifest без локального пути в git

**Проблема:** `proxy-service/com.browsvpn.host.json` содержит абсолютный путь вида `D:\Projects\...`. Это рабочий локальный файл, но плохой кандидат для публичного репозитория.

**Сделать:**

- Оставить tracked `com.browsvpn.host.json` только как шаблон.
- Реальный `com.browsvpn.host.local.json` генерировать только `install.ps1`.
- Добавить `proxy-service/com.browsvpn.host.local.json` в `.gitignore`.
- В README/QUICK_START явно писать: manifest создаётся установщиком.

**Проверка:**

```powershell
cd proxy-service
.\install.ps1 -Build
powershell -File .\native-manifest.ps1
Get-Content .\com.browsvpn.host.local.json
```

**Статус:** implemented in P0 pass 1.

**Готово, когда:** fresh clone не содержит чужой абсолютный путь, а install script создаёт валидный local manifest.

### 3. Xray integrity сделать обязательной для release

**Проблема:** `VerifyBinaryIntegrity` пропускает проверку, если нет `xray.exe.sha256`. Для dev это удобно, для публичного релиза слабовато.

**Сделать:**

- Оставить optional режим для dev.
- Добавить release/preflight режим, где отсутствие `xray.exe.sha256` является ошибкой.
- В install/check-env добавить проверку hash sidecar.
- Документировать команду генерации SHA256.

**Проверка:**

```powershell
cd proxy-service
certutil -hashfile xray-core\xray.exe SHA256
go test ./internal/xray ./internal/health
```

**Статус:** implemented in P0 pass 1 as `install.ps1 -Release` / `check-env.ps1 -Release`.

**Готово, когда:** release-сборка не проходит с неподписанным/непроверенным `xray.exe`.

---

## P1 — безопасность и privacy

### 4. Отключить Xray access log по умолчанию

**Проблема:** `access.log` содержит посещаемые домены. Для VPN это чувствительные данные.

**Сделать:**

- В generated Xray config убрать `"access": "access.log"` или включать access log только в debug mode.
- Оставить `error.log` с редактированием чувствительных данных.
- В diagnostics явно писать, что access log disabled by default.

**Проверка:**

```powershell
cd proxy-service
go test ./pkg/vless ./internal/messaging
```

**Статус:** implemented in P1 pass 1.

**Готово, когда:** новые подключения не пишут посещаемые домены в `access.log` без явного debug.

### 5. Минимизировать permissions manifest

**Проблема:** `manifest.json` запрашивает мощные права: `tabs`, `webRequest`, `privacy`, `<all_urls>`, `proxy`, `nativeMessaging`.

**Сделать:**

- Подтвердить необходимость каждого permission.
- Проверить, можно ли заменить `tabs` на `activeTab` для части сценариев.
- Проверить, нужен ли `<all_urls>` постоянно или только для debug/webRequest.
- Если `webRequest` используется только для debug tracing, вынести в отдельный debug build или оставить с явным объяснением в SECURITY.md.

**Проверка:**

```powershell
node scripts\validate-extension-assets.js
node scripts\test-pac-whitelist.js
```

**Готово, когда:** для каждого permission есть причина в `SECURITY.md`; лишние права удалены.

**Статус:** implemented in P1 pass 2: `webRequest` and HTTP/HTTPS host access moved to optional permissions; debug request tracing asks for explicit permission from `options.html`.

### 6. Plaintext VLESS: улучшить UX предупреждения

**Проблема:** VLESS URL хранится в `chrome.storage.local`. Это ожидаемо, но пользователь должен понимать риск.

**Сделать:**

- В onboarding и settings добавить короткое предупреждение рядом с импортом/экспортом и профилями.
- Export с секретами оставить только через explicit checkbox + confirm.
- Добавить safe export как рекомендуемый путь.

**Проверка:** ручной smoke: settings → export safe, export with secrets, import.

**Статус:** implemented in P1 pass 3: safe export is the primary action, export with VLESS URL is explicitly labeled and requires confirmation.

**Готово, когда:** случайный export с VLESS невозможен без явного выбора.

---

## P2 — корректность заявленных функций

### 7. CI расширить до release-gate

**Сделать:**

- В GitHub Actions добавить:
  - `go test ./...`
  - `go vet ./...`
  - Node PAC/import/assets tests
  - `npm audit --omit=dev`
  - secret scan
  - проверку, что forbidden files не попали в git/archive
- Отдельно оставить `npm audit` full как warning для dev toolchain, пока не обновлены webpack/eslint/web-ext.

**Проверка:** PR не merge, если сломан runtime/security gate.

**Статус:** implemented in P2 pass 1/P3 pass 3: GitHub Actions now runs `go vet`, JSON manifest parse check, runtime `npm audit`, Windows `check-env.ps1 -Ci`, and clean archive verification via `scripts/make-clean-archive.ps1`.

**Готово, когда:** каждый push/PR проверяет минимальный набор безопасности.

### 8. Интеграционный тест native host

**Сделать:**

- Довести `scripts/test-local-integration.go` до стабильного smoke:
  - `get_status`
  - `find_free_port`
  - `preflight`
  - `health_check`
  - `disable_vpn`
- `enable_vpn` + проверка SOCKS держать в отдельном live-режиме, чтобы обычный smoke не зависел от внешнего сервера.

**Проверка:**

```powershell
go run scripts\test-local-integration.go
go run scripts\test-local-integration.go -live
```

**Статус:** implemented in P2 pass 2: default mode is safe subprocess smoke; `-live` performs actual enable/SOCKS/disable.

**Готово, когда:** локальный smoke выявляет поломки Native Messaging до ручной проверки в Chrome.

### 9. Ручной smoke-чеклист перед релизом

**Сделать:** добавить короткий `docs/RELEASE_CHECKLIST.md`.

Минимум:

- clean clone;
- install native host;
- load unpacked extension;
- onboarding opens;
- VLESS validation works;
- preflight catches missing xray / bad config / busy port;
- selective routing works;
- global routing works;
- global_exclude works;
- add current site works;
- disable clears proxy and stops Xray;
- diagnostics do not leak full VLESS/PAC/access log.

**Готово, когда:** чеклист проходится вручную перед GitHub release.

**Статус:** implemented in P2 pass 1.

---

## P3 — автоматизация установки и первого запуска

### 10. One-command install

**Сделать:**

- Сделать `install.bat` тонкой оболочкой над `install.ps1 -Build -OpenExtensionsPage`.
- В `install.ps1` добавить проверки:
  - Go установлен;
  - Node нужен только для Extension ID resolve;
  - `xray.exe` найден или вывести прямую инструкцию скачивания;
  - manifest записан UTF-8 без BOM;
  - registry key записан;
  - Extension ID совпадает с `EXTENSION_ID.txt`.
- В конце печатать короткий next step:
  - открыть `chrome://extensions/`;
  - load unpacked `extension/`;
  - restart Chrome;
  - открыть onboarding/settings.

**Проверка:**

```powershell
cd proxy-service
.\install.bat
.\install.ps1 -Build -OpenExtensionsPage
```

**Статус:** mostly implemented in P3 pass 1: `install.bat` wraps `install.ps1 -Build -OpenExtensionsPage`; installer checks Node/Go before use and prints concrete next steps. Remaining: richer auto-fix mode.

**Готово, когда:** свежий пользователь может установить host без ручной правки JSON/registry.

### 11. Проверка окружения как отдельная команда

**Сделать:**

- Довести `scripts/check-env.ps1` до единой диагностики:
  - Go/Node versions;
  - extension ID;
  - manifest path;
  - registry key;
  - xray.exe + sha256;
  - ignored secret/runtime files;
  - port availability.
- Добавить `--fix` только для безопасных действий: создать manifest, пересобрать exe, открыть Chrome extensions page.

**Проверка:**

```powershell
powershell -File scripts\check-env.ps1
powershell -File scripts\release-gate.ps1
```

**Статус:** implemented in P3 pass 6: `check-env.ps1 -Release` is a detailed environment/security diagnostic including port availability; `check-env.ps1 -Fix -Release` applies safe local fixes; `release-gate.ps1` runs the full local release gate with optional `-Live`.

**Готово, когда:** пользователь получает конкретный список OK/FAIL и команды исправления.

### 12. Onboarding улучшить как recovery UI

**Сделать:**

- В onboarding показать 4 статуса:
  - Extension ID;
  - Native host registered;
  - Xray binary present;
  - Preflight OK.
- Для каждой ошибки показывать одну команду исправления.
- Добавить кнопку “Copy install command”.
- После успешного preflight предлагать открыть popup/options.

**Проверка:** удалить/сломать manifest, xray.exe, port config и убедиться, что onboarding показывает правильный repair path.

**Статус:** implemented in P3 pass 7: onboarding preflight now shows separate Extension ID / Native host / Xray / VLESS statuses, a copyable repair command, Xray releases/install action buttons, and navigation to VLESS/settings after successful checks.

**Готово, когда:** первый запуск ведёт пользователя от ошибки к исправлению без чтения README.

---

## P4 — улучшения после GitHub release

- Code signing для `browsvpn-proxy.exe`.
- Автоматический downloader Xray-core с проверкой SHA256 из trusted release metadata.
- Tray UI и локальный статус-сервис, если это всё ещё нужно.
- Multi-protocol import: VLESS first, VMess/Trojan later.
- Optional OS credential storage для VLESS, если UX и модель угроз оправдают усложнение.
- Firefox/Edge packaging как отдельные каналы, не смешивать с текущим Chrome release.

---

## Текущий baseline проверок

На 2026-05-24 выполнено:

```powershell
cd proxy-service
go test ./...
go vet ./...

cd ..
node scripts\validate-extension-assets.js
node scripts\extension-identity.js verify
node scripts\test-pac-whitelist.js
node scripts\test-settings-import-export.js

cd extension
npm audit --omit=dev
```

Результат:

- Go tests: pass.
- Go vet: pass.
- Extension asset validation: pass.
- Extension identity: pass.
- PAC tests: pass.
- Import/export tests: pass.
- Runtime npm audit: 0 vulnerabilities.
- Full npm audit: есть dev/release toolchain vulnerabilities, обновлять отдельно.

Не выполнено:

- `govulncheck`: не установлен.
- `go test -race`: требует `CGO_ENABLED=1`.
- `npm run lint:root`: локально не найден `eslint`.

---

## Definition of Done перед GitHub

- [ ] Clean archive собирается без секретов, логов, runtime config и binaries.
- [ ] Native manifest больше не содержит локальный путь в tracked файле.
- [ ] Release install script работает на clean clone.
- [ ] Xray release binary проверяется SHA256.
- [ ] Access log отключён по умолчанию.
- [ ] Permissions пересмотрены и описаны.
- [ ] CI release-gate зелёный.
- [ ] Manual release checklist пройден.
- [ ] README содержит только актуальный путь установки.
- [ ] SECURITY.md описывает остаточные риски честно и коротко.
