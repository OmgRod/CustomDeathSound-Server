import express, { Request, Response } from 'express';
import rateLimiter from '../utils/rateLimiter';
import { sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

router.get(
  '/',
  rateLimiter(15, 100),
  asyncHandler(async (req: Request, res: Response) => {
    const pageSize = 15;

    let page = parseInt(req.query.page as string, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    const recent = Number(req.query.recent) >= 1;

    await sfxDB.read();
    const sfxList = sfxDB.data?.sfx || [];

    if (sfxList.length === 0) {
      return res.status(404).json({ error: 'Unable to find SFX' });
    }

    const sortedSfx = recent
      ? [...sfxList].sort((a, b) => b.createdAt - a.createdAt)
      : [...sfxList].sort((a, b) => b.downloads - a.downloads);

    const totalItems = sortedSfx.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    if (page > totalPages) {
      return res.status(404).json({ error: 'Page number exceeds total pages' });
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = sortedSfx.slice(startIndex, endIndex);

    res.json({
      page,
      totalPages,
      pageSize,
      totalItems,
      data: paginated,
    });
  })
);

export default router;
