import { Router, Request, Response } from 'express';
import rateLimiter from '../utils/rateLimiter';

const router = Router();

router.get('/:packID', rateLimiter, (req: Request, res: Response) => {
    res.json({ message: 'Get Pack by ID route is working!' });
});

export default router;