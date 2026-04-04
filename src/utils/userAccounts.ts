import { User, usersDB } from '../db';

export async function upsertGithubUser(input: {
  githubId: string;
  githubUsername?: string;
}): Promise<User> {
  await usersDB.read();

  if (!usersDB.data) {
    usersDB.data = { users: [] };
  }

  const existingUser = usersDB.data.users.find((user) => user.githubId === input.githubId);

  if (existingUser) {
    existingUser.role = existingUser.role || 'user';

    await usersDB.write();
    return existingUser;
  }

  const legacyMatch = usersDB.data.users.find((user) => (user as { id?: string }).id === input.githubId);
  if (legacyMatch) {
    (legacyMatch as User).githubId = input.githubId;
    legacyMatch.role = legacyMatch.role || 'user';
    await usersDB.write();
    return legacyMatch;
  }

  const newUser: User = {
    githubId: input.githubId,
    role: 'user',
  };

  usersDB.data.users.push(newUser);
  await usersDB.write();
  return newUser;
}