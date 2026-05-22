# Brows VPN — Текущий статус разработки

> **Обновлено:** 2026-05-22  
> **Веха:** первое рабочее MVP (E2E проверено)  
> **План работ:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)

---

## Сводка

| Компонент | Готовность | Комментарий |
|-----------|------------|-------------|
| Extension UI (popup + settings) | 90% | Toggle, русский UI, карточки настроек |
| Go proxy-service | 85% | NM handler, Xray start/stop, health checks |
| Native Messaging | 90% | Chrome ↔ browsvpn-proxy.exe |
| Xray integration | 85% | VLESS Reality, SOCKS 10808, selective PAC |
| Preflight / health | 85% | Extension + Go проверки, auto-reconnect |
| System Tray | 20% | Код есть, не подключён |
| Тесты | 55% | go test, PAC whitelist, integration script |
| **MVP (рабочий VPN)** | **✅ ~85%** | Работает: Enable VPN → PAC → SOCKS → Xray |

---

## Что работает (первое рабочее MVP)

- [x] Popup: круглый toggle, loading, режим/счётчик доменов
- [x] Settings: VLESS, whitelist, режим, порт, диагностика
- [x] Selective PAC — несколько доменов в белом списке
- [x] Native Messaging + `browsvpn-proxy.exe` (сборка: `go build -o browsvpn-proxy.exe ./cmd`)
- [x] Xray 26 VLESS Reality client
- [x] Preflight, health monitor, find free port
- [x] Автотесты: `go test ./...`, `node scripts/test-pac-whitelist.js`

---

## Быстрый старт

```powershell
cd proxy-service
go build -o browsvpn-proxy.exe ./cmd
.\setup_registry.bat
powershell -File update_allowed_origins.ps1 -ExtensionId ВАШ_ID
```

Загрузить `extension/` в Chrome → Settings → VLESS + домены → Enable VPN.

Подробнее: [TESTING.md](./TESTING.md)

---

## Следующие шаги (Этап 2+)

- System tray
- Installer / автообновление
- Import/export конфигурации
