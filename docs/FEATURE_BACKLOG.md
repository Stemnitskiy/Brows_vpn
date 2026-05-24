# Brows VPN — Бэклог функций и версии

> **Обновлено:** 2026-05-22  
> **MVP (v1):** ✅ первое рабочее — коммит `2310c6d`  
> **Следующая разработка:** platform backlog после v3.0.0 (см. [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md))

---

## Почему Go + Xray + Native Messaging, а не «просто PAC-расширение»

**PAC-only расширение** (как типичный proxy switcher) умеет только сказать Chrome: «ходи на `SOCKS5 127.0.0.1:PORT`». Оно **не может**:

| Возможность | PAC-only | Brows VPN (Extension + Go + Xray) |
|-------------|:--------:|:---------------------------------:|
| Поднять и остановить VPN-туннель (VLESS/Reality) | ❌ | ✅ Go запускает `xray.exe` |
| Сгенерировать Xray-конфиг из VLESS URL | ❌ | ✅ парсер на Go |
| Проверить, что SOCKS реально слушает, процесс жив | ❌ | ✅ preflight / health_check |
| Подобрать свободный порт, писать access/error логи | ❌ | ✅ |
| Перезапустить Xray при падении | ❌ | ✅ (v2: явная политика) |
| В будущем: другие протоколы, не только VLESS | ❌ | ✅ platform backlog |
| В будущем: tray без Chrome | ❌ | ✅ platform backlog |

**Extension** отвечает за UX Chrome: PAC, whitelist, popup, контекстное меню.  
**Go + Native Messaging** — за **data plane** и **control plane** VPN: Xray, конфиг, health, restart.  
**Xray** — полноценный клиент VLESS Reality (gRPC, TLS fingerprint и т.д.), а не ручной SOCKS на чужом сервере.

Итого: PAC — это **маршрутизация в браузере**; Go + Xray — **сам VPN**. Без второго слоя расширение могло бы только подключаться к уже запущенному SOCKS, но не быть self-hosted VPN из коробки.

---

## Решения по функциям (зафиксировано)

### ✅ v2 — делаем

| # | Функция | Описание |
|---|---------|----------|
| 1 | **«Добавить сайт» в popup** | Кнопка добавляет **домен текущей вкладки** в whitelist (например `2ip.ru`; subdomains матчатся по текущей логике PAC). Не URL, не путь. |
| 2 | **Режим «Исключения» (blacklist)** | Global + список доменов **минус** VPN (банки, локалка). Include (текущий selective) сохраняется. |
| 4 | **Recovery при сбое Xray** | Сначала **перезапуск Xray** (N попыток); если не удалось — **выключить VPN** и сбросить PAC (не «зависший» полуподключённый state). |
| 5 | **IP / статус в popup** | Компактно: внешний IP, статус SOCKS/Xray, последняя проверка — без перегруза UI. |
| 6 | **Профили VLESS** | Несколько сохранённых конфигов, переключение в settings/popup. |
| 7 | **Smart Routing** | Правила: TLD, шаблоны доменов, группы (расширение whitelist → rule engine). |
| 9 | **Import / export** | JSON настроек (VLESS, whitelist, режим, порт); без облачной подписки. |
| 17 | **Контекстное меню** | ПКМ: «Через VPN» / «Добавить домен» / «Исключить домен». |
| 18 | **Onboarding wizard** | Первый запуск: exe → registry → extension ID → VLESS → тест → OK. |
| 19 | **Тёмная тема** | Settings (+ опционально popup), sync с `prefers-color-scheme`. |

### 📋 Platform backlog — отложено

| # | Функция | Примечание |
|---|---------|------------|
| 3 | WebRTC leak protection | `chrome.privacy` / WebRTC policy при VPN ON |
| 6b | **Другие протоколы VPN** | Помимо VLESS (WireGuard client, другой outbound в Xray и т.д.) — архитектура профилей должна это допускать |
| 11 | **System tray** | Standalone Go без Chrome |
| 20 | **Firefox / Edge** | Отдельная сборка / `browser.*` API |

### ❌ Не планируется

| # | Функция |
|---|---------|
| 8 | Floating panel на странице |
| 10 | Quick switch PAC-пресетов |
| 12 | Подписочная система / subscription URL |
| 13 | Авто-VPN на «чувствительных» сайтах |
| 14 | Таймер «VPN на N минут» |
| 15 | Статистика трафика в popup |
| 16 | Кнопка «проверка утечек» в UI |

---

## Порядок реализации v2 (этапы разработки)

```
v2.1  Popup: «Добавить сайт» + badge/icon status
v2.2  Blacklist (exclude mode) + PAC
v2.3  Recovery: restart Xray → disable VPN
v2.4  Popup: IP / connection status (compact)
v2.5  VLESS profiles
v2.6  Smart routing (rules)
v2.7  Import / export
v2.8  Context menu
v2.9  Onboarding wizard
v2.10 Dark theme
```

Детальные задачи и файлы — в [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md).

---

## Связанные документы

| Документ | Назначение |
|----------|------------|
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | Этапы v1/v2/v3.0.0 + platform backlog |
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | Текущий прогресс |
| [ROADMAP.md](./ROADMAP.md) | Краткая сводка версий |
