import express from 'express';
import type { Request, Response } from 'express';
import { db, initDB } from '../src/db';

const router = express.Router();

initDB();

router.post('/', async (req: Request, res: Response) => {
  await db.read();

  const { name, url } = req.body;

  if (!name || !url) {
    res.status(400).json({ error: 'Missing required fields: name and url' });
    return;
  }

  const newSfx = { id: Date.now(), name, url };

  if (!db.data) db.data = { sfx: [] };
  if (!db.data.sfx) db.data.sfx = [];

  db.data.sfx.push(newSfx);

  await db.write();

  res.status(201).json({ message: 'SFX uploaded successfully', sfx: newSfx });
});

export default router;
