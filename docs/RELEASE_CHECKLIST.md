# Brows VPN — Release Checklist

Перед публикацией на GitHub проходить на clean clone или свежей копии репозитория.

## 1. Репозиторий

```powershell
git status --short
git ls-files *.pem secrets/*.pem
git archive HEAD | tar -t | rg "\.pem$|xray-config|access\.log|error\.log|\.exe$"
powershell -File .\scripts\make-clean-archive.ps1 -Mode git
```

Ожидаемо: PEM, runtime config, логи, cleanup-скрипты и `.exe` не попадают в tracked files / clean archive.

## 2. Автопроверки

Быстрый единый gate:

```powershell
powershell -File .\scripts\release-gate.ps1
```

Если локальная установка сломана:

```powershell
powershell -File .\scripts\check-env.ps1 -Fix -Release
```

То же с live-проверкой Xray/SOCKS:

```powershell
powershell -File .\scripts\release-gate.ps1 -Live
```

Состав gate по шагам:

```powershell
cd proxy-service
go test ./...
go vet ./...
go run ..\scripts\test-local-integration.go

cd ..
node --check extension\background.js
node --check extension\options.js
node --check extension\onboarding.js
node scripts\validate-extension-assets.js
node scripts\extension-identity.js verify
node scripts\test-pac-whitelist.js
node scripts\test-settings-import-export.js

cd extension
npm audit --omit=dev --audit-level=moderate
```

Ожидаемо: все команды завершаются без ошибок.

Опционально перед финальным релизом:

```powershell
cd proxy-service
go run ..\scripts\test-local-integration.go -live
```

Ожидаемо: Xray стартует, SOCKS-порт слушает, `disable_vpn` останавливает процесс.

## 3. Xray SHA256

```powershell
cd ..\proxy-service
Get-FileHash .\xray-core\xray.exe -Algorithm SHA256
Set-Content -Encoding ASCII .\xray-core\xray.exe.sha256 "<SHA256_FROM_PREVIOUS_COMMAND>"
.\install.ps1 -Release -Build
```

Ожидаемо: `-Release` не проходит без `xray.exe.sha256` и не проходит при mismatch.

## 4. Локальная установка

```powershell
cd proxy-service
.\install.ps1 -Build -OpenExtensionsPage
powershell -File ..\scripts\check-env.ps1 -Release
```

Ожидаемо: создан `com.browsvpn.host.local.json`, HKCU registry указывает на него, `allowed_origins` содержит текущий Chrome extension ID.

## 5. Chrome smoke

- Загрузить `extension/` через `chrome://extensions/` → Load unpacked.
- Открыть onboarding и пройти preflight.
- Проверить, что onboarding показывает статусы Extension ID / Native host / Xray / VLESS, копируемую repair-команду и кнопки действий: Xray releases, install command, переход к VLESS/settings.
- Добавить валидный `vless://` профиль.
- Проверить режимы `selective`, `global`, `global_exclude`.
- Проверить `Add current site`.
- Проверить disable: proxy очищается, Xray останавливается.
- Проверить diagnostics: нет полного VLESS URL, полного PAC и Xray `access.log`.
- Включить "Подробные логи": Chrome должен отдельно запросить доступ к HTTP/HTTPS URL.

## 6. Остаточные риски

- VLESS хранится в `chrome.storage.local`; экспорт с секретами использовать только явно.
- `privacy` permission нужен для WebRTC leak protection.
- `tabs` нужен для current site workflows.
- `webRequest` и HTTP/HTTPS host access должны оставаться optional.
