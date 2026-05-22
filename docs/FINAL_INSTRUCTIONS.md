# Brows VPN — Инструкция по установке и запуску

> **Статус:** ⚠️ **Черновик — применять после завершения MVP (Этапы 1–2)**  
> **План:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)  
> **Текущие блокеры:** Native Messaging и запуск Xray не работают — см. [CURRENT_STATUS.md](./CURRENT_STATUS.md)

---

## Когда использовать этот документ

Эта инструкция станет актуальной после выполнения **Этапа 1–2** плана реализации. До этого следуйте [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) для разработки.

---

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

## Шаг 2: Сборка Go-сервиса

```powershell
cd D:\Projects\Brows_vpn\proxy-service
go build -o browsvpn-proxy.exe ./cmd
```

---

## Шаг 3: Native Messaging Host

> **После Этапа 1:** будет использоваться JSON manifest `com.browsvpn.host.json`, а не прямой путь к exe.

1. Запустите `setup_registry.bat` от имени администратора
2. Убедитесь, что в реестре:
   ```
   HKCU\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host
   ```
   указывает на **JSON manifest** (не на exe напрямую)
3. В manifest указан `allowed_origins` с ID вашего расширения

---

## Шаг 4: Загрузка расширения

1. `chrome://extensions/` → Developer mode
2. Load unpacked → `D:\Projects\Brows_vpn\extension`
3. Скопируйте Extension ID → обновите `allowed_origins` в host manifest

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
