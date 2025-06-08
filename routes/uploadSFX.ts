import express, { Request, Response } from 'express';
import { db } from '../src/db';

const router = express.Router();

router.post('/', async (req: Request, res: Response) => {
    try {
        await db.read();
        const { name, url } = req.body || {};
        if (!name || !url) {
            return res.status(400).json({ error: 'Missing required fields: name and url' });
        }
        if (!db.data) db.data = { sfx: [] };
        if (!db.data.sfx) db.data.sfx = [];
        const newSfx = { id: Date.now(), name, url };
        db.data.sfx.push(newSfx);
        await db.write();
        res.status(201).json({ message: 'SFX uploaded successfully', sfx: newSfx });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
