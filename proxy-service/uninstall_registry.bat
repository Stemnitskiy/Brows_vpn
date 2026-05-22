@echo off
set KEY_PATH=HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.browsvpn.host

echo Removing native messaging host configuration for Brows VPN...
echo.
echo Registry Path: %KEY_PATH%
echo.

reg delete "%KEY_PATH%" /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Native messaging host configuration removed!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Failed to remove configuration
    echo ========================================
    echo.
    echo Error code: %ERRORLEVEL%
    echo The key may not exist
)

echo.
pause