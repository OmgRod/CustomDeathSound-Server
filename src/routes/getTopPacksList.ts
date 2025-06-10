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

    await packsDB.read();
    const packsList = packsDB.data?.packs || [];

    if (packsList.length === 0) {
      return res.status(404).json({ error: 'Unable to find SFX' });
    }

    const sorted = [...packsList].sort((a, b) => b.downloads - a.downloads);
    const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

    if (paginated.length === 0) {
      return res.status(404).json({ error: 'Unable to find SFX' });
    }

    res.json(paginated);
  })
);

export default router;
