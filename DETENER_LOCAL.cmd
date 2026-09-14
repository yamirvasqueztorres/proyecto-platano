@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-local.ps1"
set "CALIDAD_EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %CALIDAD_EXIT_CODE%
