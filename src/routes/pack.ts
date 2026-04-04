import express, { Request, Response } from 'express';
import { packsDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
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

router.delete(
    '/:packID',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { packID } = req.params;

        await packsDB.read();
        if (!packsDB.data?.packs?.length) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        const packIndex = packsDB.data.packs.findIndex(item => String(item.id) === packID);
        if (packIndex === -1) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        const [deletedPack] = packsDB.data.packs.splice(packIndex, 1);
        await packsDB.write();

        return res.status(200).json({
            message: 'Pack deleted successfully',
            pack: deletedPack,
        });
    })
);

export default router;
