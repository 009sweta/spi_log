@echo off
title SPU Log Analyzer Web UI
chcp 65001 >nul 2>&1

set "APP_DIR=%~dp0app"
set "PYTHON_CMD="

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
    goto :found
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=py"
    goto :found
)

python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python3"
    goto :found
)

cls
echo.
echo   Python was not found on this system.
echo   Run Install_and_Run.bat first, or use the standalone EXE build.
echo.
pause
exit /b 1

:found
%PYTHON_CMD% -c "import pandas, openpyxl, chardet, pypdf" >nul 2>&1
if %errorlevel% neq 0 (
    cls
    echo.
    echo   Required Python packages are missing.
    echo   Run Install_and_Run.bat first so pandas and openpyxl are installed.
    echo.
    pause
    exit /b 1
)

if not exist "%APP_DIR%\web_server.py" (
    echo   ERROR: Web server file not found at %APP_DIR%\web_server.py
    pause
    exit /b 1
)

echo.
echo   Starting SPU Log Analyzer Web UI without Node.js...
echo   Browser URL: http://127.0.0.1:8080
echo   Keep this window open while using the web UI.
echo.

%PYTHON_CMD% "%APP_DIR%\web_server.py"
pause
