/**
 * Security helpers for the local proxy.
 *
 * The proxy holds Google refresh tokens, so it must not be reachable by
 * arbitrary websites (CORS / DNS rebinding) or by other machines on the LAN
 * unless the user explicitly opts in via HOST.
 */

import crypto from 'crypto';

const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Constant-time string comparison (hashes first so lengths don't leak).
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
}

const SCRYPT_PREFIX = '$scrypt$';
const SCRYPT_KEYLEN = 64;

export function hashPassword(plain) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN);
    return `${SCRYPT_PREFIX}${salt}$${derived.toString('hex')}`;
}

export function isHashed(value) {
    return typeof value === 'string' && value.startsWith(SCRYPT_PREFIX);
}

export function verifyPassword(plain, hashed) {
    if (typeof plain !== 'string' || !isHashed(hashed)) return false;
    const parts = hashed.slice(SCRYPT_PREFIX.length).split('$');
    if (parts.length !== 2) return false;
    const [salt, storedHex] = parts;
    const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN);
    const storedBuf = Buffer.from(storedHex, 'hex');
    if (derived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derived, storedBuf);
}

/**
 * Strip the port from a Host header / Origin host value.
 * @param {string} hostValue
 * @returns {string}
 */
function hostnameOf(hostValue) {
    if (!hostValue) return '';
    const v = String(hostValue).toLowerCase();
    if (v.startsWith('[')) {
        const end = v.indexOf(']');
        return end === -1 ? v : v.slice(0, end + 1);
    }
    return v.split(':')[0];
}

export function isLoopbackHostname(hostname) {
    return LOOPBACK_NAMES.has(hostname);
}

/** True when the server is bound to loopback only (the safe default). */
export function isLoopbackBind(bindHost = process.env.HOST || '127.0.0.1') {
    return isLoopbackHostname(bindHost);
}

/**
 * CORS options: allow non-browser clients (no Origin header, e.g. Claude Code)
 * and pages served from localhost. Every other browser origin is refused.
 * Extra origins can be allowed with ALLOWED_ORIGINS="https://a.example,https://b.example".
 */
export function isAllowedOrigin(origin) {
    if (!origin) return true;
    try {
        const { hostname } = new URL(origin);
        const extra = (process.env.ALLOWED_ORIGINS || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        return isLoopbackHostname(hostname) || extra.includes(origin);
    } catch {
        return false;
    }
}

export const corsOptions = {
    origin(origin, callback) {
        return callback(null, isAllowedOrigin(origin));
    }
};

/**
 * DNS-rebinding guard: when bound to loopback, only accept requests whose Host
 * header is a loopback name. Skipped if the user deliberately set HOST to a
 * non-loopback address.
 */
export function hostGuard() {
    return (req, res, next) => {
        // Refuse cross-site browser requests outright (not just hide the response)
        if (!isAllowedOrigin(req.headers.origin)) {
            return res.status(403).json({
                type: 'error',
                error: { type: 'forbidden', message: 'Origin not allowed' }
            });
        }
        if (!isLoopbackBind()) return next();
        if (isLoopbackHostname(hostnameOf(req.headers.host))) return next();
        return res.status(403).json({
            type: 'error',
            error: { type: 'forbidden', message: 'Host not allowed' }
        });
    };
}
