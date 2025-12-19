import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { usersDB } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// List all users (admin only)
router.get(
  '/',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await usersDB.read();
    const users = usersDB.data?.users || [];
    
    // Don't expose API keys in the list
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
    }));

    res.status(200).json({ users: sanitizedUsers });
  })
);

// Create a new user (admin only)
router.post(
  '/',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await usersDB.read();

    const { username, role } = req.body;

    if (!username || !role) {
      return res.status(400).json({ error: 'Missing required fields: username and role' });
    }

    if (!['admin', 'moderator', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, moderator, or user' });
    }

    if (!usersDB.data) usersDB.data = { users: [] };
    if (!usersDB.data.users) usersDB.data.users = [];

    // Check if username already exists
    const existingUser = usersDB.data.users.find(u => u.username === username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Generate a secure API key
    const apiKey = crypto.randomBytes(32).toString('hex');

    const newUser = {
      id: uuidv4(),
      username,
      apiKey,
      role: role as 'admin' | 'moderator' | 'user',
      createdAt: Math.floor(Date.now() / 1000),
    };

    usersDB.data.users.push(newUser);
    await usersDB.write();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        apiKey: newUser.apiKey,
        createdAt: newUser.createdAt,
      },
    });
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
