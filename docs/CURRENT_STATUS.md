# Brows VPN — Текущий статус разработки

> **Обновлено:** 2026-05-22  
> **Веха v1:** ✅ первое рабочее MVP (`2310c6d`)  
> **Следующий фокус:** v3 — WebRTC, tray, multi-protocol  
> **Веха v2:** ✅ extension **v2.0.0** (v2.1–v2.10)  
> **План:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) · **Решения:** [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md)

---

## Сводка

| Компонент | v1 | Комментарий |
|-----------|:--:|-------------|
| Extension UI (popup + settings) | ✅ | Toggle, карточки, RU |
| Go proxy-service + NM | ✅ | Handler, preflight, health |
| Xray VLESS Reality | ✅ | SOCKS 10808 |
| Selective / global PAC | ✅ | Multi-domain whitelist |
| Preflight / auto-reconnect | ✅ | v2.3 уточнит recovery policy |
| **v2.1** | ✅ | «Добавить сайт» + badge (extension v1.1.0) |
| **v2.2** | ✅ | Blacklist / global_exclude (extension v1.2.0) |
| **v2.3** | ✅ | Recovery: 3× restart → disable VPN (extension v1.3.0) |
| **v2.4** | ✅ | IP и статус в popup (extension v1.4.0) |
| **v2.5** | ✅ | Профили VLESS (extension v1.5.0) |
| **v2.6** | ✅ | Smart routing / правила PAC (extension v1.6.0) |
| **v2.7** | ✅ | Import / export JSON (extension v1.7.0) |
| **v2.8** | ✅ | Контекстное меню (extension v1.8.0) |
| **v2.9** | ✅ | Onboarding wizard (extension v1.9.0) |
| **v2.10** | ✅ | Тёмная тема (extension v2.0.0) |
| **v3** (tray, WebRTC, …) | ⬜ | Следующий этап |

---

## v1 — что работает

- Popup: power toggle, **IP + статус Xray/SOCKS**, «Добавить сайт», badge (v1.4.0)  
- Settings: VLESS, whitelist, **исключения**, режим (selective / global / global_exclude), порт, диагностика  
- Enable VPN → Xray → PAC → SOCKS  
- «Подобрать порт», полная preflight-проверка  
- Тесты: `go test ./...`, `node scripts/test-pac-whitelist.js`

---

## v2 — согласованный scope

| Этап | Функция |
|------|---------|
| v2.1 | ✅ «Добавить сайт» + badge | extension **v1.1.0** |
| v2.2 | ✅ Blacklist (exclude) | extension **v1.2.0** |
| v2.3 | ✅ Restart Xray → disable VPN | extension **v1.3.0** |
| v2.4 | ✅ IP / статус в popup | extension **v1.4.0** |
| v2.5 | ✅ Профили VLESS | extension **v1.5.0** |
| v2.6 | ✅ Smart routing | extension **v1.6.0** |
| v2.7 | ✅ Import / export | extension **v1.7.0** |
| v2.8 | ✅ Контекстное меню | extension **v1.8.0** |
| v2.9 | ✅ Onboarding wizard | extension **v1.9.0** |
| v2.10 | ✅ Тёмная тема | extension **v2.0.0** |

---

## Быстрый старт (v1)

```powershell
cd proxy-service
go build -o browsvpn-proxy.exe ./cmd
.\setup_registry.bat
powershell -File update_allowed_origins.ps1 -ExtensionId ВАШ_ID
```

Chrome → загрузить `extension/` → Settings → VLESS + домены → Enable VPN.

[TESTING.md](./TESTING.md)
