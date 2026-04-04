import { Request, Response, NextFunction } from 'express';
import { usersDB } from '../db';
import { parseCookieHeader, verifySignedSessionToken } from '../utils/session';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    githubId: string;
    role: 'admin' | 'moderator' | 'user';
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionSecret = process.env['SESSION_SECRET'] || 'dev-session-secret';
    const cookies = parseCookieHeader(req.headers.cookie);
    const session = verifySignedSessionToken(cookies['cds_session'], sessionSecret);

    if (!session) {
      res.status(401).json({ error: 'Login required' });
      return;
    }

    await usersDB.read();
    const users = usersDB.data?.users || [];

    const user = users.find((u) => u.githubId === session.userId);

    if (!user) {
      res.status(401).json({ error: 'Login required' });
      return;
    }

    req.user = {
      id: user.githubId,
      githubId: user.githubId,
      role: user.role,
    };

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
