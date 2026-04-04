import { Router, Response } from 'express';
import https from 'https';
import { asyncHandler } from '../utils/asyncHandler';
import { usersDB } from '../db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

type GitHubProfile = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string;
};

function requestJson<T>(url: string, options: https.RequestOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(raw || `Request failed with status ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(raw) as T);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.end();
  });
}

async function fetchGithubProfileById(githubId: string) {
  return requestJson<GitHubProfile>(`https://api.github.com/user/${encodeURIComponent(githubId)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CustomDeathSounds-Server',
    },
  });
}

// List all users (admin only)
router.get(
  '/',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await usersDB.read();
    const users = usersDB.data?.users || [];

    const enrichedUsers = await Promise.all(users.map(async (u) => {
      try {
        const profile = await fetchGithubProfileById(u.githubId);
        return {
          id: u.githubId,
          githubId: u.githubId,
          username: (profile.name || profile.login).trim(),
          githubUsername: profile.login,
          avatarUrl: profile.avatar_url || null,
          role: u.role,
        };
      } catch {
        return {
          id: u.githubId,
          githubId: u.githubId,
          username: u.githubId,
          githubUsername: u.githubId,
          avatarUrl: null,
          role: u.role,
        };
      }
    }));

    res.status(200).json({ users: enrichedUsers });
  })
);

// Delete a user (admin only)
router.delete(
  '/:userId',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await usersDB.read();

    const { userId } = req.params;

    if (!usersDB.data || !usersDB.data.users) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userIndex = usersDB.data.users.findIndex(u => u.githubId === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting yourself
    if (req.user?.githubId === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const deletedUser = usersDB.data.users[userIndex];
    usersDB.data.users.splice(userIndex, 1);
    await usersDB.write();

    res.status(200).json({
      message: 'User deleted successfully',
      githubId: deletedUser.githubId,
    });
  })
);

export default router;
