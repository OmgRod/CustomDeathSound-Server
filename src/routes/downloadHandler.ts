import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { sfxDB } from '../db';
import { asyncHandler } from '../utils/asyncHandler';

const soundsRouter = express.Router();

soundsRouter.get('/sounds/:filename', asyncHandler(async (req, res, next) => {
  const { filename } = req.params;
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
