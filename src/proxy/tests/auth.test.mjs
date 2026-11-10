import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { config } from '../config.js';
import { hashPassword, verifyPassword, isHashed } from '../utils/security.js';

const TEST_PASSWORD = 'test-auth-pw-' + Date.now();

function makeRequest(port, method, path, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            { host: '127.0.0.1', port, method, path, headers },
            res => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
                    catch { resolve({ status: res.statusCode, body }); }
                });
            }
        );
        req.on('error', reject);
        if (method === 'POST' || method === 'PATCH') {
            req.setHeader('Content-Type', 'application/json');
            req.end('{}');
        } else {
            req.end();
        }
    });
}

let testHelpers;

describe('Auth middleware (WEBUI_PASSWORD set)', () => {
    let server, port;

    before(async () => {
        config.webuiPassword = TEST_PASSWORD;

        testHelpers = await import('../webui/test-helpers.js');
        const app = testHelpers.createTestApp();

        server = await new Promise(r => {
            const s = app.listen(0, '127.0.0.1', () => r(s));
        });
        port = server.address().port;
    });

    after(() => {
        config.webuiPassword = '';
        if (server) server.close();
    });

    const protectedRoutes = [
        ['GET',    '/api/accounts'],
        ['POST',   '/api/accounts/test@test.com/refresh'],
        ['POST',   '/api/accounts/test@test.com/toggle'],
        ['DELETE', '/api/accounts/test@test.com'],
        ['PATCH',  '/api/accounts/test@test.com'],
        ['POST',   '/api/accounts/reload'],
        ['GET',    '/api/accounts/export'],
        ['POST',   '/api/accounts/import'],
        ['POST',   '/api/config'],
        ['POST',   '/api/config/password'],
        ['GET',    '/api/settings'],
        ['GET',    '/api/claude/config'],
        ['POST',   '/api/claude/config'],
        ['POST',   '/api/claude/config/restore'],
        ['GET',    '/api/claude/mode'],
        ['POST',   '/api/claude/mode'],
        ['GET',    '/api/claude/presets'],
        ['POST',   '/api/claude/presets'],
        ['DELETE', '/api/claude/presets/testpreset'],
        ['GET',    '/api/server/presets'],
        ['POST',   '/api/server/presets'],
        ['PATCH',  '/api/server/presets/testpreset'],
        ['DELETE', '/api/server/presets/testpreset'],
        ['POST',   '/api/models/config'],
        ['GET',    '/api/logs'],
        ['POST',   '/api/logs/token'],
        ['GET',    '/api/strategy/health'],
    ];

    for (const [method, path] of protectedRoutes) {
        test(`${method} ${path} → 401 without password`, async () => {
            const { status } = await makeRequest(port, method, path);
            assert.equal(status, 401, `Expected 401 for ${method} ${path}`);
        });

        test(`${method} ${path} → not 401 with correct password`, async () => {
            const { status } = await makeRequest(port, method, path, {
                'x-webui-password': TEST_PASSWORD,
            });
            assert.notEqual(status, 401, `Should not be 401 for ${method} ${path} with password`);
        });
    }

    test('GET /api/config (public) → not 401 without password', async () => {
        const { status } = await makeRequest(port, 'GET', '/api/config');
        assert.notEqual(status, 401);
    });

    test('GET /api/auth/url → not 401 without password', async () => {
        const { status } = await makeRequest(port, 'GET', '/api/auth/url');
        assert.notEqual(status, 401);
    });

    test('/api/logs/stream accepts ?password= query param', async () => {
        const { status } = await makeRequest(port, 'GET',
            `/api/logs/stream?password=${encodeURIComponent(TEST_PASSWORD)}`);
        assert.notEqual(status, 401);
    });

    test('non-stream routes reject ?password= query param', async () => {
        const { status } = await makeRequest(port, 'GET',
            `/api/accounts?password=${encodeURIComponent(TEST_PASSWORD)}`);
        assert.equal(status, 401);
    });
});

