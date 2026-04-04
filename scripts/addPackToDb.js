const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { v4: uuidv4 } = require('uuid');

const repoRoot = path.resolve(__dirname, '..');
const packsDbPath = path.join(repoRoot, 'db', 'packs.json');
const sfxDbPath = path.join(repoRoot, 'db', 'sfx.json');

async function askNonEmpty(rl, question) {
  while (true) {
    const value = (await rl.question(question)).trim();
    if (value.length > 0) {
      return value;
    }
    console.log('Value cannot be empty. Please try again.');
  }
}

async function loadDb(filePath, key) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed[key])) {
    throw new Error(`Invalid ${path.basename(filePath)} format. Expected an object with a ${key} array.`);
  }

  return parsed;
}

async function savePacksDb(db) {
  await fs.writeFile(packsDbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

function findInvalidIds(inputIds, validIdSet) {
  return inputIds.filter((id) => !validIdSet.has(id));
}

async function askForIds(rl, validIdSet) {
  while (true) {
    const rawIds = await rl.question('SFX IDs (comma-separated): ');
    const ids = rawIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      console.log('Please provide at least one SFX ID.');
      continue;
    }

    const dedupedIds = [...new Set(ids)];
    const invalidIds = findInvalidIds(dedupedIds, validIdSet);

    if (invalidIds.length > 0) {
      console.log(`Invalid SFX IDs: ${invalidIds.join(', ')}`);
      console.log('Use IDs that already exist in db/sfx.json.');
      continue;
    }

    return dedupedIds;
  }
}

function showAvailableSfx(sfxItems) {
  if (sfxItems.length === 0) {
    return;
  }

  console.log('Available SFX:');
  sfxItems.forEach((item) => {
    console.log(`- ${item.id} | ${item.name}`);
  });
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log('Add sound pack entries to db/packs.json');

    while (true) {
      const sfxDb = await loadDb(sfxDbPath, 'sfx');
      if (sfxDb.sfx.length === 0) {
        console.log('No SFX entries found in db/sfx.json. Add SFX first.');
        return;
      }

      const packsDb = await loadDb(packsDbPath, 'packs');
      const validIdSet = new Set(sfxDb.sfx.map((item) => String(item.id)));

      showAvailableSfx(sfxDb.sfx);

      const name = await askNonEmpty(rl, 'Pack name: ');
      const ids = await askForIds(rl, validIdSet);

      const newPack = {
        id: uuidv4(),
        name,
        ids,
        downloads: 0,
        likes: 0,
        dislikes: 0,
        createdAt: Math.floor(Date.now() / 1000),
      };

      packsDb.packs.push(newPack);
      await savePacksDb(packsDb);

      console.log('Added sound pack successfully:');
      console.log(JSON.stringify(newPack, null, 2));

      const again = (await rl.question('Do you want to add another pack? (y/N): ')).trim().toLowerCase();
      if (again !== 'y' && again !== 'yes') {
        return;
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Failed to add sound pack:', error.message);
  process.exitCode = 1;
});