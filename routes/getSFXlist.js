const express = require('express');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const router = express.Router();

const file = path.join(__dirname, '../db/sfx.json');
const adapter = new JSONFile(file);

const db = new Low(adapter, { sfx: [] });

async function initDB() {
    await db.read();
    if (!db.data) {
        db.data = { sfx: [] };
        await db.write();
    }
}

initDB();

router.get('/', async (req, res) => {
    await db.read();

    const sfxList = db.data.sfx || [];
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = 15;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    res.json({
        page,
        total: sfxList.length,
        data: sfxList.slice(start, end),
    });
});

module.exports = router;
