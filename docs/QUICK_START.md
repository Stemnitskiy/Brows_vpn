# Brows VPN - Quick Start Guide

## Project Summary

**Brows VPN** - это персональный проект браузерного расширения с VLESS интеграцией для выборочного проксирования сайтов через VPN на Windows 11.

## Ключевые характеристики

- **Платформа**: Windows 11 + Chromium браузеры
- **VPN протокол**: VLESS с Reality security и gRPC
- **Архитектура**: Browser Extension + Local Proxy Service
- **Бasis**: Open-source проект Censor Tracker
- **Назначение**: Личное использование

## Быстрый обзор архитектуры

```
Browser Extension ←→ Native Messaging ←→ Local Proxy Service (Go + Xray-core)
        ↓                              ↓
   Chrome Proxy API              SOCKS5 (127.0.0.1:1080)
        ↓                              ↓
   PAC Script Routing           VLESS Client
                                      ↓
                              VPN Server (Reality)
```

## Основные компоненты

### 1. Browser Extension (Chrome Extension Manifest V3)
- **Функции**: UI, управление прокси, PAC скрипты, хранение настроек
- **Технологии**: JavaScript/TypeScript, React (опционально), Chrome APIs
- **Основные API**: chrome.proxy, chrome.storage, chrome.runtime (native messaging)

### 2. Local Proxy Service (Windows Application)
- **Функции**: VLESS клиент, SOCKS5 прокси, системный трей, логирование
- **Технологии**: Go, Xray-core, Windows API
- **Основные компоненты**: Native messaging host, VLESS wrapper, SOCKS5 server

## Режимы работы

### Selective Mode (Выборочный)
- Только сайты из белого списка идут через VPN
- Остальные сайты идут напрямую
- Управление через списки доменов

### Global Mode (Глобальный)
- Весь трафик через VPN
- Белый список игнорируется
- Полное проксирование

### Disabled Mode (Отключен)
- VPN отключен
- Весь трафик напрямую

## VLESS конфигурация

Поддерживается стандартный URL формат:
```
vless://uuid@address:port?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=publicKey&fp=chrome&sni=serverName&sid=sessionId&spx=%2F#name
```

Пример (анонимизированный):
```
vless://63197442-76bb-4ab0-b99f-bcb682d8c2ac@103.228.168.248:34286?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=EIg-mGPQDao0xcoptrd7Gix2viSn9MYS85hPQUfW2Qs&fp=chrome&sni=yahoo.com&sid=3130&spx=%2F#WORK%20PC
```

## Технологический стек

### Browser Extension
- **Язык**: TypeScript/JavaScript (ES6+)
- **Фреймворк**: React (опционально)
- **Build tools**: Webpack/Vite
- **Chrome APIs**: Proxy, Storage, Runtime, Tabs

### Proxy Service
- **Язык**: Go
- **VPN ядро**: Xray-core
- **GUI**: Windows System Tray
- **Communication**: Native Messaging Protocol

## Open-source основа

