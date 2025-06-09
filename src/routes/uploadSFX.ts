import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { db } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/sounds'));
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
    console.log('Reading DB...');
    await db.read();
    console.log('DB Data before:', db.data);

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
      downloads: 0,
      // likes: 0,
      // dislikes: 0
    };

    db.data.sfx.push(newSfx);

    await db.write();
    console.log('DB written to disk.');

    res.status(201).json({ message: 'SFX uploaded successfully', sfx: newSfx });
  })
);

export default router;
