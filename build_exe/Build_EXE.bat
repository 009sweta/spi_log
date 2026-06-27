@echo off
title Build SPU_Log_Analyzer.exe
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║         Building SPU_Log_Analyzer.exe                     ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.

REM ── Check Python ────────────────────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ✖  Python not found. Please install Python from python.org
    echo      before running this build script.
    pause
    exit /b 1
)

echo   [1/3] Installing build dependencies...
python -m pip install --quiet --disable-pip-version-check pyinstaller pandas openpyxl chardet
if %errorlevel% neq 0 (
    echo   ✖  Failed to install dependencies. Check your internet connection.
    pause
    exit /b 1
)
echo   ✔  Dependencies installed.
echo.

echo   [2/3] Running PyInstaller ^(this takes 1-3 minutes^)...
echo.

REM Build without the icon line if app_icon.ico doesn't exist, to avoid
REM a hard failure for users who didn't add a custom icon.
if not exist "app_icon.ico" (
    echo   ⚠  No app_icon.ico found — building without custom icon.
    python -m PyInstaller --noconfirm --clean ^
        --name "SPU_Log_Analyzer" ^
        --windowed ^
        --version-file "version_info.txt" ^
        --hidden-import pandas ^
        --hidden-import openpyxl ^
        --hidden-import chardet ^
        --hidden-import tkinter ^
        "../app/spu_log_analyzer.py"
) else (
    python -m PyInstaller spu_analyzer.spec --noconfirm --clean
)

if %errorlevel% neq 0 (
    echo.
    echo   ✖  Build failed. See BUILD_INSTRUCTIONS.txt for troubleshooting.
    pause
    exit /b 1
)

echo.
echo   [3/3] Build complete!
echo.
echo   ════════════════════════════════════════════════════════════
echo    Your standalone exe is ready at:
echo.
echo      %~dp0dist\SPU_Log_Analyzer.exe
echo.
echo    This file can be copied to ANY Windows PC and run directly
echo    — no Python installation required on the target machine.
echo   ════════════════════════════════════════════════════════════
echo.
pause
exit /b 0
