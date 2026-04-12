
import { Request } from 'express';
import { ipKeyGenerator, MemoryStore, rateLimit } from 'express-rate-limit';

const sharedRateLimitStore = new MemoryStore();

function normalizeClientIp(rawIp: string | null | undefined) {
    if (!rawIp) return '';
    const trimmed = rawIp.trim();
    if (!trimmed) return '';
    return trimmed.replace(/^::ffff:/i, '');
}

export function resolveClientIp(req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const firstForwardedIp = typeof forwardedValue === 'string'
        ? forwardedValue.split(',')[0]?.trim()
        : '';

    return normalizeClientIp(firstForwardedIp || req.ip || req.socket.remoteAddress);
}

export function getRateLimitKeyFromRequest(req: Request) {
    const clientIp = resolveClientIp(req);
    return ipKeyGenerator(clientIp || req.ip || req.socket.remoteAddress || '');
}

export function clearRateLimitForRequest(req: Request) {
    sharedRateLimitStore.resetKey(getRateLimitKeyFromRequest(req));
}

function rateLimiter(minutes: number, amount: number) {
    const rl = rateLimit({
        windowMs: minutes * 60 * 1000,
        max: amount,
        store: sharedRateLimitStore,
        keyGenerator: (req) => getRateLimitKeyFromRequest(req),
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({ error: 'Too many requests, please try again later.' });
        },
    });

    return rl;
}

export default rateLimiter;