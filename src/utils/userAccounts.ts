import { v4 as uuidv4 } from 'uuid';
import { User, usersDB } from '../db';

export async function upsertGithubUser(input: {
  githubId: string;
  githubUsername: string;
  displayName?: string;
}): Promise<User> {
  await usersDB.read();

  if (!usersDB.data) {
    usersDB.data = { users: [] };
  }

  const now = Math.floor(Date.now() / 1000);
  const existingUser = usersDB.data.users.find((user) => user.githubId === input.githubId);

  if (existingUser) {
    existingUser.username = input.displayName?.trim() || input.githubUsername;
    existingUser.githubUsername = input.githubUsername;
    existingUser.role = existingUser.role || 'user';
    existingUser.lastLoginAt = now;
    existingUser.loginCount = (existingUser.loginCount ?? 0) + 1;

    await usersDB.write();
    return existingUser;
  }

  const newUser: User = {
    id: uuidv4(),
    username: input.displayName?.trim() || input.githubUsername,
    githubId: input.githubId,
    githubUsername: input.githubUsername,
    role: 'user',
    createdAt: now,
    lastLoginAt: now,
    loginCount: 1,
  };

  usersDB.data.users.push(newUser);
  await usersDB.write();
  return newUser;
}