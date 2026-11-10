import express from 'express';
import { config } from '../config.js';
import { safeEqual, verifyPassword, isHashed } from '../utils/security.js';

const streamTokens = new Map();
const MAX_AUTH_FAILURES = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const authFailures = new Map();

function createAuthMiddleware() {
    return (req, res, next) => {
        const password = config.webuiPassword;
        if (!password) return next();

        const isApiRoute = req.path.startsWith('/api/');
        const isAuthUrl = req.path === '/api/auth/url';
        const isConfigGet = req.path === '/api/config' && req.method === 'GET';
        const isProtected = (isApiRoute && !isAuthUrl && !isConfigGet) || req.path === '/account-limits' || req.path === '/health';

        if (isProtected) {
            const ip = req.ip || req.socket?.remoteAddress || 'unknown';
            const record = authFailures.get(ip);

            if (record) {
                record.attempts = record.attempts.filter(t => Date.now() - t < AUTH_WINDOW_MS);
                if (record.attempts.length === 0) {
                    authFailures.delete(ip);
                } else if (record.attempts.length >= MAX_AUTH_FAILURES) {
                    return res.status(429).json({ status: 'error', error: 'Too many failed attempts. Try again later.' });
                }
            }

            if (req.path === '/api/logs/stream' && req.query.token) {
                const exp = streamTokens.get(req.query.token);
                if (exp && Date.now() < exp) {
                    streamTokens.delete(req.query.token);
                    return next();
                }
            }
            const allowQuery = req.path === '/api/logs/stream';
            const providedPassword = req.headers['x-webui-password'] || (allowQuery ? req.query.password : undefined);
            const ok = isHashed(password)
                ? verifyPassword(providedPassword, password)
                : safeEqual(providedPassword, password);
            if (!ok) {
                const rec = authFailures.get(ip) || { attempts: [] };
                rec.attempts.push(Date.now());
                authFailures.set(ip, rec);
                return res.status(401).json({ status: 'error', error: 'Unauthorized' });
            }
            if (authFailures.has(ip)) authFailures.delete(ip);
        }
        next();
    };
}

export function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(createAuthMiddleware());

    const ok = (_req, res) => res.json({ status: 'ok' });

    app.get('/api/accounts', ok);
    app.post('/api/accounts/:email/refresh', ok);
    app.post('/api/accounts/:email/toggle', ok);
    app.delete('/api/accounts/:email', ok);
    app.patch('/api/accounts/:email', ok);
    app.post('/api/accounts/reload', ok);
    app.get('/api/accounts/export', ok);
    app.post('/api/accounts/import', ok);
    app.get('/api/config', ok);
    app.post('/api/config', ok);
    app.post('/api/config/password', ok);
    app.get('/api/settings', ok);
    app.get('/api/claude/config', ok);
    app.post('/api/claude/config', ok);
    app.post('/api/claude/config/restore', ok);
    app.get('/api/claude/mode', ok);
    app.post('/api/claude/mode', ok);
    app.get('/api/claude/presets', ok);
    app.post('/api/claude/presets', ok);
    app.delete('/api/claude/presets/:name', ok);
    app.get('/api/server/presets', ok);
    app.post('/api/server/presets', ok);
    app.patch('/api/server/presets/:name', ok);
    app.delete('/api/server/presets/:name', ok);
    app.post('/api/models/config', ok);
    app.get('/api/logs', ok);
    app.post('/api/logs/token', ok);
    app.get('/api/logs/stream', (_req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: {"status":"ok"}\n\n');
        res.end();
    });
    app.get('/api/strategy/health', ok);
    app.get('/api/auth/url', ok);
    app.post('/api/auth/complete', ok);

    return app;
}

export { streamTokens, authFailures };
