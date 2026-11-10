import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { safeEqual, isAllowedOrigin, isLoopbackHostname, corsOptions, hostGuard } from '../utils/security.js';

test('safeEqual: equal, unequal, non-string', () => {
    assert.equal(safeEqual('secret', 'secret'), true);
    assert.equal(safeEqual('secret', 'Secret'), false);
    assert.equal(safeEqual('a', 'abcdef'), false);
    assert.equal(safeEqual(undefined, 'x'), false);
    assert.equal(safeEqual(null, null), false);
});

test('isLoopbackHostname', () => {
    for (const h of ['localhost', '127.0.0.1', '::1', '[::1]']) assert.equal(isLoopbackHostname(h), true);
    for (const h of ['evil.example', '192.168.1.5', '0.0.0.0']) assert.equal(isLoopbackHostname(h), false);
});

test('isAllowedOrigin: no origin, localhost, foreign, malformed', () => {
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin('http://localhost:8085'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:3000'), true);
    assert.equal(isAllowedOrigin('https://evil.example'), false);
    assert.equal(isAllowedOrigin('not a url'), false);
});

test('ALLOWED_ORIGINS env extends the allowlist', () => {
    process.env.ALLOWED_ORIGINS = 'https://good.example';
    assert.equal(isAllowedOrigin('https://good.example'), true);
    assert.equal(isAllowedOrigin('https://evil.example'), false);
    delete process.env.ALLOWED_ORIGINS;
});

test('hostGuard + cors over real HTTP', async () => {
    delete process.env.HOST;
    const app = express();
    app.use(hostGuard());
    app.use(cors(corsOptions));
    app.get('/x', (_req, res) => res.json({ ok: true }));
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const port = server.address().port;
    const status = headers => new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: '/x', headers }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
    });
    try {
        assert.equal(await status({}), 200);
        assert.equal(await status({ Origin: 'http://localhost:3000' }), 200);
        assert.equal(await status({ Origin: 'https://evil.example' }), 403);
        assert.equal(await status({ Host: 'evil.example:8085' }), 403);
        assert.equal(await status({ Host: 'localhost:8085' }), 200);
    } finally {
        server.close();
    }
});
