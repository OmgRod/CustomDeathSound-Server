import express, { Request, Response } from 'express';
import { packsDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import rateLimiter from '../utils/rateLimiter';

const router = express.Router();

router.get('/:packID', rateLimiter(15, 100), asyncHandler(async (req: Request, res: Response) => {
    const { packID } = req.params;

    await packsDB.read();
    const packsList = packsDB.data?.packs || [];

    const pack = packsList.find(item => String(item.id) === packID);

    if (!pack) {
        return res.status(404).json({ error: 'Pack not found' });
    }

    res.status(200).json({ pack });
}));

export default router;
