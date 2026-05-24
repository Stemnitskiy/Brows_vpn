# Brows VPN — Дорожная карта

> **Обновлено:** 2026-05-24
> **Статус кода:** [CURRENT_STATUS.md](./CURRENT_STATUS.md)  
> **Задачи по файлам:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)  
> **Безопасность:** [SECURITY.md](./SECURITY.md)

---

## Версии

```
v1  MVP                  ████████████████████  100%  ✅
v2  UX + routing         ████████████████████  100%  ✅  (extension v2.2.1)
v2.12 Security P0–P2     ████████████████████  100%  ✅
v3.0 GitHub release      ████████████████████  100%  ✅
v4  Platform backlog     ░░░░░░░░░░░░░░░░░░░░    0%  ⏸ отложено
```

| Версия | Фокус |
|--------|--------|
| **v1** | Extension + Go + Xray, PAC, preflight, UI |
| **v2** | Add site, blacklist, recovery, profiles, rules, import, onboarding, theme, UI polish |
| **v2.12** | Security hardening (validation, NM token, diagnostics, CI) |
| **v3.0.0** | GitHub release hardening, release gate, clean archive, onboarding/install automation |
| **v4 / backlog** | WebRTC (расширенное), tray, multi-protocol, Firefox — **не начато** |

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

## v3.0.0 — выполнено

См. [GITHUB_RELEASE_HARDENING_ROADMAP.md](./GITHUB_RELEASE_HARDENING_ROADMAP.md): release gate, clean archive, optional permissions, native host origin gate, Xray SHA256, onboarding actions.

---

## v4 / platform backlog — отложено

Не реализуем до отдельного решения:

- Standalone system tray  
- Multi-protocol profiles  
- Firefox / Edge builds  
- Расширенная платформа  

WebRTC/incognito **базовая** защита уже в v3.0.0. Расширенная platform-часть остаётся в backlog.

---

## Метрики (2026-05-22)

| Метрика | Значение |
|---------|----------|
| Extension version | 3.0.0 |
| Default SOCKS port | 10808 |
| Go tests | `go test ./...` |
| JS tests | PAC + import/export scripts |
| CI | GitHub Actions `test.yml` |
