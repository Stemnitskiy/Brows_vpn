@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Build -OpenExtensionsPage %*
set "ERR=%ERRORLEVEL%"
endlocal & exit /b %ERR%
