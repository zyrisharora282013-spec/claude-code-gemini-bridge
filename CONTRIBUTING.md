# Contributing

1. Fork and create a branch from `main`.
2. `cd src/proxy && npm install && npm test` — all tests must pass.
3. If you touch CSS sources, run `npm run build:css`.
4. Keep commits small and explain the root cause of a fix in the commit message. Add a `node:test` test in `src/proxy/tests` where possible.
5. Never commit tokens, passwords, API keys, `accounts.json` or anything from `~/.config/antigravity-proxy`.
6. Open a pull request using the template. Security issues: see [SECURITY.md](SECURITY.md).
