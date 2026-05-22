# 🎯 Финальные инструкции для запуска Brows VPN

## ✅ Что уже сделано (программная часть):

- ✅ Полностью разработано Chrome extension (Manifest V3)
- ✅ Полностью разработан Go proxy service с Xray-core интеграцией  
- ✅ Реализован native messaging протокол
- ✅ Создана система VLESS конфигурации
- ✅ Реализована генерация PAC скриптов для маршрутизации
- ✅ Добавлен system tray для Windows
- ✅ Создана система логирования
- ✅ Все компоненты проинтегрированы

## 🔧 Требуется сделать вручную (3 шага):

### Шаг 1: Установка Go (5 минут)

**Скачивание:**
1. Перейдите на https://golang.org/dl/
2. Скачайте: `go1.21.6.windows-amd64.msi` (или более новую версию)
3. Запустите установщик и следуйте инструкциям

**Проверка:**
Откройте новую командную строку и выполните:
```bash
go version
```
*Ожидаемый результат: `go version go1.21.x windows/amd64`*

---

### Шаг 2: Скачивание Xray-core (2 минуты)

**Скачивание:**
1. Перейдите на https://github.com/XTLS/Xray-core/releases
2. Скачайте: `Xray-windows-64.zip` (последняя версия)
3. Распакуйте архив
4. Скопируйте файл `xray.exe` в папку: `D:/Projects/Brows_vpn/proxy-service/xray-core/`

**Проверка:**
Проверьте, что файл существует: `D:/Projects/Brows_vpn/proxy-service/xray-core/xray.exe`

---

### Шаг 3: Сборка и настройка (5 минут)

**Сборка Go приложения:**
```bash
cd D:/Projects/Brows_vpn/proxy-service
go build -o browsvpn-proxy.exe ./cmd
```

**Настройка Native Messaging:**
1. Откройте папку `D:/Projects/Brows_vpn/proxy-service/`
2. Правой кнопкой мыши на `setup_registry.bat`
3. Выберите "Запуск от имени администратора"
4. Подтвердите добавление в реестр

---

## 🚀 Запуск и тестирование

### 1. Запуск Go Service (Фоновый режим)

Откройте командную строку и выполните:
```bash
cd D:/Projects/Brows_vpn/proxy-service
browsvpn-proxy.exe --native-messaging
```

*Оставьте это окно открытым - это native messaging хост*

---

### 2. Загрузка Extension в Chrome

1. Откройте Chrome и перейдите на `chrome://extensions/`
2. Включите "Режим разработчика" (в правом верхнем углу)
3. Нажмите кнопку "Загрузить распакованное расширение"
4. Выберите папку: `D:/Projects/Brows_vpn\extension`
5. Расширение появится в списке

---

### 3. Настройка VLESS конфигурации

1. Нажмите на иконку расширения в панели Chrome
2. Нажмите кнопку "Settings"
3. В поле "VLESS Configuration URL" вставьте вашу конфигурацию:
   ```
   vless://63197442-76bb-4ab0-b99f-bcb682d8c2ac@103.228.168.248:34286?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=EIg-mGPQDao0xcoptrd7Gix2viSn9MYS85hPQUfW2Qs&fp=chrome&sni=yahoo.com&sid=3130&spx=%2F#WORK%20PC
   ```
4. Нажмите "Save Configuration"
5. Добавьте домены в "Domain Management" (например: `google.com`, `youtube.com`)
6. Нажмите "Save Domain List"
7. Выберите режим "Selective Mode"
8. Нажмите "Save Mode"

---

### 4. Активация VPN

1. Закройте настройки и вернитесь к popup
2. Нажмите кнопку "Enable VPN"
3. Статус должен измениться на "VPN Enabled"
4. Попробуйте посетить сайт из вашего белого списка
5. Проверьте, что он работает через VPN

---

## 🐛 Устранение неполадок

### "Native messaging host not found"

**Решение:**
1. Убедитесь, что `setup_registry.bat` был запущен от имени администратора
2. Проверьте путь в реестре: `regedit` → `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host`
3. Убедитесь, что путь к `browsvpn-proxy.exe` верный
4. Перезапустите Chrome

### "Failed to connect to native messaging host"

**Решение:**
1. Убедитесь, что `browsvpn-proxy.exe --native-messaging` запущен
2. Проверьте логи в командной строке Go приложения
3. Убедитесь, что расширение загружено правильно

### "VLESS configuration invalid"

**Решение:**
1. Проверьте формат VLESS URL
2. Убедитесь, что все необходимые параметры присутствуют
3. Используйте кнопку "Validate" для проверки

### Go compilation errors

**Решение:**
1. Убедитесь, что Go установлен правильно: `go version`
2. Убедитесь, что вы в правильной папке: `D:/Projects/Brows_vpn/proxy-service`
3. Попробуйте: `go mod tidy` перед сборкой

---

## 📊 Структура процесса

```
Chrome Extension ←→ Native Messaging ←→ Go Proxy Service ←→ Xray-core ←→ VPN Server
     ↓                          ↓                      ↓                 ↓
  PAC Script            JSON Protocol        SOCKS5 Proxy    VLESS Protocol
  Generation           Communication         (127.0.0.1:1080)   with Reality
```

---

## 🎯 Ожидаемый результат

После выполнения всех шагов:

1. ✅ Extension загружен в Chrome
2. ✅ Go service работает в фоне
3. ✅ Native messaging настроен через реестр
4. ✅ VLESS конфигурация сохранена
5. ✅ VPN включается через popup
6. ✅ Сайты из белого списка идут через VPN
7. ✅ Остальные сайты идут напрямую
8. ✅ System tray показывает статус подключения

---

## 📝 Дополнительная информация

### Файлы логов:

- **Extension**: Chrome DevTools → Console
- **Go Service**: `D:/Projects/Brows_vpn/proxy-service/logs/app.log`

### Деинсталляция:

1. Удалите расширение из Chrome
2. Закройте `browsvpn-proxy.exe`
3. Запустите `uninstall_registry.bat` от имени администратора

### Обновление:

Для обновления extension:
1. Измените версию в `manifest.json`
2. Перезагрузите расширение в Chrome

Для обновления Go service:
1. Пересоберите: `go build -o browsvpn-proxy.exe ./cmd`
2. Перезапустите приложение

---

## 🎉 Готово к тестированию!

После выполнения 3 шагов настройки у вас будет полностью функциональный Brows VPN с VLESS Reality поддержкой.