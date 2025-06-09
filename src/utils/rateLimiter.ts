import { rateLimit } from 'express-rate-limit';

function rateLimiter(minutes: number, amount: number) {
    const rl = rateLimit({
        windowMs: minutes * 60 * 1000,
        max: amount,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({ error: 'Too many requests, please try again later.' });
        },
    });

    return rl;
}

export default rateLimiter;