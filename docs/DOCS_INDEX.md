# Brows VPN — Индекс документации

> **Обновлено:** 2026-05-22

---

## Начать здесь

| Документ | Для кого | Описание |
|----------|----------|----------|
| [README.md](./README.md) | Все | Обзор проекта и структура |
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | Разработчик | Что работает / что нет |
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | Разработчик | **План v2/v3 по этапам** |
| [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) | Разработчик / PM | **Что делаем / отклонено** |
| [QUICK_START.md](./QUICK_START.md) | Разработчик | Сборка и загрузка extension |

---

## Планирование и статус

| Документ | Актуальность |
|----------|--------------|
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | ✅ v1 done + **план v2/v3** |
| [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) | ✅ **Решения по функциям**, Go vs PAC |
| [ROADMAP.md](./ROADMAP.md) | ✅ Краткая сводка версий |
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | ✅ Актуален |
| [PROJECT_COMPLETE.md](./PROJECT_COMPLETE.md) | ⚠️ Переименован по смыслу — статус «не завершён» |
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | 📦 Архив — исходный план Phase 0–5 |

---

## Техническая документация

| Документ | Описание |
|----------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Целевая архитектура (часть — ещё не реализована) |
| [API.md](./API.md) | Native messaging API + таблица implementation status |
| [FINAL_INSTRUCTIONS.md](./FINAL_INSTRUCTIONS.md) | Инструкция пользователя (после MVP) |

---

## Анализ Censor Tracker (справочно)

| Документ | Описание |
|----------|----------|
| [CENSORTRACKER_ANALYSIS.md](./CENSORTRACKER_ANALYSIS.md) | Общий анализ |
| [EXTENSION_ANALYSIS.md](./EXTENSION_ANALYSIS.md) | Extension architecture |
| [PROXY_SERVICE_ANALYSIS.md](./PROXY_SERVICE_ANALYSIS.md) | C++ proxy (reference) |

---

## Proxy-service (в repo)

| Документ | Путь |
|----------|------|
| README | [../proxy-service/README.md](../proxy-service/README.md) |
| Native Messaging Setup | [../proxy-service/NATIVE_MESSAGING_SETUP.md](../proxy-service/NATIVE_MESSAGING_SETUP.md) |
| Xray-core | [../proxy-service/xray-core/README.md](../proxy-service/xray-core/README.md) |

---

## Результаты аудита (2026-05-22)

### Исправлено

- Завышенный статус «95% / project complete» → ~40% MVP
- Противоречия между README, CURRENT_STATUS, PROJECT_COMPLETE
- Реальные VLESS credentials в docs → placeholders
- Устаревшие инструкции «Phase 0 — clone repos» в QUICK_START
- Указание React/webpack как активного стека → plain JS в корне extension
- FINAL_INSTRUCTIONS помечен как черновик до MVP

### Не изменялось (намеренно)

- ARCHITECTURE.md — целевая архитектура (добавлен disclaimer)
- Analysis docs — исторический справочный материал
- DEVELOPMENT_PLAN.md — архив с redirect на новый план

### Следующее обновление docs

После завершения каждого этапа [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) обновлять:
- `CURRENT_STATUS.md`
- `API.md` → Implementation Status
- `FINAL_INSTRUCTIONS.md` (после этапа 2)
