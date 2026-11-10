# Changelog

## Unreleased (branch `security-and-fixes`)

### Security
- Pinned CDN library versions (chart.js 4.4.7, alpinejs 3.14.8).
- Replaced `x-html` with `x-text` to prevent XSS; fixed DOM XSS in the view-loader error handler.
- Replaced browser `prompt()`/`confirm()` with in-page modals (password is no longer shown in a plain prompt).
- Added Content-Security-Policy, X-Content-Type-Options, Referrer-Policy and X-Frame-Options headers.
- Log stream now uses a one-time token instead of putting the dashboard password in the URL.
- Rate limiting and lockout (5 failures / 15 min, HTTP 429) for wrong dashboard passwords.
- `WEBUI_PASSWORD` is stored hashed (scrypt) with automatic migration from plain text.
- Email addresses are masked in logs.
- Added CodeQL workflow and 58 API auth tests.

### Fixed
- Tool results now use the function name (not the tool_use id) in `functionResponse`.
- `stop_reason` is `tool_use` when Gemini returns tool calls with a STOP finish reason.
- Session ID is passed on 5xx retries during empty-response recovery.
- Fragile `includes('400')` error detection replaced with a specific prefix match.
- Whitespace-only text blocks are no longer dropped.
- Dashboard clock ticks live; log stream reconnect uses backoff and a retry cap; OAuth re-auth is detected.
- Windows: `setup.ps1` PowerShell 5.1 compatibility, `start-proxy.cmd` health check, installer no longer swallows errors or silently overwrites settings.

### Changed
- `Installer.exe` is no longer committed; it is built by CI on `v*` tags and published with a SHA-256 checksum.
- README documents overriding the bundled Google OAuth client.
