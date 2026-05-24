# Native Messaging Host Setup

> Обновлено: 2026-05-24
> Статус: актуальный production flow.

---

## Установка

```powershell
cd proxy-service
.\install.bat
```

`install.bat` вызывает:

```powershell
.\install.ps1 -Build -OpenExtensionsPage
```

Скрипт:

- собирает `browsvpn-proxy.exe`;
- определяет Extension ID из `extension\manifest.json`;
- создаёт локальный `com.browsvpn.host.local.json`;
- пишет registry key в HKCU;
- открывает `chrome://extensions/`.

Для release-проверки:

```powershell
.\install.ps1 -Release -Build
```

`-Release` требует `xray-core\xray.exe.sha256`.

---

## Host Manifest

В репозитории хранится только шаблон:

```text
proxy-service\com.browsvpn.host.json
```

Рабочий локальный manifest создаётся установщиком:

```text
proxy-service\com.browsvpn.host.local.json
```

Пример сгенерированного файла:

```json
{
  "name": "com.browsvpn.host",
  "description": "Brows VPN Native Messaging Host",
  "path": "D:\\Projects\\Brows_vpn\\proxy-service\\browsvpn-proxy.exe",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://faiiagkkabmhbiafomcbopfgeddmobdl/"
  ]
}
```

---

## Windows Registry

```text
HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host
  (Default) = D:\Projects\Brows_vpn\proxy-service\com.browsvpn.host.local.json
```

Значение по умолчанию должно указывать на JSON manifest, не на exe.

---

## Security Gate

Chrome проверяет `allowed_origins`. Go host дополнительно читает локальный manifest и сверяет caller origin. Если local manifest отсутствует, битый или не содержит текущий Extension ID, команды отклоняются.

---

## Проверка

```powershell
powershell -File ..\scripts\check-env.ps1
```

Автоисправление безопасных локальных проблем:

```powershell
powershell -File ..\scripts\check-env.ps1 -Fix -Release
```

`-Fix` пересобирает/перерегистрирует native host только если локальный exe, manifest или registry неполные; также создаёт `xray.exe.sha256`, если `xray.exe` уже лежит на месте.

В Chrome:

1. `chrome://extensions/`
2. Load unpacked → `extension\`
3. Перезапустить Chrome
4. Settings → Diagnostics → Native host: connected

---

## Troubleshooting

| Ошибка | Причина | Исправление |
|--------|---------|-------------|
| Host not found | Registry или manifest path неверны | `.\install.ps1 -Build` |
| Access denied | `allowed_origins` не содержит Extension ID | `.\install.ps1 -ExtensionId <id> -Build` |
| Xray unavailable | Нет `xray-core\xray.exe` | Скачать Xray-core release |
| Release install fails | Нет/не совпадает `xray.exe.sha256` | Сгенерировать SHA256 sidecar |
