# Claude Code + Gemini 3.8 Flash Automated Setup Script
# Works on Windows PowerShell 5.1+ and PowerShell 7+

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Claude Code + Gemini 3.8 Flash Bridge Setup & Installer   " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$baseDir = Split-Path -Parent $PSScriptRoot
$userProfile = [System.Environment]::GetFolderPath("UserProfile")
$desktopPath = [System.Environment]::GetFolderPath("Desktop")
$claudeDir = Join-Path $userProfile ".claude"
$settingsPath = Join-Path $claudeDir "settings.json"
$configDir = Join-Path $userProfile ".config\antigravity-proxy"
$configFile = Join-Path $configDir "config.json"
$localBin = Join-Path $userProfile ".local\bin"

# 1. Check Node.js
Write-Host "[1/7] Verifying Node.js..." -ForegroundColor Cyan
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Node.js not found in PATH." -ForegroundColor Red
    Write-Host "    Please install Node.js (v18+) from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}
$nodeVer = node -v
Write-Host "      Found Node.js $nodeVer" -ForegroundColor Green

# 2. Check Claude Code CLI
Write-Host "[2/7] Checking Claude Code CLI..." -ForegroundColor Cyan
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if (!$claudeCmd) {
    Write-Host "      Claude Code CLI not found. Installing globally via npm..." -ForegroundColor Yellow
    npm install -g @anthropic-ai/claude-code
} else {
    Write-Host "      Claude Code CLI is installed." -ForegroundColor Green
}

# 3. Configure Proxy Port
Write-Host "[3/7] Setting up proxy configuration on port 8085..." -ForegroundColor Cyan
if (!(Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}
$proxyConfig = @{
    port = 8085
    strategy = "hybrid"
    maxRetries = 5
}
$proxyConfig | ConvertTo-Json | Set-Content -Path $configFile -Encoding utf8
Write-Host "      Saved proxy configuration to $configFile" -ForegroundColor Green

# 4. Configure Claude Code settings.json
Write-Host "[4/7] Configuring Claude Code settings with Gemini 3.8 Flash..." -ForegroundColor Cyan
if (!(Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}

$settingsObj = @{}
if (Test-Path $settingsPath) {
    try {
        $raw = Get-Content $settingsPath -Raw | ConvertFrom-Json
        foreach ($prop in $raw.PSObject.Properties) {
            if ($prop.Value -is [System.Management.Automation.PSCustomObject]) {
                $inner = @{}
                foreach ($p in $prop.Value.PSObject.Properties) { $inner[$p.Name] = $p.Value }
                $settingsObj[$prop.Name] = $inner
            } else {
                $settingsObj[$prop.Name] = $prop.Value
            }
        }
    } catch {
        $settingsObj = @{}
    }
}
$settingsObj["model"] = "gemini-3.8-flash-high"
if (!$settingsObj["env"]) {
    $settingsObj["env"] = @{}
}
$settingsObj["env"]["ANTHROPIC_BASE_URL"] = "http://localhost:8085"
$settingsObj["env"]["ANTHROPIC_API_KEY"] = "dummy"
$settingsObj["env"]["ANTHROPIC_AUTH_TOKEN"] = $null
$settingsObj["env"]["ANTHROPIC_MODEL"] = "gemini-3.8-flash-high"
$settingsObj["env"]["ANTHROPIC_DEFAULT_OPUS_MODEL"] = "gemini-3.8-flash-high"
$settingsObj["env"]["ANTHROPIC_DEFAULT_SONNET_MODEL"] = "gemini-3.8-flash-high"
$settingsObj["env"]["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = "gemini-3.8-flash-low"
$settingsObj["env"]["CLAUDE_CODE_SUBAGENT_MODEL"] = "gemini-3.8-flash-high"
$settingsObj["env"]["ENABLE_EXPERIMENTAL_MCP_CLI"] = "true"
if (!$settingsObj["theme"]) { $settingsObj["theme"] = "dark" }
if (!$settingsObj["autoUpdatesChannel"]) { $settingsObj["autoUpdatesChannel"] = "latest" }

$settingsObj | ConvertTo-Json -Depth 5 | Set-Content -Path $settingsPath -Encoding utf8
Write-Host "      Updated $settingsPath" -ForegroundColor Green

# 5. Configure Windows Environment Variables
Write-Host "[5/7] Registering system environment variables..." -ForegroundColor Cyan
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "http://localhost:8085", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "dummy", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", $null, "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", "gemini-3.8-flash-high", "User")

# Add localBin to PATH if not already
if (!(Test-Path $localBin)) {
    New-Item -ItemType Directory -Path $localBin -Force | Out-Null
}
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$localBin*") {
    [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$localBin", "User")
}
# Copy claude-gemini.cmd into localBin
$cmdContent = Get-Content "$baseDir\bin\claude-gemini.cmd" -Raw
$startProxyPath = "$baseDir\scripts\start-proxy.cmd"
$cmdContent = $cmdContent.Replace('"%~dp0..\scripts\start-proxy.cmd"', "`"$startProxyPath`"")
Set-Content -Path "$localBin\claude-gemini.cmd" -Value $cmdContent -Encoding ascii
Write-Host "      Installed claude-gemini command in PATH ($localBin)" -ForegroundColor Green

# 6. Create Desktop Launcher
Write-Host "[6/7] Creating desktop shortcut..." -ForegroundColor Cyan
$launcherPath = Join-Path $desktopPath "Launch Claude Code (Gemini).bat"
$launcherContent = @"
@echo off
title Claude Code (Gemini 3.8 Flash)
cls
call "$localBin\claude-gemini.cmd"
pause
"@
Set-Content -Path $launcherPath -Value $launcherContent -Encoding ascii
Write-Host "      Created shortcut: $launcherPath" -ForegroundColor Green

# 7. Start / Restart Proxy Service
Write-Host "[7/7] Launching proxy background service..." -ForegroundColor Cyan
& "$baseDir\scripts\stop-proxy.cmd" | Out-Null
Start-Sleep -Seconds 1
& "$baseDir\scripts\start-proxy.cmd"
Start-Sleep -Seconds 2

# Check accounts
$accountsJson = Join-Path $configDir "accounts.json"
$accountsCount = 0
if (Test-Path $accountsJson) {
    try {
        $accData = Get-Content $accountsJson -Raw | ConvertFrom-Json
        $accountsCount = ($accData.accounts).Count
    } catch { }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "             SETUP COMPLETED SUCCESSFULLY!                  " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

if ($accountsCount -eq 0) {
    Write-Host "[!] One final step: Link your Google Account." -ForegroundColor Yellow
    Write-Host "    Opening the proxy dashboard at http://localhost:8085/" -ForegroundColor Yellow
    Write-Host "    Click 'Add Your First Account' -> 'Connect Google Account' to authenticate." -ForegroundColor Yellow
    Start-Process "http://localhost:8085/"
} else {
    Write-Host "[*] Detected $accountsCount linked Google account(s)." -ForegroundColor Green
    Write-Host "    You are ready to launch Claude Code with Gemini 3.8 Flash!" -ForegroundColor Green
}

Write-Host ""
Write-Host "How to run:" -ForegroundColor Cyan
Write-Host "  1. CLI command: claude-gemini" -ForegroundColor White
Write-Host "  2. Desktop shortcut: Double-click 'Launch Claude Code (Gemini).bat'" -ForegroundColor White
Write-Host ""
