# Brows VPN — Статус проекта (архив)

> **📦 Архивный документ.** Актуальный статус: [CURRENT_STATUS.md](./CURRENT_STATUS.md) (extension **v2.2.1**, v2 complete).  
> Ниже — историческая запись аудита 2026-05-22, когда docs показывали ~40% MVP.

---

## Что было заявлено vs реальность

| Заявление (старый PROJECT_COMPLETE) | Факт |
|-------------------------------------|------|
| «95% готов к тестированию» | ~40% — интеграция не работает |
| «Native messaging реализован» | Протокол и registry неверны |
| «Xray-core интеграция» | Controller есть, handler — заглушка |
| «Autoreconnect» | Только partial в extension |
| «3 шага до запуска» | Недостаточно — нужен этап 1 roadmap |

---

## Что уже есть (фундамент)

- Chrome Extension MV3 с popup, options, background
- Go-сервис: VLESS parser, Xray controller, messaging stub, tray stub, logging
- Документация архитектуры и API
- Анализ Censor Tracker
- `setup_registry.bat` (требует исправления)

---

## Что нужно для первого рабочего запуска

См. **Этап 1 + 2** в [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md):

1. Исправить Native Messaging (протокол, manifest, registry, entry point)
2. Подключить Xray к `enable_vpn`
3. Исправить Reality client config
4. Установить `xray.exe`
5. Проверить selective/global routing

**Оценка:** 4–5 дней focused work.

---

## После MVP

Этапы 3–6: system tray, reconnect, import/export, installer, E2E tests.

Инструкция для пользователя будет в [FINAL_INSTRUCTIONS.md](./FINAL_INSTRUCTIONS.md) после прохождения MVP.

---

## Связанные документы

- [CURRENT_STATUS.md](./CURRENT_STATUS.md) — детальный статус компонентов
- [ROADMAP.md](./ROADMAP.md) — краткая дорожная карта
- [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) — полный план
