import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

export interface SFX {
  id: string;
  name: string;
  url: string;
  downloads: number;
  // likes: number;
  // dislikes: number;
}

export interface SFXDBSchema {
  sfx: SFX[];
}

export interface Packs {
  id: number;
  name: string;
  ids: string[];
  downloads: number;
  // likes: number;
  // dislikes: number;
}

export interface PackDBSchema {
  packs: Packs[];
}

const sfxFile = path.join(__dirname, '../db/sfx.json');
const sfxAdapter = new JSONFile<SFXDBSchema>(sfxFile);
const sfxDB = new Low<SFXDBSchema>(sfxAdapter, { sfx: [] });

const packsFile = path.join(__dirname, '../db/sfx.json');
const packsAdapter = new JSONFile<PackDBSchema>(packsFile);
const packsDB = new Low<PackDBSchema>(packsAdapter, { packs: [] });

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
}

export { sfxDB, packsDB };