Проект основан на [Censor Tracker](https://github.com/censortracker):
- **censortracker/censortracker** - Browser extension
- **censortracker/proxy** - Proxy client с Xray интеграцией

### Что будет изменено/улучшено:
- ✅ Улучшенная поддержка VLESS Reality
- ✅ Интеграция системного трея для Windows
- ✅ Улучшенное управление списками доменов
- ✅ Автоматическое переподключение
- ✅ Расширенная система логирования
- ✅ Импорт/экспорт конфигураций
- ✅ Глобальный режим VPN

## Структура проекта

```
Brows_vpn/
├── docs/                  # Документация
│   ├── README.md         # Обзор проекта
│   ├── ROADMAP.md        # Дорожная карта
│   ├── ARCHITECTURE.md   # Техническая архитектура
│   ├── API.md            # API документация
│   ├── DEVELOPMENT_PLAN.md # План разработки
│   └── QUICK_START.md    # Этот файл
├── extension/            # Browser extension
│   ├── base/            # Censor Tracker extension (fork)
│   ├── src/             # Исходный код
│   ├── popup/           # Popup UI
│   ├── settings/        # Settings page
│   └── manifest.json    # Extension manifest
├── proxy-service/       # Local proxy service
│   ├── base/           # Censor Tracker proxy (fork)
│   ├── cmd/            # Application entry points
│   ├── internal/       # Internal packages
│   └── main.go         # Main application
└── scripts/            # Build и utility scripts
```

## С чего начать разработку

### 1. Установка окружения (Phase 0)

**Для расширения:**
```bash
# Установить Node.js LTS
node --version

# Установить зависимости (после копирования базы)
cd extension
npm install
```

**Для proxy service:**
```bash
# Установить Go
go version

# Инициализация модуля (после копирования базы)
cd proxy-service
go mod init browsvpn-proxy
go mod tidy
```

### 2. Клонирование и анализ базовых проектов (Phase 1)

```bash
cd D:/Projects/Brows_vpn

# Клонировать Censor Tracker проекты
git clone https://github.com/censortracker/censortracker.git extension/base
git clone https://github.com/censortracker/proxy.git proxy-service/base

# Проанализировать архитектуру
# Создать документы анализа
```

### 3. Разработка расширения (Phase 2)

Начать с модификации расширения:
- Обновить manifest.json
- Переработать popup UI
- Создать settings page
- Реализовать domain management
- Создать PAC script generator

### 4. Разработка proxy service (Phase 3)

Начать с модификации proxy service:
- Интегрировать VLESS client
- Создать SOCKS5 server
- Добавить system tray
- Реализовать native messaging host

### 5. Интеграция и тестирование (Phase 4)

Соединить компоненты:
- Настроить native messaging
- Протестировать коммуникацию
- Проверить все режимы работы
- Провести comprehensive testing

## Первые задачи для старта

### Сегодня:
- [ ] Установить Node.js и Go
- [ ] Создать структуру проекта
- [ ] Клонировать Censor Tracker репозитории
- [ ] Настроить IDE (VS Code с расширениями)

### Завтра:
- [ ] Проанализировать censortracker/censortracker
- [ ] Проанализировать censortracker/proxy
- [ ] Создать документы анализа
- [ ] Изучить предоставленный VLESS конфиг

### Эта неделя:
- [ ] Завершить анализ фазу
- [ ] Спроектировать VLESS parser
- [ ] Создать UI mockups
- [ ] Начать разработку расширения

## Ключевые требования

### Функциональные:
- ✅ Проксировать выбранные сайты через VLESS VPN
- ✅ Поддержка Reality security и gRPC
- ✅ Выборочный и глобальный режимы
- ✅ Управление списками доменов
- ✅ Автоматическое переподключение
- ✅ Логирование подключений
- ✅ Импорт/экспорт конфигураций

### Технические:
- ✅ Chrome Extension Manifest V3
- ✅ Native messaging для коммуникации
- ✅ Localhost-only SOCKS5 proxy
- ✅ Xray-core для VLESS реализации
- ✅ Windows system tray integration

### Пользовательские:
- ✅ Простой и интуитивный интерфейс
- ✅ Быстрое включение/выключение
- ✅ Визуальная индикация статуса
- ✅ Удобное управление доменами
- ✅ Надежное автопереподключение

## Риски и их mitigiation

### Технические риски:
1. **VLESS Reality совместимость** → Раннее тестирование с предоставленным конфигом
2. **Chrome API изменения** → Мониторинг релизов Chrome и адаптация
3. **Производительность** → Регулярное профилирование и оптимизация

### Риски разработки:
1. **Сроки** → Включение buffer time в расписание
2. **Сложная интеграция** → Инкрементальный подход с частым тестированием
3. **Зависимости** → Мониторинг open-source проектов

## Критерии успеха

- ✅ VLESS Reality соединение работает с предоставленным конфигом
- ✅ Выборочное проксирование сайтов функционирует
- ✅ Глобальный VPN режим работает
- ✅ Управление доменами удобно
- ✅ Автопереподключение работает стабильно
- ✅ System tray интеграция функциональна
- ✅ Логирование всестороннее и полезное
- ✅ Импорт/экспорт работает无缝
- ✅ Производительность приемлема для ежедневного использования
- ✅ Процесс установки straightforward

## Документация

Полная документация доступна в папке `docs/`:
- **README.md** - Полный обзор проекта
- **ROADMAP.md** - Детальная дорожная карта разработки
- **ARCHITECTURE.md** - Техническая архитектура и детали
- **API.md** - API документация и протоколы
- **DEVELOPMENT_PLAN.md** - План разработки и следующие шаги
- **QUICK_START.md** - Этот файл (быстрый старт)

## Контакты и поддержка

Это персональный проект для частного использования. В случае проблем или вопросов:
1. Обратиться к документации в папке `docs/`
2. Проверить логи расширения и service
3. Проанализировать конфигурацию VLESS
4. Протестировать с базовым Censor Tracker проектом

## License

Персональный проект для частного использования. Основан на open-source проекте Censor Tracker (MIT License).