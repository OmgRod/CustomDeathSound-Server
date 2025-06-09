import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use((req, res, next) => {
  (req as any).sfxId = uuidv4();
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/sounds'));
  },
  filename: (req, file, cb) => {
    const sfxId = (req as any).sfxId;
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${sfxId}-${sanitizedName}`);
  },
});

const upload = multer({ storage });

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('Reading DB...');
    await sfxDB.read();
    console.log('DB Data before:', sfxDB.data);

    const { name } = req.body;
    const file = req.file;
    const sfxId = (req as any).sfxId;

    if (!name || !file) {
      return res.status(400).json({ error: 'Missing required fields: name and file' });
    }

    if (!sfxDB.data) sfxDB.data = { sfx: [] };
    if (!sfxDB.data.sfx) sfxDB.data.sfx = [];

    const newSfx = {
      id: sfxId,
      name,
      url: `/sounds/${file.filename}`,
      downloads: 0,
      // likes: 0,
      // dislikes: 0
    };

    sfxDB.data.sfx.push(newSfx);

    await sfxDB.write();
    console.log('SFX DB written to disk.');

    res.status(201).json({ message: 'SFX uploaded successfully', sfx: newSfx });
  })
);

export default router;
