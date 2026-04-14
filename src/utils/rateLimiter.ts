
import { Request } from 'express';
import { ipKeyGenerator, MemoryStore, rateLimit } from 'express-rate-limit';

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

export default function rateLimiter(minutes: number, amount: number) {
    const store = new MemoryStore();
    const rl = rateLimit({
        windowMs: minutes * 60 * 1000,
        max: amount,
        store,
        keyGenerator: (req) => getRateLimitKeyFromRequest(req),
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({ error: 'Too many requests, please try again later.' });
        },
    });
    // Attach store for clearing (if needed in future)
    (rl as any)._store = store;
    return rl;
}

// clearRateLimitForRequest is now a no-op placeholder
export function clearRateLimitForRequest(_req: Request) {
    // No-op: cannot clear all stores now that each limiter has its own
}

