# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private vulnerability reporting ("Security" tab -> "Report a vulnerability") on this repository. Include steps to reproduce, affected version and impact. Never include real tokens, passwords or account files in a report.

You can expect an acknowledgement within a few days. Fixes are released as soon as practical and credited unless you prefer otherwise.

## Supported versions

Only the latest release and the `main` branch receive security fixes.

## Scope

In scope: the local proxy (`src/proxy`), the dashboard, the Windows scripts and the installer.

Out of scope: Google's Cloud Code API and OAuth service, Claude Code itself, and issues that require an attacker who already has local access to your user account or to `~/.config/antigravity-proxy`.

## Design notes

- The proxy binds to `127.0.0.1` by default; non-local Host and Origin headers are rejected.
- Set `WEBUI_PASSWORD` and `API_KEY` if you expose the port beyond localhost.
- Tokens and account files are stored with owner-only permissions and must never be committed.
