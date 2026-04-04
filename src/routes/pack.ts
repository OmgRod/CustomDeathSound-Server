import express, { Request, Response } from 'express';
import { packsDB, sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import rateLimiter from '../utils/rateLimiter';

const router = express.Router();

router.get(
    '/',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        await packsDB.read();
        const packsList = packsDB.data?.packs || [];
        return res.status(200).json({ packs: packsList });
    })
);

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

router.get(
    '/:packID/download',
    rateLimiter(15, 100),
    asyncHandler(async (req: Request, res: Response) => {
        const { packID } = req.params;

        await packsDB.read();
        if (!packsDB.data?.packs?.length) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        const pack = packsDB.data.packs.find(item => String(item.id) === packID);

        if (!pack) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        pack.downloads = (pack.downloads ?? 0) + 1;
        await packsDB.write();

        return res.status(200).json({
            message: 'Pack download recorded successfully',
            pack,
        });
    })
);

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

router.put(
    '/:packID',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { packID } = req.params;
        const { name, ids } = req.body as { name?: string; ids?: string[] };

        if (!name || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Missing required fields: name and ids (non-empty array of strings)' });
        }

        await packsDB.read();
        await sfxDB.read();

        const packsList = packsDB.data?.packs || [];
        const packIndex = packsList.findIndex(item => String(item.id) === packID);
        if (packIndex === -1) {
            return res.status(404).json({ error: 'Pack not found' });
        }

        const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
        const validSfxIds = new Set((sfxDB.data?.sfx || []).map((item) => String(item.id)));
        const invalidIds = uniqueIds.filter((id) => !validSfxIds.has(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({ error: `Invalid SFX IDs: ${invalidIds.join(', ')}` });
        }

        const existingPack = packsList[packIndex];
        packsList[packIndex] = {
            ...existingPack,
            name: String(name).trim(),
            ids: uniqueIds,
        };

        await packsDB.write();

        return res.status(200).json({
            message: 'Pack updated successfully',
            pack: packsList[packIndex],
        });
    })
);

export default router;
