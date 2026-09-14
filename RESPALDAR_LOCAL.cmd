@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0backend\.venv\Scripts\python.exe" (
    echo ERROR: Falta backend\.venv. Completa primero la instalacion de dependencias.
    pause
    exit /b 1
)
"%~dp0backend\.venv\Scripts\python.exe" "%~dp0backend\backup.py"
set "CALIDAD_EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%CALIDAD_EXIT_CODE%"=="0" echo El respaldo no se completo. Comprueba que PostgreSQL este iniciado.
pause
exit /b %CALIDAD_EXIT_CODE%
