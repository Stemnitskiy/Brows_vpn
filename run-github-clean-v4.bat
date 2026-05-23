@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%prepare-github-clean-v4.ps1" -ProjectPath "%CD%" -DropNoisyDocs -Force
pause
