import express, { Request, Response } from 'express';
import rateLimiter from '../utils/rateLimiter';
import { packsDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

router.get(
  '/',
  rateLimiter(15, 100),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = 15;
    const recent = Number(req.query.recent) >= 1;

    await packsDB.read();
    const packsList = packsDB.data?.packs || [];

    if (packsList.length === 0) {
      return res.status(404).json({ error: 'Unable to find Packs' });
    }

    let sortedPacks;
    if (recent) {
      sortedPacks = [...packsList].sort((a, b) => b.createdAt - a.createdAt);
    } else {
      sortedPacks = [...packsList].sort((a, b) => b.downloads - a.downloads);
    }

    const paginated = sortedPacks.slice((page - 1) * pageSize, page * pageSize);

    if (paginated.length === 0) {
      return res.status(404).json({ error: 'Unable to find Packs on this page' });
    }

    res.json(paginated);
  })
);

export default router;
