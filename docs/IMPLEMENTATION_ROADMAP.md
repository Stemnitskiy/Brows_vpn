# Brows VPN — План реализации

> **Версия:** 2026-05-22  
> **Статус проекта:** ~40% MVP, интеграция Extension ↔ Go ↔ Xray не завершена  
> **Цель:** довести до рабочего MVP, затем до production-ready версии для личного использования

Этот документ — **основной план работ**. Этапы выполняются **строго по порядку**: каждый следующий этап начинается только после проверки критериев готовности предыдущего.

---

## Принципы реализации

1. **Один вертикальный срез за раз** — сначала «Enable VPN → Xray слушает :1080 → один сайт через туннель».
2. **Один активный код extension** — упрощённая версия в корне `extension/` (`background.js`, `popup.js`, `options.js`). Код Censor Tracker в `extension/src/` — справочник, не используется в сборке.
3. **Документация обновляется вместе с кодом** — после каждого этапа правится `CURRENT_STATUS.md`.
4. **Без секретов в репозитории** — VLESS URL только в локальных настройках пользователя, не в docs.

---

## Обзор этапов

| Этап | Название | Срок (оценка) | Результат |
|------|----------|---------------|-----------|
| **1** | Native Messaging + Xray (ядро) | 2–3 дня | Реальный VPN-туннель по команде из extension |
| **2** | Extension: маршрутизация и UX | 1–2 дня | Selective/Global режимы работают корректно |
| **3** | System Tray и standalone-режим | 1–2 дня | Управление без открытого Chrome |
| **4** | Надёжность и диагностика | 2–3 дня | Reconnect, логи, понятные ошибки |
| **5** | Дополнительные функции | 2–3 дня | Import/export, улучшенная валидация |
| **6** | Тестирование и упаковка | 2–3 дня | Installer, финальная документация |

**Итого до MVP (этапы 1–2):** ~4–5 дней  
**Итого до production-ready (этапы 1–6):** ~10–14 дней

---

## Этап 1 — Native Messaging + Xray (критический путь)

**Цель:** extension отправляет `enable_vpn` → Go-сервис парсит VLESS → запускает Xray → SOCKS5 на `127.0.0.1:1080` принимает соединения.

### 1.1 Исправить протокол Native Messaging

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Реализовать Chrome length-prefixed протокол (4 байта LE + JSON) для чтения/записи | `proxy-service/internal/messaging/host.go` |
| 2 | Убрать зависимость от `--native-messaging`: при запуске без TTY / по умолчанию — режим native host | `proxy-service/cmd/main.go` |
| 3 | Создать JSON-манифест host (`com.browsvpn.host.json`) с `path`, `type: stdio`, `allowed_origins` | `proxy-service/com.browsvpn.host.json` |
| 4 | Исправить `setup_registry.bat` — в реестр путь к **JSON-манifest**, не к exe | `proxy-service/setup_registry.bat` |
| 5 | Обновить `NATIVE_MESSAGING_SETUP.md` | `proxy-service/NATIVE_MESSAGING_SETUP.md` |

**Проверка:** Chrome DevTools → `chrome.runtime.connectNative('com.browsvpn.host')` → ответ `get_status` без ошибки disconnect.

### 1.2 Связать messaging handler с Xray

| # | Задача | Файлы |
|---|--------|-------|
| 6 | В `enable_vpn`: `ParseVLESSURL` → `Validate` → `ToXrayConfig` → `XrayController.Start` | `internal/messaging/host.go`, `pkg/vless/parser.go` |
| 7 | В `disable_vpn`: `XrayController.Stop` | `internal/messaging/host.go` |
| 8 | В `get_status`: реальный статус процесса Xray | `internal/messaging/host.go` |
| 9 | Путь к `xray.exe` — константа/конфиг относительно exe | `internal/xray/controller.go` |

**Проверка:** после `enable_vpn` процесс `xray.exe` запущен, порт 1080 слушает (`netstat -an | findstr 1080`).

### 1.3 Исправить генерацию Xray-конфига (Reality client)

