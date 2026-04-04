import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import rateLimiter from '../utils/rateLimiter';

const router = express.Router();

router.get('/', rateLimiter(15, 100), asyncHandler(async (req: Request, res: Response) => {
    const query = String(req.query.query ?? '').trim().toLowerCase();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    await sfxDB.read();
    const sfxList = sfxDB.data?.sfx || [];

    const filtered = !query
        ? sfxList
        : sfxList.filter((item) => {
            const id = String(item.id).toLowerCase();
            const name = String(item.name).toLowerCase();
            return id.includes(query) || name.includes(query);
        });

    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    return res.status(200).json({ data: sorted });
}));

router.get('/:sfxID', rateLimiter(15, 100), asyncHandler(async (req: Request, res: Response) => {
    const { sfxID } = req.params;

    await sfxDB.read();
    const sfxList = sfxDB.data?.sfx || [];

    const sfx = sfxList.find(item => String(item.id) === sfxID);

    if (!sfx) {
        return res.status(404).json({ error: 'SFX not found' });
    }

    res.status(200).json({ sfx });
}));

router.get('/:sfxID/download', rateLimiter(15, 100), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.sfxID;
    await sfxDB.read();
        const sfxList = sfxDB.data?.sfx ?? [];
        const index = sfxList.findIndex((item) => item.id === id);

        if (index === -1) {
                return res.status(404).json({ error: 'SFX not found.' });
        }

        const current = sfxList[index];
        const nextDownloads = Number.isFinite(current.downloads) ? current.downloads + 1 : 1;
        sfxList[index] = { ...current, downloads: nextDownloads };
        await sfxDB.write();

        return res.status(200).json({ sfx: sfxList[index] });
}));

router.get(
    '/:sfxID/file-status',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { sfxID } = req.params;

        await sfxDB.read();
        const sfxList = sfxDB.data?.sfx || [];
        const sfx = sfxList.find(item => String(item.id) === sfxID);

        if (!sfx) {
            return res.status(404).json({ error: 'SFX not found' });
        }

        const soundsDir = path.join(__dirname, '../../public/sounds');
        const filename = path.basename(sfx.url);
        const filePath = path.join(soundsDir, filename);

        try {
            await fs.access(filePath);
            return res.status(200).json({
                sfxId: sfx.id,
                filename,
                exists: true,
            });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return res.status(200).json({
                    sfxId: sfx.id,
                    filename,
                    exists: false,
                });
            }

            throw error;
        }
    })
);

router.delete(
    '/:sfxID',
    rateLimiter(15, 100),
    requireAuth,
    requireRole(['admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { sfxID } = req.params;

        await sfxDB.read();
        if (!sfxDB.data?.sfx?.length) {
            return res.status(404).json({ error: 'SFX not found' });
        }

        const sfxIndex = sfxDB.data.sfx.findIndex(item => String(item.id) === sfxID);
        if (sfxIndex === -1) {
            return res.status(404).json({ error: 'SFX not found' });
        }

        const [deletedSfx] = sfxDB.data.sfx.splice(sfxIndex, 1);
        await sfxDB.write();

        const soundsDir = path.join(__dirname, '../../public/sounds');
        const filename = path.basename(deletedSfx.url);
        const filePath = path.join(soundsDir, filename);
        let fileDeleted = false;

        try {
            await fs.unlink(filePath);
            fileDeleted = true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }

        return res.status(200).json({
            message: 'SFX deleted successfully',
            sfx: deletedSfx,
            fileDeleted,
        });
    })
);

export default router;
