import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

export interface SFX {
  [key: string]: any;
}

export interface DBSchema {
  sfx: SFX[];
}

const file = path.join(__dirname, '../db/sfx.json');
const adapter = new JSONFile<DBSchema>(file);
const db = new Low<DBSchema>(adapter, { sfx: [] });

export async function initDB() {
  await db.read();
  if (!db.data) {
    db.data = { sfx: [] };
    await db.write();
  }
}

export { db };
