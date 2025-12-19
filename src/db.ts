import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

export interface SFX {
  id: string;
  name: string;
  url: string;
  downloads: number;
  likes: number;
  dislikes: number;
  createdAt: number;
}

export interface SFXDBSchema {
  sfx: SFX[];
}

export interface Packs {
  id: string;
  name: string;
  ids: string[];
  downloads: number;
  likes: number;
  dislikes: number;
  createdAt: number;
}

export interface PackDBSchema {
  packs: Packs[];
}

export interface User {
  id: string;
  username: string;
  apiKey: string;
  role: 'admin' | 'moderator' | 'user';
  createdAt: number;
}

export interface UserDBSchema {
  users: User[];
}

const sfxFile = path.join(__dirname, '../db/sfx.json');
const sfxAdapter = new JSONFile<SFXDBSchema>(sfxFile);
const sfxDB = new Low<SFXDBSchema>(sfxAdapter, { sfx: [] });

const packsFile = path.join(__dirname, '../db/packs.json');
const packsAdapter = new JSONFile<PackDBSchema>(packsFile);
const packsDB = new Low<PackDBSchema>(packsAdapter, { packs: [] });

const usersFile = path.join(__dirname, '../db/users.json');
const usersAdapter = new JSONFile<UserDBSchema>(usersFile);
const usersDB = new Low<UserDBSchema>(usersAdapter, { users: [] });

export async function initDB() {
  await sfxDB.read();
  if (!sfxDB.data) {
    sfxDB.data = { sfx: [] };
    await sfxDB.write();
  }

  await packsDB.read();
  if (!packsDB.data) {
    packsDB.data = { packs: [] };
    await packsDB.write();
  }

  await usersDB.read();
  if (!usersDB.data) {
    usersDB.data = { users: [] };
    await usersDB.write();
  }

  // Create initial admin user if INITIAL_ADMIN_API_KEY is set and no users exist
  const initialAdminKey = process.env['INITIAL_ADMIN_API_KEY'];
  if (initialAdminKey && usersDB.data.users.length === 0) {
    const adminUser: User = {
      id: 'admin-initial',
      username: 'admin',
      apiKey: initialAdminKey,
      role: 'admin',
      createdAt: Math.floor(Date.now() / 1000),
    };
    usersDB.data.users.push(adminUser);
    await usersDB.write();
    console.log('Initial admin user created. Use the INITIAL_ADMIN_API_KEY to authenticate.');
  }
}

export { sfxDB, packsDB, usersDB };
