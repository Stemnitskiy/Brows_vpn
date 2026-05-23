# Brows VPN — Инструкция по установке и запуску

> **Статус:** ✅ Актуально для extension **v2.2.1**  
> **Безопасность (NM token):** [SECURITY.md](./SECURITY.md)  
> **Краткий старт:** [QUICK_START.md](./QUICK_START.md)

## Предварительные требования

- Windows 11
- Chromium-браузер (Chrome, Edge, Brave)
- Go 1.21+ (только для сборки)
- VLESS-сервер (Reality + gRPC)
- Права на запись в реестр HKCU (для native messaging)

---

## Шаг 1: Xray-core

1. Скачайте [Xray-windows-64.zip](https://github.com/XTLS/Xray-core/releases)
2. Распакуйте `xray.exe` в:
   ```
   D:\Projects\Brows_vpn\proxy-service\xray-core\xray.exe
   ```

---

## Шаг 2–3: Установка native host

```powershell
cd D:\Projects\Brows_vpn\proxy-service
.\install.bat
```

1. Скачайте [Release zip](https://github.com/) и распакуйте *(или используйте git clone)*  
2. Положите `xray.exe` в `proxy-service\xray-core\`  
3. Запустите `proxy-service\install.bat`  
4. В открывшемся `chrome://extensions/` → **Load unpacked** → папка `extension`

Extension ID стабилен для GitHub/unpacked канала (`manifest.key` → `extension/EXTENSION_ID.txt`). Private PEM (`secrets/chrome-extension-github.pem`) **не коммитится** и не попадает в clean archive.

**Override (debug):** `.\install.ps1 -ExtensionId <chrome.runtime.id> -Build`

---

## Шаг 5: Настройка

1. Иконка расширения → Settings
2. VLESS Configuration URL — вставьте ваш `vless://...`
3. Save Configuration
4. Domain Management — добавьте домены для selective mode
5. Operation Mode — Selective / Global

---

## Шаг 6: Использование

1. Popup → **Enable VPN**
2. Chrome автоматически запустит native host (Go exe)
3. Xray поднимет SOCKS5 на `127.0.0.1:1080`
4. Проверьте сайт из whitelist

> **Не нужно** вручную запускать `browsvpn-proxy.exe --native-messaging` — Chrome запускает host сам (после исправления entry point).

---

## Disable

Popup → **Disable VPN** → proxy сброшен, Xray остановлен.

---

## Troubleshooting

### Native messaging host not found

- Проверьте registry path → JSON manifest
- Проверьте `path` в manifest → существующий exe
- Перезапустите Chrome

### Failed to connect

- Проверьте `allowed_origins` matches extension ID
- Логи: Chrome DevTools → extension service worker
- Go logs: `proxy-service/logs/app.log`

### Xray не стартует

- `xray.exe` на месте?
- VLESS URL валиден?
- stderr Xray в логах

### Proxy error / no connection

- `netstat -an | findstr 1080` — порт слушает?
- Firewall блокирует localhost?

---

## Удаление

```powershell
# Registry
proxy-service\uninstall_registry.bat

# Extension
chrome://extensions/ → Remove
```

---

## Связанные документы

- [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)
- [CURRENT_STATUS.md](./CURRENT_STATUS.md)
- [API.md](./API.md)
- [proxy-service/NATIVE_MESSAGING_SETUP.md](../proxy-service/NATIVE_MESSAGING_SETUP.md)
