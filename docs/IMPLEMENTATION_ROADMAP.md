# Brows VPN — План реализации

> **Обновлено:** 2026-05-22  
> **MVP v1:** ✅ завершён (первое рабочее E2E)  
> **Активная работа:** v2 (см. [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md))  
> **Бэклог решений:** что в v2 / v3 / отклонено — только в FEATURE_BACKLOG

---

## Принципы

1. **Extension** — UX Chrome, PAC, whitelist, popup.  
2. **Go + Native Messaging + Xray** — VPN data plane (см. [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md#почему-go--xray--native-messaging-а-не-просто-pac-расширение)).  
3. **Один активный extension** — корень `extension/`; `extension/src/` — справочник.  
4. **Без секретов в git** — VLESS только в `chrome.storage` / локальный export.  
5. **Документация** обновляется после каждого этапа v2.x.

---

## Версии продукта

| Версия | Статус | Содержание |
|--------|--------|------------|
| **v1 MVP** | ✅ Done | NM + Xray + selective/global PAC, preflight, health, UI popup/settings |
| **v2** | 🔜 Next | Per-site add, blacklist, recovery, IP in popup, profiles, rules, import/export, context menu, onboarding, dark theme |
| **v3** | 📋 Planned | WebRTC, tray, multi-protocol, Firefox/Edge |

---

# v1 — MVP (завершено)

### Критерии (выполнено)

- [x] Native messaging, length-prefixed protocol
- [x] `enable_vpn` / `disable_vpn` → Xray, SOCKS **10808**
- [x] VLESS Reality client config
- [x] Selective / global PAC, несколько доменов в whitelist
- [x] Preflight, health monitor, auto-reconnect
- [x] Popup (toggle), settings (карточки), русский UI
- [x] Тесты: `go test`, `test-pac-whitelist.js`, integration script

Коммит: `2310c6d` — *First working MVP*.

---

# v2 — Расширение функционала

Оценка: **~2–3 недели** при поэтапной сдаче.

---

## v2.1 — «Добавить сайт» + badge ✅ (extension v1.1.0)

**Цель:** управление whitelist без захода в settings.

| # | Задача | Статус |
|---|--------|--------|
| 1 | Домен текущей вкладки → apex (`2ip.ru`) | ✅ `validators.js` |
| 2 | Кнопка «Добавить сайт» в popup | ✅ |
| 3 | PAC пересборка при VPN ON | ✅ |
| 4 | Badge: OFF / ON / OK / -- | ✅ |

**Проверка:** на `2ip.ru` → «Добавить сайт» → домен в storage → badge `OK` при VPN ON.

---

## v2.2 — Blacklist (режим исключений) ✅

**Цель:** global mode, но часть доменов **напрямую**.

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Режим `global_exclude` + `excludeList` | ✅ `background.js`, `validators.js` |
| 2 | PAC: global минус blacklist | ✅ `validators.js` |
| 3 | UI: секция «Исключения» в settings | ✅ `options.html`, `options.js` |
| 4 | Preflight / verify exclude routes | ✅ `background.js` |
| 5 | Popup hints + badge | ✅ `popup.js`, `background.js` |

**Проверка:** global_exclude + exclude `2ip.ru` → `2ip.ru` DIRECT, `google.com` через SOCKS.

---

## v2.3 — Recovery: restart Xray → disable VPN ✅

**Цель:** замена «жёсткому kill switch» — понятное восстановление или полное выключение.

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Health fail → до 3 попыток enable (stop+start Xray), backoff 2/5/10 с | ✅ `background.js` |
| 2 | После исчерпания → `disableVPN()` + PAC clear + ошибка в popup | ✅ `background.js` |
| 3 | Не восстанавливать при invalid VLESS / режим / пустой whitelist | ✅ `runLocalChecks` в recovery |
| 4 | Логирование попыток в diagnostic log | ✅ `recovery` component |

**Проверка:** kill `xray.exe` → auto restart (до 3×) → если не помогло → VPN off, пользователь видит ошибку.

---

## v2.4 — IP и статус в popup (компактно) ✅

| # | Задача | Файлы |
|---|--------|-------|
| 1 | `fetch` api.ipify.org через PAC (extension-only) | ✅ `background.js` |
| 2 | Блок под toggle: IP, «Xray ✓», «SOCKS :10808» | ✅ `popup.html`, `popup.js` |
| 3 | Кэш IP 45 с, runtime 15 с, spinner при обновлении | ✅ `background.js`, `popup.js` |

**Проверка:** VPN ON → popup показывает внешний IP и зелёные чипы Xray/SOCKS; повторное открытие — мгновенно из кэша.

## v2.5 — Профили VLESS ✅

| # | Задача | Файлы |
|---|--------|-------|
| 1 | `profiles[]` в storage: `{ id, name, protocol, vless_url }` | ✅ `validators.js`, `background.js` |
| 2 | UI: список, add/rename/delete, active | ✅ `options.html`, `options.js` |
| 3 | Popup: dropdown профиля (VPN off, ≥2 профилей) | ✅ `popup.html`, `popup.js` |
| 4 | Миграция legacy `vlessConfig` → профиль «Основной» | ✅ `validators.js` |

---

## v2.6 — Smart Routing (правила) ✅

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Модель `{ pattern, action: proxy\|direct }` + пресеты | ✅ `validators.js` |
| 2 | Приоритет: rules → whitelist / exclude / global | ✅ `generatePACScript`, `pacRouteForHost` |
| 3 | UI: пресеты (.ru, .local) + свои правила | ✅ `options.html`, `options.js` |
| 4 | Popup: статус «Правило → напрямую» | ✅ `popup.js`, `background.js` |

**Проверка:** selective + whitelist `yandex.ru` + пресет `.ru` → `yandex.ru` DIRECT; `google.com` в whitelist → SOCKS.

---

## v2.7 — Import / Export ✅

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Export JSON: profiles, domains, exclude, mode, port, rules | ✅ `validators.js`, `options.js` |
| 2 | Import с валидацией и preview | ✅ `options.js` |
| 3 | Предупреждение: файл содержит секреты | ✅ `options.html` |

**Проверка:** Settings → «Скачать JSON» → очистить VLESS → «Предпросмотр» + «Применить» → настройки восстановлены.

---

## v2.8 — Контекстное меню ✅

| # | Задача | Файлы |
|---|--------|-------|
| 1 | «Добавить домен в VPN» (selective) | ✅ `background.js` |
| 2 | «Исключить домен из VPN» (global_exclude) | ✅ `background.js` |
| 3 | Permission `contextMenus` | ✅ `manifest.json` |

**Проверка:** selective → ПКМ на странице → «Добавить домен в VPN» → домен в whitelist. global_exclude → «Исключить домен».

---

## v2.9 — Onboarding wizard ✅

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Флаг `onboardingComplete` в storage | ✅ `background.js` |
| 2 | Страница `onboarding.html` + wizard | ✅ `onboarding.html`, `onboarding.js`, `onboarding.css` |
| 3 | Шаги: build → registry → extension ID → VLESS → test enable | ✅ wizard |
| 4 | «Пройти настройку снова» в settings | ✅ `options.html` |

**Проверка:** первая установка → открывается мастер; Settings → «Пройти настройку снова».

---

## v2.10 — Тёмная тема ✅

| # | Задача | Файлы |
|---|--------|-------|
| 1 | CSS variables + `[data-theme=dark]` + system | ✅ `theme.css` |
| 2 | Toggle в settings + `prefers-color-scheme` | ✅ `options.html`, `theme.js` |
| 3 | Popup / options / onboarding | ✅ `popup.css`, `options.css` |

**Проверка:** Settings → «Тёмная» → popup и settings переключаются; «Как в системе» следует OS.

---

### Definition of Done — v2 ✅

- [x] Все пункты v2.1–v2.10 по критериям проверки
- [x] `CURRENT_STATUS.md` обновлён
- [ ] `TESTING.md` — дополнить при необходимости
- [ ] Нет регрессии v1 E2E (ручная проверка)

---

# v3 — Платформа (позже)

| Блок | Задачи |
|------|--------|
| **WebRTC** | `chrome.privacy.network.webRTCIPHandlingPolicy` при VPN ON |
| **Tray** | Standalone Go, single instance, Enable/Disable без Chrome |
| **Multi-protocol** | Профили с `protocol != vless`, другие outbounds Xray |
| **Cross-browser** | Firefox PAC/onRequest, Edge = Chromium path |

Подробности — [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md).

---

# Архив: старые этапы 1–6 (история)

Этапы 1–4 старого плана **поглощены v1** (ядро, UX, health).  
Tray перенесён в **v3**. Import/export и blacklist — в **v2.7 / v2.2**.

---

## Связанные документы

| Документ | Назначение |
|----------|------------|
| [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) | Решения по функциям, Go vs PAC |
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | Прогресс |
| [TESTING.md](./TESTING.md) | Тест-план |
| [API.md](./API.md) | Native messaging |