| # | Задача | Файлы |
|---|--------|-------|
| 10 | Client-side `realitySettings`: `publicKey`, `shortId`, `serverName`, `fingerprint`, `spiderX` | `pkg/vless/parser.go` |
| 11 | Убрать серверные поля (`dest`, `privateKey`, `shortIds`) из клиентского конфига | `pkg/vless/parser.go` |
| 12 | Unit-тест: парсинг тестового VLESS URL + snapshot JSON конфига | `pkg/vless/parser_test.go` |

**Проверка:** Xray стартует без ошибок в stderr; curl через SOCKS5 (`curl --socks5 127.0.0.1:1080 https://ifconfig.me`) возвращает IP VPN-сервера.

### 1.4 Xray binary и сборка

| # | Задача | Файлы |
|---|--------|-------|
| 13 | Документировать загрузку `xray.exe` (не коммитить бинарник) | `proxy-service/xray-core/README.md` |
| 14 | Скрипт проверки окружения (`scripts/check-env.ps1`) | `scripts/check-env.ps1` |

### Критерии готовности этапа 1

- [ ] Native messaging подключается из extension без ручного запуска exe
- [ ] `enable_vpn` / `disable_vpn` управляют процессом Xray
- [ ] SOCKS5 проксирует трафик через VLESS Reality
- [ ] Есть минимум 1 unit-тест парсера VLESS

---

## Этап 2 — Extension: маршрутизация и UX

**Цель:** PAC-скрипт корректно маршрутизирует домены; UI отражает реальный статус.

### 2.1 PAC и proxy

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Исправить сопоставление доменов: поддержка wildcard (`*.example.com`), subdomain match | `extension/background.js` |
| 2 | Передавать `mode` из настроек в `enable_vpn` (сейчас hardcoded `selective`) | `extension/background.js` |
| 3 | При смене mode/domains — перегенерировать PAC без перезапуска VPN | `extension/background.js` |
| 4 | Обработка `chrome.proxy.onProxyError` — не reconnect если Xray не запущен | `extension/background.js` |

### 2.2 UI и настройки

| # | Задача | Файлы |
|---|--------|-------|
| 5 | Popup: показывать ошибку подключения (не только enabled/disabled) | `extension/popup.js`, `popup.html` |
| 6 | Options: синхронизация `socksPort`, `operationMode` с background | `extension/options.js` |
| 7 | Валидация VLESS — проверка Reality-полей (`pbk`, `sni`, `sid`) | `extension/options.js` |

### 2.3 Manifest и registry

| # | Задача | Файлы |
|---|--------|-------|
| 8 | Добавить `allowed_origins` с ID расширения после первой загрузки в Chrome | `proxy-service/com.browsvpn.host.json` |
| 9 | Скрипт обновления extension ID в manifest host | `proxy-service/update_allowed_origins.ps1` |

### Критерии готовности этапа 2

- [ ] Selective: домен из whitelist → через VPN, остальные → DIRECT
- [ ] Global: весь HTTP/HTTPS через VPN
- [ ] Disabled: proxy сброшен, Xray остановлен
- [ ] Popup показывает ошибку при недоступном native host

---

## Этап 3 — System Tray и standalone-режим

**Цель:** Go-сервис работает как фоновое приложение с иконкой в трее.

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Подключить `TrayManager` в standalone-режиме | `proxy-service/cmd/main.go` |
| 2 | Иконка tray — нормальный `.ico` вместо заглушки | `proxy-service/internal/tray/` |
| 3 | Enable/Disable в tray вызывает тот же XrayController | `internal/tray/tray.go`, shared state |
| 4 | Single-instance mutex — не запускать два процесса | `cmd/main.go` |
| 5 | Автозапуск (опционально): ярлык в Startup | `scripts/install-autostart.ps1` |

### Критерии готовности этапа 3

- [ ] Standalone: иконка в трее, Enable/Disable/Quit работают
- [ ] Chrome extension и tray не конфликтуют (single instance)

---

## Этап 4 — Надёжность и диагностика

**Цель:** стабильная работа при обрывах; понятные логи.

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Мониторинг процесса Xray — перезапуск при unexpected exit | `internal/xray/controller.go` |
| 2 | Exponential backoff reconnect в Go-сервисе | `internal/xray/` или `internal/reconnect/` |
| 3 | Extension: статус `connecting` / `error` / `enabled` | `extension/background.js` |
| 4 | Команда `get_status` — bytes transferred, uptime (если доступно) | `internal/messaging/host.go` |
| 5 | Log viewer в options (последние N строк из `logs/app.log`) | `extension/options.html` |
| 6 | Health-check: периодический `get_status` из background | `extension/background.js` |

