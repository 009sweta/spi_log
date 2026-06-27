@echo off
title SPU Log Analyzer
chcp 65001 >nul 2>&1

set "APP_DIR=%~dp0app"
set "PYTHON_CMD="

REM Find a working Python command (same detection order as installer)
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

REM No Python found — direct user to the full installer
cls
echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║   Python was not found on this system.                    ║
echo   ║                                                            ║
echo   ║   Please run "Install_and_Run.bat" instead — it will       ║
echo   ║   automatically install Python and all required packages.  ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.
pause
exit /b 1

:found
REM Quick package check — if missing, redirect to full installer
%PYTHON_CMD% -c "import pandas, openpyxl" >nul 2>&1
if %errorlevel% neq 0 (
    cls
    echo.
    echo   ╔══════════════════════════════════════════════════════════╗
    echo   ║   Required packages are missing.                          ║
    echo   ║                                                            ║
    echo   ║   Please run "Install_and_Run.bat" instead — it will       ║
    echo   ║   automatically install the missing packages.              ║
    echo   ╚══════════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

if not exist "%APP_DIR%\spu_log_analyzer.py" (
    echo   ERROR: Application file not found at %APP_DIR%\spu_log_analyzer.py
    pause
    exit /b 1
)

start "" %PYTHON_CMD% "%APP_DIR%\spu_log_analyzer.py"
exit /b 0
