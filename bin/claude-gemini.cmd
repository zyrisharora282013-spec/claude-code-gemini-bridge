@echo off
setlocal

:: Claude Code + Gemini 3.8 Flash CLI Launcher
:: Ensure port 8085 proxy is online
curl -s http://localhost:8085/health >nul 2>&1
if errorlevel 1 (
    echo [*] Starting Antigravity Gemini Proxy service on port 8085...
    if exist "%~dp0..\scripts\start-proxy.cmd" (
        call "%~dp0..\scripts\start-proxy.cmd"
    ) else if exist "%USERPROFILE%\.claude-gemini-bridge\scripts\start-proxy.cmd" (
        call "%USERPROFILE%\.claude-gemini-bridge\scripts\start-proxy.cmd"
    ) else if exist "%APPDATA%\npm\node_modules\antigravity-claude-proxy\src\index.js" (
        start "" /b node "%APPDATA%\npm\node_modules\antigravity-claude-proxy\src\index.js" > "%USERPROFILE%\.config\antigravity-proxy\server.log" 2>&1
    )
    timeout /t 2 /nobreak >nul
)

:: Clear conflicting auth tokens
set ANTHROPIC_AUTH_TOKEN=

:: Route Claude Code through local Gemini proxy
set ANTHROPIC_BASE_URL=http://localhost:8085
set ANTHROPIC_API_KEY=dummy
set ANTHROPIC_MODEL=gemini-3.8-flash-high
set ANTHROPIC_DEFAULT_OPUS_MODEL=gemini-3.8-flash-high
set ANTHROPIC_DEFAULT_SONNET_MODEL=gemini-3.8-flash-high
set ANTHROPIC_DEFAULT_HAIKU_MODEL=gemini-3.8-flash-low
set CLAUDE_CODE_SUBAGENT_MODEL=gemini-3.8-flash-high

:: Execute Claude Code
if exist "%USERPROFILE%\.local\bin\claude.exe" (
    "%USERPROFILE%\.local\bin\claude.exe" %*
) else (
    claude %*
)
