import { Router, Request, Response } from 'express';
import { oneTimeTokenDB } from '../db/onetimetoken';

const router = Router();

// This route is visited by the user from the mod's link
router.get('/verify', (req: Request, res: Response) => {
  (async () => {
    const { token } = req.query;
    if (typeof token !== 'string') {
      res.status(400).send('Missing token');
      return;
    }
    await oneTimeTokenDB.read();
    if (!oneTimeTokenDB.data) {
      res.status(400).send('Token DB missing');
      return;
    }
    const entry = oneTimeTokenDB.data.tokens.find(t => t.token === token && !t.used);
    if (!entry) {
      res.status(400).send('Invalid or expired token');
      return;
    }
    // Optionally, expire after 10 minutes
    if (Math.floor(Date.now() / 1000) - entry.createdAt > 600) {
      entry.used = true;
      await oneTimeTokenDB.write();
      res.status(400).send('Token expired');
      return;
    }
    // Mark as used and show a confirmation page
    entry.used = true;
    await oneTimeTokenDB.write();
    res.send('<h2>Verification successful!</h2><p>You may now return to the mod. This window can be closed.</p>');
  })().catch((err) => {
    res.status(500).send('Internal server error');
  });
});

export default router;
