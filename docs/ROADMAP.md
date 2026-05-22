# Brows VPN — Дорожная карта

> **Обновлено:** 2026-05-22  
> **Детали v2/v3:** [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md)  
> **Задачи по файлам:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)  
> **Статус кода:** [CURRENT_STATUS.md](./CURRENT_STATUS.md)

---

## Версии

```
v1  MVP (работает)     ████████████████████  100%  ✅
v2  UX + routing       ░░░░░░░░░░░░░░░░░░░░    0%  ← следующий
v3  Platform           ░░░░░░░░░░░░░░░░░░░░    0%  отложено
```

| Версия | Фокус |
|--------|--------|
| **v1** | Extension + Go + Xray, selective/global, preflight, UI |
| **v2** | Добавить сайт, blacklist, recovery, IP в popup, profiles, rules, import/export, context menu, onboarding, dark theme |
| **v3** | WebRTC, tray, другие протоколы, Firefox/Edge |

---

## v2 — очередность (кратко)

1. Popup «Добавить сайт» + badge  
2. Blacklist (exclude)  
3. Restart Xray → иначе disable VPN  
4. IP / статус в popup  
5. Профили VLESS  
6. Smart routing  
7. Import / export  
8. Контекстное меню  
9. Onboarding wizard  
10. Тёмная тема  

---

## v3 — отложено

- WebRTC leak protection  
- System tray (standalone)  
- Протоколы кроме VLESS  
- Firefox / Edge  

---

## Не в плане

Floating panel, quick-switch PAC, subscription URL, авто-VPN по категориям, таймер VPN, статистика в popup, UI «проверка утечек».

Полный список — [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md).

---

## Метрики (на 2026-05-22)

| Метрика | Значение |
|---------|----------|
| v1 MVP | ✅ E2E работает |
| Extension UI | ~90% v1 scope |
| Go proxy-service | ~85% v1 scope |
| v2 | не начат |

---

## Документация

| Файл | Описание |
|------|----------|
| [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) | Решения + Go vs PAC |
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | Этапы v2.x |
| [TESTING.md](./TESTING.md) | Как тестировать |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура |
