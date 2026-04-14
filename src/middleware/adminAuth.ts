import { Request, Response, NextFunction } from 'express';
import { usersDB } from '../db';
import { parseCookieHeader, verifySignedSessionToken } from '../utils/session';

export interface AdminAuthRequest extends Request {
  user?: {
    id: string;
    githubId: string;
    role: 'admin' | 'moderator' | 'user';
  };
}

// Middleware: allow either session admin or ?token=... for admin endpoints
export async function requireAdminAuth(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try session
    const sessionSecret = process.env['SESSION_SECRET'] || 'dev-session-secret';
    const cookies = parseCookieHeader(req.headers.cookie);
    const session = verifySignedSessionToken(cookies['cds_session'], sessionSecret);
    await usersDB.read();
    const users = usersDB.data?.users || [];
    let user;
    if (session) {
      user = users.find((u) => u.githubId === session.userId && u.role === 'admin');
      if (user) {
        req.user = { id: user.githubId, githubId: user.githubId, role: user.role };
        return next();
      }
    }
    // 2. Try token (query or header)
    const token = (req.query.token as string) || req.headers['x-account-token'];
    if (typeof token === 'string' && token.length > 0) {
      user = users.find((u) => u.modVerificationCode === token && u.role === 'admin');
      if (user) {
        req.user = { id: user.githubId, githubId: user.githubId, role: user.role };
        return next();
      }
    }
    // Not authenticated as admin
    res.status(403).json({ error: 'Admin authentication required' });
  } catch (error) {
    res.status(500).json({ error: 'Admin authentication error' });
  }
}
