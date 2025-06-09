import { Router, Request, Response } from 'express';

const router = Router();

router.get('/:packID', (req: Request, res: Response) => {
    res.json({ message: 'Get Pack by ID route is working!' });
});

export default router;