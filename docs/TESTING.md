# Brows VPN — Тестирование

> **Обновлено:** 2026-05-22  
> **SOCKS порт по умолчанию:** `10808` (порт `1080` заблокирован Windows в диапазоне 1068–1167)

---

## Часть A — Автоматические тесты (выполняет разработчик / CI)

```powershell
cd D:\Projects\Brows_vpn\proxy-service
go test ./...
go build -o browsvpn-proxy.exe ./cmd
go run ..\scripts\test-local-integration.go
powershell -File ..\scripts\check-env.ps1
```

### Что проверяют автотесты

| Тест | Проверка |
|------|----------|
| `go test ./...` | VLESS parser, native messaging protocol, VPN handler |
| `test-local-integration.go` | Subprocess NM: get_status → enable_vpn → порт 10808 → disable_vpn |
| `check-env.ps1` | Go, Node, exe, xray, manifest |
| Settings → **Run Full Preflight** | Extension + native checks без Enable |
| Health monitor (1 мин при VPN ON) | Xray, SOCKS, PAC, auto-reconnect |

### Preflight / runtime checks

| ID | Где | Что проверяет |
|----|-----|---------------|
| vless_local | Extension | Формат URL, Reality/gRPC |
| socks_port_local | Extension | Диапазон, Windows 1068–1167 |
| whitelist | Extension | Selective: список не пуст |
| vless_parse | Go | Parse + Validate VLESS |
| xray_binary | Go | xray.exe существует |
| socks_port_bind | Go | Порт bind / уже слушает |
| socks_listen | Go | SOCKS после старта |
| xray_process | Go | Процесс Xray жив |
| proxy-verify | Extension | PAC применён в Chrome |

---

## Как запускается Go-сервис

**Вручную запускать не нужно.** При нажатии **Enable VPN** Chrome сам стартует `browsvpn-proxy.exe` через Native Messaging.

Перед первым использованием **обязательно соберите exe**:

```powershell
cd D:\Projects\Brows_vpn\proxy-service
go build -o browsvpn-proxy.exe ./cmd
# или: build.bat
```

Файл должен существовать по пути из `com.browsvpn.host.json`. Без него Enable VPN молча не работает.

---

### B1. Подготовка (один раз)

**1.** Убедитесь, что автотесты прошли (см. Часть A).

**2.** Зарегистрируйте native host (если ещё не сделано):
```powershell
cd D:\Projects\Brows_vpn\proxy-service
.\setup_registry.bat
```

**3.** Загрузите расширение:
- Откройте `chrome://extensions/`
- Включите **Режим разработчика**
- **Загрузить распакованное расширение** → папка `D:\Projects\Brows_vpn\extension`

**4.** Скопируйте **Extension ID** (32 символа, например `abcdefghijklmnopqrstuvwxyzabcdef`)

**5.** Обновите `allowed_origins`:
```powershell
cd D:\Projects\Brows_vpn\proxy-service
powershell -File update_allowed_origins.ps1 -ExtensionId ВАШ_EXTENSION_ID
```

**6.** **Полностью закройте Chrome** (все окна) и откройте снова.

---

### B2. Настройка расширения

**7.** Правый клик по иконке Brows VPN → **Settings** (или `options.html`)

**8.** Вставьте ваш **VLESS URL** → **Save Configuration**

**9.** **Connection Settings:**
   - SOCKS Port: `10808` (не 1080!)
   - Save Settings

**10.** **Domain Management** (для Selective mode):
   - Добавьте домен, например: `ifconfig.me` или `google.com`
   - **Save Domain List**

**11.** Operation Mode: **Selective Mode** → **Save Mode**

---

### B3. Включение VPN

**12.** Откройте popup расширения → **Enable VPN**

**13.** Проверьте service worker (отладка):
   - `chrome://extensions/` → Brows VPN → **Service worker**
   - В Console не должно быть `Native messaging host not found`
   - Ожидается: `VPN enabled successfully`

**14.** Проверьте порт (PowerShell):
```powershell
netstat -an | findstr 10808
```
Ожидается: `TCP 127.0.0.1:10808 ... LISTENING`

---

### B4. Проверка маршрутизации

**15.** Selective mode — сайт **из whitelist**:
   - Откройте `https://ifconfig.me` (если в списке)
   - IP должен отличаться от вашего реального (IP VPN-сервера)

**16.** Selective mode — сайт **не из whitelist**:
   - Откройте сайт, которого нет в списке
   - Должен показываться ваш обычный IP

**17.** Global mode (опционально):
   - Settings → Global Mode → Save Mode
   - Enable VPN снова
   - Любой сайт → IP VPN-сервера

**18.** Disable:
   - Popup → **Disable VPN**
   - `netstat -an | findstr 10808` — порт не LISTENING

---

## Часть C — Устранение неполадок

| Симптом | Решение |
|---------|---------|
| `Native messaging host not found` | `setup_registry.bat`, перезапуск Chrome |
| `Access to extension denied` | `update_allowed_origins.ps1` с правильным ID |
| `Failed to start Xray` / port bind | Используйте порт **10808**, не 1080 |
| `invalid password` в логах | VLESS `pbk` должен быть валидный X25519 public key |
| VPN enabled, но сайты не проксируются | Проверьте PAC: домен в whitelist, SOCKS port = 10808 |

**Логи Go-сервиса:** `proxy-service/logs/app.log`

---

## Чеклист результатов

- [ ] `go test ./...` — PASS
- [ ] `test-local-integration.go` — PASS
- [ ] Extension загружен, ID в allowed_origins
- [ ] Enable VPN — без ошибок в console
- [ ] Порт 10808 LISTENING
- [ ] Selective routing работает
- [ ] Disable останавливает Xray
