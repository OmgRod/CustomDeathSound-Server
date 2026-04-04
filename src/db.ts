import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

export interface SFX {
  id: string;
  name: string;
  url: string;
  tags: string[];
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

export interface TagAuditEntry {
  id: string;
  sfxId: string;
  actorId: string;
  actorRole: 'admin' | 'moderator' | 'user';
  action: 'manual-tag-update';
  addedTags: string[];
  removedTags: string[];
  resultingTags: string[];
  createdAt: number;
}

export interface TagAuditDBSchema {
  entries: TagAuditEntry[];
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

const tagAuditFile = path.join(__dirname, '../db/tagAudit.json');
const tagAuditAdapter = new JSONFile<TagAuditDBSchema>(tagAuditFile);
const tagAuditDB = new Low<TagAuditDBSchema>(tagAuditAdapter, { entries: [] });

export async function initDB() {
  await sfxDB.read();
  let sfxTouched = false;
  if (!sfxDB.data) {
    sfxDB.data = { sfx: [] };
    sfxTouched = true;
  }

  sfxDB.data.sfx = sfxDB.data.sfx.map((item) => {
    if (!Array.isArray((item as { tags?: string[] }).tags)) {
      sfxTouched = true;
      return {
        ...item,
        tags: [],
      };
    }

    return item;
  });

  if (sfxTouched) {
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

  await tagAuditDB.read();
  if (!tagAuditDB.data) {
    tagAuditDB.data = { entries: [] };
    await tagAuditDB.write();
  }
}

export { sfxDB, packsDB, usersDB, tagAuditDB };
