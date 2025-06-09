import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { db } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/sounds'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    await db.read();

    const { name } = req.body;
    const file = req.file;

    if (!name || !file) {
      return res.status(400).json({ error: 'Missing required fields: name and file' });
    }

    if (!db.data) db.data = { sfx: [] };
    if (!db.data.sfx) db.data.sfx = [];

    const newSfx = {
      id: Date.now(),
      name,
      url: `/sounds/${file.filename}`,
    };

    db.data.sfx.push(newSfx);
    await db.write();

    res.status(201).json({ message: 'SFX uploaded successfully', sfx: newSfx });
  })
);

export default router;
