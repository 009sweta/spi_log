@echo off
setlocal EnableDelayedExpansion
title SPU Log Analyzer - Setup
color 0B
chcp 65001 >nul 2>&1

set "APP_DIR=%~dp0app"
set "PY_INSTALLER_URL=https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe"
set "PY_INSTALLER_FILE=%TEMP%\python-3.12.7-installer.exe"
set "MIN_PY_VERSION=3.8"
set "LOGFILE=%~dp0install_log.txt"

echo. > "%LOGFILE%"
call :log "===================================================="
call :log " SPU Log Analyzer - Installation started"
call :log "===================================================="

cls
echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║                                                            ║
echo   ║              ⚡  SPU LOG ANALYZER  ⚡                      ║
echo   ║         Setup ^& Installation Wizard                       ║
echo   ║                                                            ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.
echo   This wizard will:
echo     1. Check if Python is installed on your system
echo     2. Install Python automatically if it is missing
echo     3. Install required packages (pandas, openpyxl, chardet, pypdf)
echo     4. Launch the SPU Log Analyzer application
echo.
echo   ────────────────────────────────────────────────────────────
echo.
pause
cls

REM ============================================================
REM  STEP 1 — Check for existing Python installation
REM ============================================================
echo.
echo   [1/4]  Checking for Python installation...
echo   ────────────────────────────────────────────────────────────
call :log "[STEP 1] Checking for Python installation"

set "PYTHON_CMD="
set "PYTHON_FOUND=0"

REM Try 'python' command
python --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
    call :check_version "!PY_VER!"
    if !VERSION_OK! equ 1 (
        set "PYTHON_CMD=python"
        set "PYTHON_FOUND=1"
        echo   ✔  Found Python !PY_VER! ^(command: python^)
        call :log "Found Python !PY_VER! via 'python' command"
    )
)

REM Try 'py' launcher if 'python' didn't work
if !PYTHON_FOUND! equ 0 (
    py --version >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=2" %%v in ('py --version 2^>^&1') do set "PY_VER=%%v"
        call :check_version "!PY_VER!"
        if !VERSION_OK! equ 1 (
            set "PYTHON_CMD=py"
            set "PYTHON_FOUND=1"
            echo   ✔  Found Python !PY_VER! ^(command: py^)
            call :log "Found Python !PY_VER! via 'py' launcher"
        )
    )
)

REM Try python3 command
if !PYTHON_FOUND! equ 0 (
    python3 --version >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=2" %%v in ('python3 --version 2^>^&1') do set "PY_VER=%%v"
        call :check_version "!PY_VER!"
        if !VERSION_OK! equ 1 (
            set "PYTHON_CMD=python3"
            set "PYTHON_FOUND=1"
            echo   ✔  Found Python !PY_VER! ^(command: python3^)
            call :log "Found Python !PY_VER! via 'python3' command"
        )
    )
)

if !PYTHON_FOUND! equ 0 (
    echo   ✖  Python not found ^(or version too old^)
    echo.
    echo   ────────────────────────────────────────────────────────────
    echo   [2/4]  Downloading and installing Python 3.12.7...
    echo   ────────────────────────────────────────────────────────────
    call :log "[STEP 2] Python not found - downloading installer"
    echo.
    echo   This may take a few minutes depending on your internet speed.
    echo   Please do not close this window.
    echo.

    REM Try downloading with PowerShell (most reliable on Win10/11)
    echo   Downloading Python installer ^(~28 MB^)...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%PY_INSTALLER_URL%' -OutFile '%PY_INSTALLER_FILE%' -UseBasicParsing } catch { exit 1 } }"

    if not exist "%PY_INSTALLER_FILE%" (
        echo.
        echo   ✖  ERROR: Could not download Python installer.
        echo      Please check your internet connection and try again,
        echo      or install Python manually from https://python.org
        echo.
        call :log "ERROR: Python download failed"
        pause
        exit /b 1
    )

    echo   ✔  Download complete.
    echo.
    echo   Installing Python ^(this will take 1-2 minutes^)...
    echo   A Python installer window may briefly appear — this is normal.
    call :log "Running Python installer silently"

    REM Silent install: for all users, add to PATH, include pip
    "%PY_INSTALLER_FILE%" /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1 Include_test=0 SimpleInstall=1

    REM Wait for install to settle and refresh PATH for this session
    timeout /t 5 /nobreak >nul

    REM Refresh PATH in current session by re-reading from registry
    for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
    set "PATH=%SYS_PATH%;%USR_PATH%;%PATH%"

    REM Verify installation
    python --version >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=python"
        set "PYTHON_FOUND=1"
        echo   ✔  Python installed successfully!
        call :log "Python installed successfully"
    ) else (
        py --version >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_CMD=py"
            set "PYTHON_FOUND=1"
            echo   ✔  Python installed successfully!
            call :log "Python installed successfully (py launcher)"
        ) else (
            echo.
            echo   ⚠  Python was installed but is not yet visible in PATH.
            echo      Please CLOSE this window, then re-run Install_and_Run.bat
            echo      ^(this refreshes your PATH so Python can be found^).
            echo.
            call :log "WARNING: Python installed but not found in PATH - needs restart"
            pause
            exit /b 0
        )
    )

    REM Clean up installer file
    del "%PY_INSTALLER_FILE%" >nul 2>&1
) else (
    echo.
    echo   ────────────────────────────────────────────────────────────
    echo   [2/4]  Python already installed — skipping installation
    echo   ────────────────────────────────────────────────────────────
    call :log "[STEP 2] Skipped - Python already present"
)

