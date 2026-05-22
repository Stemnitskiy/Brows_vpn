# Brows VPN — Дорожная карта

> **Обновлено:** 2026-05-22  
> **Статус кода:** [CURRENT_STATUS.md](./CURRENT_STATUS.md)  
> **Задачи по файлам:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)  
> **Безопасность:** [SECURITY.md](./SECURITY.md)

---

## Версии

```
v1  MVP                  ████████████████████  100%  ✅
v2  UX + routing         ████████████████████  100%  ✅  (extension v2.2.0)
v2.12 Security P0–P2     ████████████████████  100%  ✅
v3  Platform             ░░░░░░░░░░░░░░░░░░░░    0%  ⏸ отложено
```

| Версия | Фокус |
|--------|--------|
| **v1** | Extension + Go + Xray, PAC, preflight, UI |
| **v2** | Add site, blacklist, recovery, profiles, rules, import, onboarding, theme, UI polish |
| **v2.12** | Security hardening (validation, NM token, diagnostics, CI) — **без v3** |
| **v3** | WebRTC (расширенное), tray, multi-protocol, Firefox — **не начато** |

---

## v2 — выполнено

1. Popup «Добавить сайт» + badge  
2. Blacklist (global_exclude)  
3. Recovery 3× → disable VPN  
4. IP / статус в popup  
5. Профили VLESS  
6. Smart routing  
7. Import / export  
8. Контекстное меню  
9. Onboarding  
10. Тёмная тема  
11. Полировка UI настроек  

---

## v2.12 — Security (выполнено)

См. [SECURITY.md](./SECURITY.md): P0 validation + config wipe, P1 NM token + export, P2 CI + WebRTC/incognito basics.

---

## v3 — отложено

Не реализуем до отдельного решения:

- Standalone system tray  
- Multi-protocol profiles  
- Firefox / Edge builds  
- Расширенная платформа  

WebRTC/incognito **базовая** защита уже в v2.2.0 (не считается полным v3).

---

## Метрики (2026-05-22)

| Метрика | Значение |
|---------|----------|
| Extension version | 2.2.0 |
| Default SOCKS port | 10808 |
| Go tests | `go test ./...` |
| JS tests | PAC + import/export scripts |
| CI | GitHub Actions `test.yml` |
