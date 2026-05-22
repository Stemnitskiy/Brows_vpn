@echo off
set KEY_PATH=HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host
set EXE_PATH=%~dp0browsvpn-proxy.exe

echo Adding native messaging host configuration for Brows VPN...
echo.
echo Registry Path: %KEY_PATH%
echo Executable Path: %EXE_PATH%
echo.

reg add "%KEY_PATH%" /ve /t REG_SZ /d "%EXE_PATH%" /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Native messaging host configured successfully!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Build the Go application: go build -o browsvpn-proxy.exe ./cmd
    echo 2. Load the extension in Chrome
    echo 3. Test the connection
) else (
    echo.
    echo ========================================
    echo Failed to configure native messaging host
    echo ========================================
    echo.
    echo Error code: %ERRORLEVEL%
    echo Please run this script as Administrator
)

echo.
pause