echo.
echo   ────────────────────────────────────────────────────────────
echo   [3/4]  Installing required packages...
echo   ────────────────────────────────────────────────────────────
call :log "[STEP 3] Installing pip packages"
echo.
echo   Installing: pandas, openpyxl, chardet, pypdf
echo   ^(this may take 1-3 minutes on first run^)
echo.

REM Upgrade pip first (quietly, ignore failures)
!PYTHON_CMD! -m pip install --upgrade pip --quiet --disable-pip-version-check >nul 2>&1

REM Install required packages — show progress, don't hide errors
!PYTHON_CMD! -m pip install --quiet --disable-pip-version-check pandas openpyxl chardet pypdf
if !errorlevel! neq 0 (
    echo   ⚠  Standard install failed, retrying with --user flag...
    call :log "Standard pip install failed, retrying with --user"
    !PYTHON_CMD! -m pip install --user --quiet --disable-pip-version-check pandas openpyxl chardet pypdf
)

REM Best-effort: install truststore so the AI Assistant feature can fall back
REM to the Windows certificate store on company laptops with SSL-inspecting
REM proxies. Not required for Python < 3.10 or if offline, so failures here
REM are ignored.
!PYTHON_CMD! -m pip install --quiet --disable-pip-version-check truststore >nul 2>&1

REM Verify packages installed correctly
!PYTHON_CMD! -c "import pandas, openpyxl, chardet, pypdf" >nul 2>&1
if !errorlevel! equ 0 (
    echo   ✔  All packages installed successfully!
    call :log "All packages verified successfully"
) else (
    echo   ⚠  Some packages may not have installed correctly.
    echo      The app will attempt to run anyway.
    call :log "WARNING: Package verification failed"
)

REM Check tkinter (bundled with Python but verify anyway)
!PYTHON_CMD! -c "import tkinter" >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo   ⚠  WARNING: tkinter ^(GUI library^) not found.
    echo      This is unusual for a standard Python install.
    echo      If the app fails to launch, please reinstall Python.
)

REM ============================================================
REM  OPTIONAL STEP — Setup Local AI (Ollama + Models)
REM ============================================================
echo.
echo   ────────────────────────────────────────────────────────────
echo   [OPTIONAL]  Setup Local AI (Ollama + Models)
echo   ────────────────────────────────────────────────────────────
call :log "Ollama check started"

set "INSTALL_OLLAMA=N"
ollama --version >nul 2>&1
if !errorlevel! equ 0 (
    echo   ✔  Ollama is already installed!
    set "OLLAMA_FOUND=1"
    goto :ollama_pull
)

set "OLLAMA_PATH_TEST=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if exist "!OLLAMA_PATH_TEST!" (
    echo   ✔  Ollama found in !OLLAMA_PATH_TEST!
    set "PATH=!LOCALAPPDATA!\Programs\Ollama;!PATH!"
    set "OLLAMA_FOUND=1"
    goto :ollama_pull
)

echo   Ollama (Local AI service) was not found. Installing it lets you
echo   run the Knowledge Base assistant entirely offline on your laptop
echo   without needing external API keys (uses Tess + Nomic Embed).
echo.
set /p "CHOICE_OLLAMA=Do you want to download and install Ollama silently? (y/n) [n]: "
if /i "!CHOICE_OLLAMA!"=="y" (
    set "INSTALL_OLLAMA=Y"
)

