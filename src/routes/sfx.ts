import express, { Request, Response } from 'express';
import { sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

router.get('/:sfxID', asyncHandler(async (req: Request, res: Response) => {
    const { sfxID } = req.params;

    await sfxDB.read();
    const sfxList = sfxDB.data?.sfx || [];

    const sfx = sfxList.find(item => String(item.id) === sfxID);

    if (!sfx) {
        return res.status(404).json({ error: 'SFX not found' });
    }

    res.status(200).json({ sfx });
}));

export default router;