describe('Rate limiting (lockout after 5 failures)', () => {
    let server, port;

    before(async () => {
        config.webuiPassword = TEST_PASSWORD;
        testHelpers.authFailures.clear();

        const app = testHelpers.createTestApp();
        server = await new Promise(r => {
            const s = app.listen(0, '127.0.0.1', () => r(s));
        });
        port = server.address().port;
    });

    after(() => {
        config.webuiPassword = '';
        testHelpers.authFailures.clear();
        if (server) server.close();
    });

    test('returns 401 for first 5 wrong attempts, then 429', async () => {
        for (let i = 0; i < 5; i++) {
            const { status } = await makeRequest(port, 'GET', '/api/accounts', {
                'x-webui-password': 'wrong'
            });
            assert.equal(status, 401, `Attempt ${i + 1} should be 401`);
        }
        const { status } = await makeRequest(port, 'GET', '/api/accounts', {
            'x-webui-password': 'wrong'
        });
        assert.equal(status, 429, 'Attempt 6 should be 429 (locked out)');
    });

    test('correct password is also blocked during lockout', async () => {
        const { status } = await makeRequest(port, 'GET', '/api/accounts', {
            'x-webui-password': TEST_PASSWORD
        });
        assert.equal(status, 429, 'Even correct password should be 429 during lockout');
    });

    test('lockout resets after clearing failures', async () => {
        testHelpers.authFailures.clear();
        const { status } = await makeRequest(port, 'GET', '/api/accounts', {
            'x-webui-password': TEST_PASSWORD
        });
        assert.equal(status, 200);
    });

    test('successful auth resets failure counter', async () => {
        testHelpers.authFailures.clear();
        for (let i = 0; i < 4; i++) {
            await makeRequest(port, 'GET', '/api/accounts', {
                'x-webui-password': 'wrong'
            });
        }
        const { status: okStatus } = await makeRequest(port, 'GET', '/api/accounts', {
            'x-webui-password': TEST_PASSWORD
        });
        assert.equal(okStatus, 200);

        for (let i = 0; i < 4; i++) {
            const { status } = await makeRequest(port, 'GET', '/api/accounts', {
                'x-webui-password': 'wrong'
            });
            assert.equal(status, 401, 'Counter should have reset; should still be 401');
        }
    });
});

describe('Scrypt password hashing', () => {
    test('hashPassword produces $scrypt$ prefixed string', () => {
        const hashed = hashPassword('mypassword');
        assert.ok(isHashed(hashed));
        assert.ok(hashed.startsWith('$scrypt$'));
    });

    test('verifyPassword matches correct plain text', () => {
        const hashed = hashPassword('secret123');
        assert.ok(verifyPassword('secret123', hashed));
    });

    test('verifyPassword rejects wrong plain text', () => {
        const hashed = hashPassword('secret123');
        assert.ok(!verifyPassword('wrong', hashed));
    });

    test('verifyPassword rejects non-string input', () => {
        const hashed = hashPassword('secret123');
        assert.ok(!verifyPassword(undefined, hashed));
        assert.ok(!verifyPassword(null, hashed));
    });

    test('isHashed identifies hashed vs plain strings', () => {
        assert.ok(!isHashed('plaintext'));
        assert.ok(!isHashed(''));
        assert.ok(!isHashed(undefined));
        assert.ok(isHashed('$scrypt$abc$def'));
    });
});

describe('Auth middleware with hashed password', () => {
    let server, port;
    const HASHED_PW = hashPassword(TEST_PASSWORD);

    before(async () => {
        config.webuiPassword = HASHED_PW;
        testHelpers.authFailures.clear();

        const app = testHelpers.createTestApp();
        server = await new Promise(r => {
            const s = app.listen(0, '127.0.0.1', () => r(s));
        });
        port = server.address().port;
    });

    after(() => {
        config.webuiPassword = '';
        if (server) server.close();
    });

    test('rejects request without password (hashed mode)', async () => {
        const { status } = await makeRequest(port, 'GET', '/api/accounts');
        assert.equal(status, 401);
    });

    test('rejects wrong password (hashed mode)', async () => {
        const { status } = await makeRequest(port, 'GET', '/api/accounts', {
            'x-webui-password': 'wrongpassword'
        });
        assert.equal(status, 401);
    });

    test('accepts correct plain password against hash', async () => {
        const { status } = await makeRequest(port, 'GET', '/api/accounts', {
            'x-webui-password': TEST_PASSWORD
        });
        assert.equal(status, 200);
    });

    test('public routes still exempt (hashed mode)', async () => {
        const { status: configStatus } = await makeRequest(port, 'GET', '/api/config');
        assert.notEqual(configStatus, 401);
        const { status: authStatus } = await makeRequest(port, 'GET', '/api/auth/url');
        assert.notEqual(authStatus, 401);
    });
});