if /i "!INSTALL_OLLAMA!"=="Y" (
    echo.
    echo   Downloading Ollama Setup (~280 MB)...
    call :log "Downloading Ollama Setup"
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile '%TEMP%\OllamaSetup.exe' -UseBasicParsing } catch { exit 1 } }"
    
    if not exist "%TEMP%\OllamaSetup.exe" (
        echo   ✖  ERROR: Could not download Ollama installer. Skipping.
        call :log "ERROR: Ollama download failed"
        goto :launch_app
    )
    
    echo   Installing Ollama silently...
    call :log "Installing Ollama silently"
    "%TEMP%\OllamaSetup.exe" /silent
    del "%TEMP%\OllamaSetup.exe" >nul 2>&1
    
    REM Add to current session path
    set "PATH=!LOCALAPPDATA!\Programs\Ollama;!PATH!"
    set "OLLAMA_FOUND=1"
    
    REM Refresh path in registry just in case
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
    set "PATH=%PATH%;!USR_PATH!"
    
    echo   ✔  Ollama installed successfully!
) else (
    echo   Skipping Local AI setup.
    goto :launch_app
)

:ollama_pull
REM Ensure Ollama background service is running
call :log "Checking if Ollama service is running"
netstat -ano | findstr 11434 >nul 2>&1
if !errorlevel! neq 0 (
    echo   Starting Ollama background service...
    start /b "" ollama serve >nul 2>&1
    timeout /t 5 /nobreak >nul
)

echo.
echo   Pulling local AI models. This may take a few minutes...
echo   ------------------------------------------------------------
call :log "Pulling nomic-embed-text"
echo   Pulling embedding model: nomic-embed-text (~270 MB)...
ollama pull nomic-embed-text

call :log "Pulling 01rohitkumar0104/tess"
echo   Pulling chat model: 01rohitkumar0104/tess...
ollama pull 01rohitkumar0104/tess

REM Automatically configure .env file to use Ollama
echo.
echo   Configuring .env file for local model execution...
call :log "Updating .env for Ollama"

echo import os > "%TEMP%\update_env.py"
echo from pathlib import Path >> "%TEMP%\update_env.py"
echo env_path = Path(r'%~dp0.env') >> "%TEMP%\update_env.py"
echo updates = {'GROQ_API_KEY': 'ollama', 'OPENROUTER_API_KEY': 'ollama', 'GROQ_MODEL': '01rohitkumar0104/tess', 'OLLAMA_EMBED_MODEL': 'nomic-embed-text', 'OLLAMA_HOST': 'http://localhost:11434'} >> "%TEMP%\update_env.py"
echo values = {} >> "%TEMP%\update_env.py"
echo if env_path.exists(): >> "%TEMP%\update_env.py"
echo     for line in env_path.read_text(encoding='utf-8').splitlines(): >> "%TEMP%\update_env.py"
echo         if '=' in line and not line.strip().startswith('#'): >> "%TEMP%\update_env.py"
echo             k, v = line.split('=', 1) >> "%TEMP%\update_env.py"
echo             values[k.strip()] = v.strip() >> "%TEMP%\update_env.py"
echo values.update(updates) >> "%TEMP%\update_env.py"
echo env_path.write_text('\n'.join(f'{k}={v}' for k, v in values.items()) + '\n', encoding='utf-8') >> "%TEMP%\update_env.py"

!PYTHON_CMD! "%TEMP%\update_env.py"
del "%TEMP%\update_env.py" >nul 2>&1

echo   ✔  Local AI configured successfully!

:launch_app
echo.
echo   ────────────────────────────────────────────────────────────
echo   [4/4]  Launching SPU Log Analyzer...
echo   ────────────────────────────────────────────────────────────
call :log "Launching app"
start "" !PYTHON_CMD! "%APP_DIR%\web_server.py"
exit /b 0

:log
echo [%date% %time%] %~1 >> "%LOGFILE%"
exit /b 0


REM ============================================================
REM  Helper: check if a version string meets MIN_PY_VERSION (3.8)
REM  Sets VERSION_OK=1 if OK, 0 if not
REM ============================================================
:check_version
set "VCHECK=%~1"
set "VERSION_OK=0"
for /f "tokens=1,2 delims=." %%a in ("%VCHECK%") do (
    set "VMAJOR=%%a"
    set "VMINOR=%%b"
)
if not defined VMAJOR set "VMAJOR=0"
if not defined VMINOR set "VMINOR=0"
if !VMAJOR! GTR 3 set "VERSION_OK=1"
if !VMAJOR! EQU 3 if !VMINOR! GEQ 8 set "VERSION_OK=1"
exit /b 0
