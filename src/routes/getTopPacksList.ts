import express, { Request, Response } from 'express';
import rateLimiter from '../utils/rateLimiter';
import { packsDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

router.get(
  '/',
  rateLimiter(15, 100),
  asyncHandler(async (req: Request, res: Response) => {
    const pageSize = 10;

    let page = parseInt(req.query.page as string, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    const recent = Number(req.query.recent) >= 1;

    await packsDB.read();
    const packsList = packsDB.data?.packs || [];

    if (packsList.length === 0) {
      return res.status(404).json({ error: 'Unable to find packs' });
    }

    const sortedpacks = recent
      ? [...packsList].sort((a, b) => b.createdAt - a.createdAt)
      : [...packsList].sort((a, b) => b.downloads - a.downloads);

    const totalItems = sortedpacks.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    if (page > totalPages) {
      return res.status(404).json({ error: 'Page number exceeds total pages' });
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = sortedpacks.slice(startIndex, endIndex);

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
