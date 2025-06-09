import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Get Packs list route is working!' });
});

export default router;