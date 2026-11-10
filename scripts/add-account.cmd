@echo off
setlocal

echo ===================================================
echo     Link Google Account for Gemini Claude Bridge
echo ===================================================
echo.

:: Ensure proxy is running
curl -s http://localhost:8085/health >nul 2>&1
if errorlevel 1 (
    echo [*] Starting bridge service...
    call "%~dp0start-proxy.cmd"
    timeout /t 2 /nobreak >nul
)

echo [*] Opening authorization dashboard in your browser...
start http://localhost:8085/

echo.
echo Instructions:
echo  1. In the opened browser window, click "Add Your First Account" (or "Add Account").
echo  2. Click "Connect Google Account".
echo  3. Sign in and grant permission.
echo  4. Once confirmed, your Gemini model is ready to use!
echo.
pause