### Критерии готовности этапа 4

- [ ] Kill xray.exe → auto-restart в течение 30 сек (если VPN enabled)
- [ ] Логи пишутся и читаются из UI
- [ ] Ошибки конфигурации показываются пользователю

---

## Этап 5 — Дополнительные функции

**Цель:** удобство повседневного использования.

| # | Задача | Приоритет |
|---|--------|-----------|
| 1 | Import/export настроек (JSON) | Высокий |
| 2 | Шифрование VLESS URL через Windows DPAPI | Средний |
| 3 | Blacklist (исключения в global mode) | Средний |
| 4 | Команды `update_domains` в native messaging | Средний |
| 5 | DNS leak mitigation (proxy DNS через SOCKS) | Низкий |
| 6 | WebRTC leak — `chrome.privacy` (если доступно) | Низкий |

### Критерии готовности этапа 5

- [ ] Export/import восстанавливает конфигурацию
- [ ] VLESS URL не хранится в plaintext (если включено шифрование)

---

## Этап 6 — Тестирование и упаковка

**Цель:** воспроизводимая установка на чистой Windows 11.

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Go unit-тests: parser, messaging protocol | `pkg/vless/`, `internal/messaging/` |
| 2 | Integration test script (PowerShell) | `scripts/test-e2e.ps1` |
| 3 | Extension build script (если нужен zip для Chrome) | `scripts/build-extension.ps1` |
| 4 | Installer: копирование exe, registry, xray-core | `scripts/install.ps1` |
| 5 | Uninstaller | `scripts/uninstall.ps1` |
| 6 | Финальное обновление docs | `docs/FINAL_INSTRUCTIONS.md` |

### E2E сценарии (обязательные)

1. Чистая установка → load extension → configure VLESS → enable → сайт из whitelist через VPN
2. Global mode → все сайты через VPN
3. Disable → DIRECT, Xray stopped
4. Chrome restart → extension восстанавливает состояние (или явно disabled)
5. Native host crash → extension показывает ошибку

### Критерии готовности этапа 6

- [ ] `scripts/test-e2e.ps1` проходит на dev-машине
- [ ] `docs/FINAL_INSTRUCTIONS.md` проверен пошагово
- [ ] Проект можно установить по инструкции без знания кодовой базы

---

## Известные проблемы (на старт плана)

| Проблема | Этап исправления |
|----------|------------------|
| Native messaging: построчный JSON вместо length-prefixed | 1.1 |
| Registry указывает на exe, не на JSON manifest | 1.1 |
| `--native-messaging` flag — Chrome не передаёт args | 1.1 |
| `handleEnableVPN` — заглушка, Xray не стартует | 1.2 |
| `ToXrayConfig` — неверный Reality client config | 1.3 |
| `xray.exe` отсутствует в repo | 1.4 |
| System tray отключён в main.go | 3 |
| Два параллельных codebase extension | Решено: используем корневой |
| Нет тестов | 1.4, 6 |
| Секреты VLESS в docs | Исправлено в audit |

---

## Definition of Done (MVP)

MVP считается готовым после **этапов 1 и 2**:

- Пользователь вставляет VLESS URL в options
- Нажимает Enable в popup
- Xray поднимается автоматически через native messaging
- Selective/Global routing работает
- Disable останавливает всё

---

## Definition of Done (v1.0)

После **этапов 1–6**:

- Tray, reconnect, logs, import/export
- Installer/uninstaller
- Документация актуальна
- E2E тесты проходят

---

## Связанные документы

| Документ | Назначение |
|----------|------------|
| [CURRENT_STATUS.md](./CURRENT_STATUS.md) | Текущий прогресс (обновляется после каждого этапа) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Техническая архитектура |
| [API.md](./API.md) | Протокол native messaging |
| [FINAL_INSTRUCTIONS.md](./FINAL_INSTRUCTIONS.md) | Инструкция для пользователя (после MVP) |
| [QUICK_START.md](./QUICK_START.md) | Быстрый старт для разработчика |
