import { Request, Response, NextFunction } from 'express';
import { usersDB } from '../db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'moderator' | 'user';
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'API key is required' });
      return;
    }

    await usersDB.read();
    const users = usersDB.data?.users || [];

    const user = users.find(u => u.apiKey === apiKey);

    if (!user) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
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
      res.status(403).json({ 
        error: 'Insufficient permissions. Only moderators and admins can upload.' 
      });
      return;
    }

    next();
  };
};
