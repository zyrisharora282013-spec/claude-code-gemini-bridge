@echo off
setlocal

echo [*] Stopping Antigravity Gemini Proxy service...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8085 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] Stopped process PID %%a
)

set PID_FILE=%USERPROFILE%\.config\antigravity-proxy\server.pid
if exist "%PID_FILE%" del /f /q "%PID_FILE%"
echo [OK] Proxy service is offline.
