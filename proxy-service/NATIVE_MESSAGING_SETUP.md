# Native Messaging Host Setup

> **Обновлено:** 2026-05-22  
> **Статус:** ⚠️ Текущая конфигурация **не работает** с Chrome. Исправление — Этап 1 [IMPLEMENTATION_ROADMAP.md](../docs/IMPLEMENTATION_ROADMAP.md).

---

## Как должно быть (целевая конфигурация)

### 1. Host manifest JSON

Файл `com.browsvpn.host.json` (будет создан на Этапе 1):

```json
{
  "name": "com.browsvpn.host",
  "description": "Brows VPN Native Messaging Host",
  "path": "D:\\Projects\\Brows_vpn\\proxy-service\\browsvpn-proxy.exe",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID/"
  ]
}
```

### 2. Windows Registry

```
HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host
  (Default) = D:\Projects\Brows_vpn\proxy-service\com.browsvpn.host.json
```

**Важно:** значение по умолчанию — путь к **JSON-файлу**, не к exe.

### 3. Протокол

Chrome использует **length-prefixed** сообщения:
- 4 байта (uint32 little-endian) — длина JSON
- JSON UTF-8

Текущий `host.go` читает построчный JSON — **несовместимо**.

### 4. Entry point

Chrome запускает exe **без аргументов**. `main.go` должен по умолчанию входить в native messaging mode.

---

## Текущее состояние (legacy — не использовать)

`setup_registry.bat` записывает путь к `browsvpn-proxy.exe` напрямую — **неверно**.

Ручной запуск `browsvpn-proxy.exe --native-messaging` — временный workaround для отладки, не production flow.

---

## Сборка

```powershell
cd D:\Projects\Brows_vpn\proxy-service
go build -o browsvpn-proxy.exe ./cmd
```

---

## Получение Extension ID

1. Load unpacked extension в `chrome://extensions/`
2. Скопируйте ID (например `abcdefghijklmnopqrstuvwxyzabcdef`)
3. Добавьте в `allowed_origins`: `chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/`

---

## Проверка (после Этапа 1)

1. Service worker extension → Console
2. `chrome.runtime.connectNative('com.browsvpn.host')` — без ошибки
3. `get_status` command → JSON response

---

## Удаление

```powershell
proxy-service\uninstall_registry.bat
```

---

## Troubleshooting

| Ошибка | Причина |
|--------|---------|
| Host not found | Registry или manifest path неверны |
| Access denied | `allowed_origins` не содержит extension ID |
| Disconnect immediately | Неверный протокол в host.go |
| Host exits | main.go не в NM mode без args |

См. [docs/CURRENT_STATUS.md](../docs/CURRENT_STATUS.md).
