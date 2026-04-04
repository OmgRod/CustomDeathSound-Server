import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { packsDB, sfxDB } from '../db';
import { v4 as uuidv4 } from 'uuid';
import rateLimiter from '../utils/rateLimiter';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.post(
  '/',
  rateLimiter(15, 100),
  requireAuth,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    console.log('Reading Pack DB...');
    await packsDB.read();
    console.log('Reading SFX DB for validation...');
    await sfxDB.read();

    const { name, ids, downloads } = req.body as { name?: string; ids?: string[]; downloads?: number };

    if (!name || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Missing required fields: name and ids (array of strings)' });
    }

    if (!packsDB.data) packsDB.data = { packs: [] };
    if (!packsDB.data.packs) packsDB.data.packs = [];

    const sfxIds = sfxDB.data?.sfx?.map(sfx => String(sfx.id)) || [];
    const invalidIds = ids.filter(id => !sfxIds.includes(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: `Invalid SFX IDs: ${invalidIds.join(', ')}` });
    }

    const normalizedDownloads = Number.isFinite(downloads)
      ? Math.max(0, Math.floor(Number(downloads)))
      : 0;

    const newPack = {
      id: uuidv4(),
      name,
      ids,
      downloads: normalizedDownloads,
      likes: 0,
      dislikes: 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    packsDB.data.packs.push(newPack);

    await packsDB.write();
    console.log('Pack DB written to disk.');

    res.status(201).json({ message: 'Pack uploaded successfully', pack: newPack });
  })
);

export default router;
