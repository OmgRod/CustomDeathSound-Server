import express, { Request, Response } from 'express';
import rateLimiter from '../utils/rateLimiter';
import { sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

router.get(
  '/',
  rateLimiter(15, 100),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = 15;
    const recent = Number(req.query.recent) >= 1;

    await sfxDB.read();
    let sfxList = sfxDB.data?.sfx || [];

    if (sfxList.length === 0) {
      return res.status(404).json({ error: 'Unable to find SFX' });
    }

    let sortedSfx;
    if (recent) {
      sortedSfx = [...sfxList].sort((a, b) => b.createdAt - a.createdAt);
    } else {
      sortedSfx = [...sfxList].sort((a, b) => b.downloads - a.downloads);
    }

    const paginated = sortedSfx.slice((page - 1) * pageSize, page * pageSize);

    if (paginated.length === 0) {
      return res.status(404).json({ error: 'Unable to find SFX on this page' });
    }

    res.json(paginated);
  })
);

export default router;