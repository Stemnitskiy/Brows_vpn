@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-clean-archive.ps1" %*
set "ERR=%ERRORLEVEL%"
if %ERR% NEQ 0 exit /b %ERR%
endlocal
