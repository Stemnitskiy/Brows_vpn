# Windows Registry Configuration for Native Messaging

## Инструкция по настройке Native Messaging Host

### Шаг 1: Сборка Go приложения

После настройки Go среды (см. ниже), выполните:

```bash
cd D:/Projects/Brows_vpn/proxy-service
go build -o browsvpn-proxy.exe ./cmd
```

Это создаст `browsvpn-proxy.exe` в папке `proxy-service/`.

### Шаг 2: Настройка Windows Registry

**Способ 1: Через regedit (Вручную)**

1. Откройте редактор реестра:
   - Нажмите `Win + R`
   - Введите `regedit`
   - Нажмите Enter

2. Перейдите к следующему пути:
   ```
   HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\
   ```

3. Создайте новый ключ:
   - Правой кнопкой мыши на `NativeMessagingHosts`
   - `Создать` → `Раздел`
   - Назовите: `com.browsvpn.host`

4. В созданном ключе `com.browsvpn.host`:
   - Правой кнопкой мыши на пустое место справа
   - `Создать` → `Строковый параметр`
   - Имя: `(По умолчанию)` или просто оставьте пустое
   - Значение: полный путь к `browsvpn-proxy.exe`

   **Пример значения:**
   ```
   D:\Projects\Brows_vpn\proxy-service\browsvpn-proxy.exe
   ```

**Способ 2: Через командную строку (Автоматически)**

Создайте файл `setup_registry.bat` в папке `proxy-service/`:

```batch
@echo off
set KEY_PATH=HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host
set EXE_PATH=%~dp0browsvpn-proxy.exe

echo Adding native messaging host configuration...
reg add "%KEY_PATH%" /ve /t REG_SZ /d "%EXE_PATH%" /f

if %ERRORLEVEL% EQU 0 (
    echo Native messaging host configured successfully!
) else (
    echo Failed to configure native messaging host
    echo Error code: %ERRORLEVEL%
)

pause
```

Запустите этот файл от имени администратора:
- Правой кнопкой мыши на `setup_registry.bat`
- "Запуск от имени администратора"

### Шаг 3: Проверка конфигурации

1. Проверьте, что файл существует:
   ```
   D:\Projects\Brows_vpn\proxy-service\browsvpn-proxy.exe
   ```

2. Проверьте реестр:
   - Откройте regedit
   - Перейдите к `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host`
   - Убедитесь, что значение `(По умолчанию)` указывает на правильный путь к exe-файлу

### Шаг 4: Тестирование

После настройки:

1. Запустите Go приложение (для тестирования):
   ```bash
   cd D:/Projects/Brows_vpn/proxy-service
   browsvpn-proxy.exe --native-messaging
   ```

2. Загрузите расширение в Chrome:
   - Откройте `chrome://extensions/`
   - Включите "Режим разработчика"
   - Нажмите "Загрузить распакованное расширение"
   - Выберите папку `D:\Projects/Brows_vpn\extension`

3. Откройте консоль расширения:
   - В chrome://extensions/ найдите Brows VPN
   - Нажмите "Ошибка просмотра страницы" (фоновая страница)
   - Проверьте на наличие ошибок native messaging

## Устранение неполадок

### Ошибка: "Native messaging host not found"

**Причины:**
1. Путь к exe-файлу неверный
2. Exe-файл не существует
3. Registry ключ не создан правильно

**Решения:**
1. Проверьте путь в реестре
2. Убедитесь, что exe-файл существует по указанному пути
3. Перезапустите Chrome после изменения реестра

### Ошибка: "Failed to connect to native messaging host"

**Причины:**
1. Go приложение не запущено
2. Приложение не поддерживает native messaging режим
3. Firewall блокирует соединение

**Решения:**
1. Запустите `browsvpn-proxy.exe --native-messaging`
2. Проверьте логи приложения
3. Проверьте настройки firewall

## Удаление конфигурации

Для удаления native messaging host:

```batch
@echo off
reg delete "HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host" /f
echo Native messaging host configuration removed
pause
```

Или вручную через regedit:
1. Откройте regedit
2. Перейдите к `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\`
3. Удалите ключ `com.browsvpn.host`