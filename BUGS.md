# BUGS.md — Dashboard Audit (Phase 0.2)

Prioritised list of bugs, layout issues, and security concerns found by
source-code audit of the Antigravity Console web UI.

Priority key: **P0** = security / data-loss, **P1** = broken functionality,
**P2** = incorrect display, **P3** = cosmetic / DX.

> **Status (Nov 2026):** most items below were already fixed in the code. Fixed in the latest pass: #12 (Redact fallback), #14 (version label no longer flashes "1.0.0"), #22 (safe translation fallback). Items #13 (slider formulas) and #20 (mobile backdrop) were re-checked and are correct as-is. Remaining items are cosmetic.

---

## P0 — Security

### 1. CDN libraries loaded without version pins
**File:** `src/proxy/public/index.html` lines 11-13
- `chart.js` — no version at all (`cdn.jsdelivr.net/npm/chart.js`)
- `alpinejs` — wildcard version (`alpinejs@3.x.x`)

A CDN compromise or breaking update can silently inject malicious code.
Pin to exact versions (e.g. `chart.js@4.4.7`, `alpinejs@3.14.8`).

### 2. `x-html` renders unsanitised translation string (potential XSS)
**File:** `src/proxy/public/views/accounts.html` line 285
```html
<span x-html="$store.global.t('disabledAccountsNote')"></span>
```
If a translation value contains HTML (or is ever sourced from user input /
server), this executes arbitrary markup. Use `x-text` instead, or sanitise
the value before rendering.

### 3. `prompt()` used for password entry
**File:** `src/proxy/public/js/utils.js` line 17
```js
const password = prompt(store ? store.t('enterPassword') : 'Enter Web UI Password:');
```
`prompt()` exposes the typed password in plain text (no masking) and can be
spoofed via page injection. Replace with a proper password modal that uses
`<input type="password">`.

### 4. `confirm()` used for destructive actions
**Files:**
- `src/proxy/public/js/components/claude-config.js` line 406
- `src/proxy/public/js/components/server-config.js` line 660

Browser `confirm()` dialogs cannot be styled, are trivially bypassable via
automation, and in some environments (headless, extensions) are suppressed.
Use in-app confirmation modals (the codebase already has `delete_account_modal`
as a good pattern).

### 5. No Content-Security-Policy header
The server does not set a `Content-Security-Policy` header. Any injected
script (via XSS or CDN compromise) runs with full page privileges. Add at
minimum a `script-src` directive that whitelists only the two CDN origins and
`'self'`.

### 6. Log stream password sent as query parameter
**File:** `src/proxy/public/js/components/logs-viewer.js` line 72
```js
const url = password
    ? `/api/logs/stream?password=${encodeURIComponent(password)}`
    : '/api/logs/stream?history=true';
```
The WebUI password appears in the URL, which is logged by proxies, browser
history, and server access logs. Send it via an `EventSource`-compatible
header or use a short-lived token exchange.

---

## P1 — Broken Functionality

### 7. Dashboard clock is static — never updates
**File:** `src/proxy/public/views/dashboard.html` line 26
The "Last Updated" timestamp calls `$store.data.lastUpdated` which is set
once per fetch cycle, but the rendered time itself never ticks live. It looks
frozen between poll intervals. Either refresh the display every second or
label it clearly as "Last Fetched".

### 8. EventSource reconnects infinitely on auth failure
**File:** `src/proxy/public/js/components/logs-viewer.js` lines 95-98
```js
this.eventSource.onerror = () => {
    setTimeout(() => this.startLogStream(), 3000);
};
```
If the server returns 401 the stream immediately errors and reconnects in a
tight 3-second loop forever. Add a back-off or stop after N failures.

### 9. View error message is vulnerable to injection
**File:** `src/proxy/public/app.js` lines 45-48
```js
el.innerHTML = `...Error loading view: ${viewName}...${err.message}...`;
```
`viewName` and `err.message` are interpolated raw into innerHTML. If the hash
route is manipulated (`#<img onerror=...>`) this is a DOM XSS vector. Use
`textContent` or escape the values.

### 10. OAuth polling never clears if account count doesn't change
**File:** `src/proxy/public/app.js` lines 150-218
The OAuth success detection compares `currentAccountCount > initialAccountCount`.
If the user re-authenticates an existing account (count stays the same), the
poll runs for the full 2 minutes and then shows a timeout warning even though
the re-auth succeeded.

---

