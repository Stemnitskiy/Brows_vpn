@echo off
setlocal
cd /d "%~dp0"

echo Building Brows VPN proxy service...
go build -o browsvpn-proxy.exe ./cmd
if %ERRORLEVEL% NEQ 0 (
    echo BUILD FAILED
    exit /b 1
)

if not exist "xray-core\xray.exe" (
    echo.
    echo WARNING: xray-core\xray.exe not found.
    echo Download from https://github.com/XTLS/Xray-core/releases
    echo.
)

echo.
echo OK: browsvpn-proxy.exe ready
echo Chrome will launch it automatically when you click Enable VPN.
echo No need to run browsvpn-proxy.exe manually.
echo.
endlocal
