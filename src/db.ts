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
  githubId: string;
  role: 'admin' | 'moderator' | 'user';
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
}

export { sfxDB, packsDB, usersDB };