## P2 — Incorrect Display

### 11. Accounts table colspan mismatch
**File:** `src/proxy/public/views/accounts.html` lines 101 and 264
The table has 7 columns (toggle, email, source, tier, quota, health, actions)
but the empty-state and no-search-results rows use `colspan="6"`. The "No
accounts" message won't span the full width.
**Fix:** Change to `colspan="7"`.

### 12. `Redact` used but never null-checked for non-dev mode
**Files:** `accounts.html`, `logs.html`, and several JS components reference
`Redact.email()` and `Redact.logMessage()`. The `Redact` object is loaded
from `js/utils/redact.js`. If the script fails to load, every account row and
log entry will throw. Add a `window.Redact = window.Redact || { email: e=>e,
logMessage: m=>m }` fallback.

### 13. Slider background-size formulas are wrong for some ranges
**File:** `src/proxy/public/views/settings.html` — multiple range inputs
Example at line 1855:
```
:style="`background-size: ${((serverConfig.maxConsecutiveFailures || 3) - 1) / 0.09}% 100%`"
```
`/ 0.09` should be `/ 9 * 100` (range 1-10 → 9 steps → multiply by 100 for
percentage). The current formula produces values >1000% for high slider values,
causing the fill colour to overflow.

Similarly, line 1629 uses `/ 99` instead of `/ 9900 * 100` for the retry base
delay slider (range 100-10000).

### 14. Global version display shows hardcoded "1.0.0" before API responds
**File:** `src/proxy/public/js/store.js` line 76
```js
version: '1.0.0',
```
On slow connections the sidebar footer briefly shows "v1.0.0" before the real
version loads. Either hide the version until fetched or use an empty string
with a loading indicator.

---

## P3 — Cosmetic / DX

### 15. `JSON.stringify` comparison in dashboard watcher is expensive
**File:** `src/proxy/public/js/components/dashboard.js` lines 74, 96
```js
if (JSON.stringify(newHistory) === JSON.stringify(this.historyData)) return;
```
On large history objects this serialises the entire tree on every poll cycle.
Use a lightweight hash or revision counter from the server instead.

### 16. `deleteSelectedPreset` uses native `confirm()` — inconsistent UX
Already noted under P0-4 for security; also a cosmetic inconsistency because
every other destructive action (delete account, restore defaults) uses a
styled DaisyUI modal.

### 17. Toast only shows one message at a time
**File:** `src/proxy/public/js/store.js` lines 111-116
`this.toast` is a single object. Rapid successive operations (e.g. import 5
accounts) replace each toast before the user reads it. Consider an array-based
toast queue.

### 18. Log viewer blinking cursor shown only when no filter is active
**File:** `src/proxy/public/views/logs.html` line 97
```html
x-show="filteredLogs.length === logs.length && !searchQuery"
```
When any level filter checkbox is unchecked, `filteredLogs.length !== logs.length`
even if the log pane is live and scrolling. The cursor disappears, making it
look disconnected. Tie it to the EventSource connection state instead.

### 19. `$store.data.lastUpdated` is locale-dependent and not sortable
**File:** `src/proxy/public/js/data-store.js` line 160
```js
this.lastUpdated = new Date().toLocaleTimeString();
```
Stores a locale-formatted string rather than a Date or ISO timestamp. Any
future sorting/comparison on this field will break.

### 20. Mobile sidebar overlay has no visible backdrop tap-to-close
**File:** `src/proxy/public/index.html`
On mobile the sidebar opens as an overlay but there is no semi-transparent
backdrop behind it. Users may not realise they can tap outside to close it.

### 21. Settings page `serverConfig` component mounts fresh on every tab switch
**File:** `src/proxy/public/views/settings.html` line 1063
```html
x-data="window.Components.serverConfig()"
```
Each time the user switches to the Server tab, a new component instance is
created and `fetchServerConfig()` fires. State (expanded sections, pending
edits) is lost. Consider persisting the component or caching the fetch.

### 22. Translation `t()` crashes if language key is missing
**File:** `src/proxy/public/js/store.js` line 97
```js
let str = this.translations[this.lang][key] || key;
```
If `this.translations[this.lang]` is undefined (e.g. unsupported language
in localStorage), this throws `TypeError`. Add a safe-access chain:
`this.translations[this.lang]?.[key] || this.translations['en']?.[key] || key`.

---

**Total: 22 issues** (6 P0, 4 P1, 4 P2, 8 P3)
