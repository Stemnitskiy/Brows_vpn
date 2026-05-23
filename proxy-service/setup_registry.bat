@echo off
setlocal
cd /d "%~dp0"
call "%~dp0install.bat" %*
endlocal & exit /b %ERRORLEVEL%
