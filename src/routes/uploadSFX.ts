import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { v4 as uuidv4 } from 'uuid';
import rateLimiter from '../utils/rateLimiter';
import dotenv from "dotenv";
import leoProfanity from 'leo-profanity';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

dotenv.config();

const router = Router();

router.use((req, res, next) => {
  (req as any).sfxId = uuidv4();
  next();
});

const allowedExtensions = ['.mp3', '.wav', '.ogg', '.flac'];

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  console.log('Detected mimetype:', file.mimetype);  // debug log

  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only mp3, wav, ogg, and flac are allowed.'));
  }
};

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

const upload = multer({ storage, fileFilter });

router.post(
  '/',
  rateLimiter(15, 100),
  requireAuth,
  requireRole(['admin', 'moderator']),
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    console.log('Reading DB...');
    await sfxDB.read();
    console.log('DB Data before:', sfxDB.data);

    const { name } = req.body;
    const file = req.file;
    const sfxId = (req as any).sfxId;

    if (!name || !file) {
      return res.status(400).json({ error: 'Missing required fields: name and file' });
    }

    leoProfanity.loadDictionary("en");

    if (leoProfanity.check(name)) {
      return res.status(400).json({ error: 'Name contains inappropriate language.' });
    }

    const filesizeLimit = Number(process.env["FILESIZE_LIMIT"]);
    if (file.size > filesizeLimit) {
      return res.status(413).json({ error: `File exceeds size limit of ${filesizeLimit} bytes` });
    }

    if (!sfxDB.data) sfxDB.data = { sfx: [] };
    if (!sfxDB.data.sfx) sfxDB.data.sfx = [];

    const newSfx = {
      id: sfxId,
      name,
      url: `/sounds/${file.filename}`,
      downloads: 0,
      likes: 0,
      dislikes: 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    sfxDB.data.sfx.push(newSfx);

    await sfxDB.write();
    console.log('SFX DB written to disk.');

    res.status(201).json({ message: 'SFX uploaded successfully', sfx: newSfx });
  })
);

export default router;
