import { Router, Request, Response } from 'express';
import { usersDB } from '../db';
import rateLimiter from '../utils/rateLimiter';

const router = Router();

router.get('/check-token', rateLimiter(1, 10), async (req: Request, res: Response) => {
  const { token } = req.query;
  if (typeof token !== 'string') {
    res.status(400).json({ valid: false, error: 'Missing token' });
    return;
  }
  await usersDB.read();
  if (!usersDB.data) {
    res.status(500).json({ valid: false, error: 'User database missing' });
    return;
  }
  const user = usersDB.data.users.find(u => u.modVerificationCode === token);
  if (!user) {
    res.status(200).json({ valid: false, error: 'The token is invalid' });
    return;
  }
  res.status(200).json({ valid: true, githubId: user.githubId });
});

router.get('/verify', async (req: Request, res: Response) => {
  const { token } = req.query;
  if (typeof token !== 'string') {
    res.status(400).send('Missing token');
    return;
  }
  await usersDB.read();
  if (!usersDB.data) {
    res.status(500).send('User database missing');
    return;
  }
  const user = usersDB.data.users.find(u => u.modVerificationCode === token);
  if (!user) {
    res.status(400).send('Invalid or expired token');
    return;
  }
  res.send('<h2>Verification successful!</h2><p>You may now return to the mod. This window can be closed.</p>');
});

export default router;
