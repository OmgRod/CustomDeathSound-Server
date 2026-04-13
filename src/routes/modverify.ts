import { Router, Request, Response } from 'express';
import { usersDB } from '../db';

const router = Router();

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
