# Brows VPN — Дорожная карта

> **Актуальный план реализации:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)  
> **Текущий статус:** [CURRENT_STATUS.md](./CURRENT_STATUS.md)  
> **Последнее обновление:** 2026-05-22

---

## Статус проекта

| Метрика | Значение |
|---------|----------|
| Общая готовность | ~40% MVP |
| Документация / архитектура | ~85% |
| Extension (базовый UI) | ~60% |
| Go proxy-service (логика) | ~30% |
| Интеграция Extension ↔ Go ↔ Xray | ~10% |
| Тестирование | ~0% |

**Вывод:** каркас и документация готовы; **критическая интеграция не завершена**. Проект не готов к ежедневному использованию.

---

## Этапы реализации (кратко)

Полное описание задач, файлов и критериев — в [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md).

```
Этап 1  Native Messaging + Xray          [████████░░]  блокер — в работе
Этап 2  Extension: маршрутизация и UX     [░░░░░░░░░░]  после этапа 1
Этап 3  System Tray                       [░░░░░░░░░░]  после этапа 2
Этап 4  Надёжность и диагностика          [░░░░░░░░░░]  после этапа 3
Этап 5  Доп. функции (import/export)      [░░░░░░░░░░]  после этапа 4
Этап 6  Тестирование и упаковка           [░░░░░░░░░░]  после этапа 5
```

### MVP = Этапы 1 + 2 (~4–5 дней)

Рабочий VPN: Enable → Xray → selective/global routing.

### v1.0 = Этапы 1–6 (~10–14 дней)

Tray, reconnect, logs, installer, полная документация.

---

## Завершённые работы (история)

| Фаза | Статус | Результат |
|------|--------|-----------|
| 0. Environment & structure | ✅ | Структура repo, Git, docs |
| 1. Censor Tracker analysis | ✅ | 3 analysis-документа |
| 2. Extension foundation | ✅ | MV3, popup, options, background.js |
| 3. Go service foundation | ✅ | Parser, Xray controller, messaging stub, tray stub |
| 4. Integration | ⚠️ Частично | Клиент NM в extension есть; Go-host — заглушка |
| 5–8. Features, testing, release | ❌ | Не начато |

---

## Что НЕ входит в текущий scope

- Firefox / macOS / Linux
- Мульти-сервер и load balancing
- Chrome Web Store публикация
- Мобильные браузеры

*(Запланировано как post-v1.0 enhancements.)*

---

## Критерии успеха v1.0

- VLESS Reality соединение работает с пользовательским конфигом
- Selective и Global режимы маршрутизируют корректно
- Native messaging без ручного запуска exe
- System tray Enable/Disable/Quit
- Auto-reconnect при падении Xray
- Import/export настроек
- Установка по `FINAL_INSTRUCTIONS.md` на чистой Windows 11

---

## Документация

| Файл | Описание |
|------|----------|
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | **Основной план работ** |
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | Текущее состояние кода |
| [README.md](./README.md) | Обзор проекта |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура |
| [API.md](./API.md) | Native messaging API |
| [QUICK_START.md](./QUICK_START.md) | Быстрый старт для разработчика |
| [FINAL_INSTRUCTIONS.md](./FINAL_INSTRUCTIONS.md) | Инструкция пользователя (после MVP) |

Исторические / справочные: `DEVELOPMENT_PLAN.md`, `CENSORTRACKER_ANALYSIS.md`, `EXTENSION_ANALYSIS.md`, `PROXY_SERVICE_ANALYSIS.md`.
