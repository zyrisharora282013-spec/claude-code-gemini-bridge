// No-op fallback so the UI keeps rendering if redact.js fails to load; redact.js overrides it.
window.Redact = window.Redact || { email: (e) => e, logMessage: (m) => m };
