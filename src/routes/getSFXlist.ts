import express, { Request, Response } from 'express';
import rateLimiter from '../utils/rateLimiter';

const router = express.Router();

router.get('/', rateLimiter, (req: Request, res: Response) => {
    res.json({ message: 'Get SFX list route is working!' });
});

export default router;