import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import sanitizeFilename from 'sanitize-filename';
import { sfxDB } from '../db';
import { asyncHandler } from './asyncHandler';
import rateLimit from 'express-rate-limit';

const soundsRouter = express.Router();

const soundsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  },
});

soundsRouter.get('/sounds/:filename', soundsRateLimiter, asyncHandler(async (req, res, next) => {
  let { filename } = req.params;
  filename = sanitizeFilename(filename);
  if (!filename) {
    console.warn('Invalid filename provided:', req.params.filename);
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  console.log(`Requested file: ${filename}`);

  await sfxDB.read();

  const entry = sfxDB.data?.sfx?.find(sfx => {
    console.log('Checking sfx.url:', sfx.url);
    return sfx.url.endsWith(`/${filename}`);
  });

  if (entry) {
    console.log('Found entry:', entry);
    entry.downloads = (entry.downloads ?? 0) + 1;
    await sfxDB.write();
    console.log(`Incremented downloads to: ${entry.downloads}`);
  } else {
    console.warn('No matching SFX entry found for:', filename);
  }

  const filePath = path.join(__dirname, '../../public/sounds', filename);
  res.sendFile(filePath, err => {
    if (err) next(err);
  });
}));

export default soundsRouter;
