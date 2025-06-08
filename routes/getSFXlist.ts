import express, { Request, Response } from 'express';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

interface SFX {
    // Define the structure of your SFX objects here
    // For example:
    // id: string;
    // name: string;
    // url: string;
    [key: string]: any;
}

interface DBSchema {
    sfx: SFX[];
}

const router = express.Router();

const file = path.join(__dirname, '../db/sfx.json');
const adapter = new JSONFile<DBSchema>(file);

const db = new Low<DBSchema>(adapter, { sfx: [] });

async function initDB() {
    await db.read();
    if (!db.data) {
        db.data = { sfx: [] };
        await db.write();
    }
}

initDB();

router.get('/', async (req: Request, res: Response) => {
    await db.read();

    const sfxList = db.data?.sfx || [];
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = 15;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    res.json({
        page,
        total: sfxList.length,
        data: sfxList.slice(start, end),
    });
});

export default router;
