@echo off
setlocal

set "MANIFEST=%~dp0com.browsvpn.host.json"
set "KEY_PATH=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host"

echo Brows VPN - Native Messaging Host Setup
echo.
echo Manifest: %MANIFEST%
echo Registry: %KEY_PATH%
echo.

if not exist "%MANIFEST%" (
    echo ERROR: Manifest not found: %MANIFEST%
    exit /b 1
)

reg add "%KEY_PATH%" /ve /t REG_SZ /d "%MANIFEST%" /f >nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to write registry key.
    exit /b 1
)

echo Native messaging host registered successfully.
echo.
echo Next steps:
echo   1. go build -o browsvpn-proxy.exe ./cmd
echo   2. Load extension in Chrome and copy its Extension ID
echo   3. Run: powershell -File update_allowed_origins.ps1 -ExtensionId YOUR_ID
echo   4. Restart Chrome
echo.

endlocal
