import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { usersDB } from '../db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// List all users (admin only)
router.get(
  '/',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await usersDB.read();
    const users = usersDB.data?.users || [];
    
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      githubUsername: u.githubUsername ?? u.username,
      role: u.role,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt ?? u.createdAt,
      loginCount: u.loginCount ?? 1,
    }));

    res.status(200).json({ users: sanitizedUsers });
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

    const userIndex = usersDB.data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting yourself
    if (req.user?.id === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const deletedUser = usersDB.data.users[userIndex];
    usersDB.data.users.splice(userIndex, 1);
    await usersDB.write();

    res.status(200).json({
      message: 'User deleted successfully',
      username: deletedUser.username,
    });
  })
);

export default router;
