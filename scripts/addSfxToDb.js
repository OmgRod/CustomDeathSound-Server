const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { v4: uuidv4 } = require('uuid');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = path.join(repoRoot, 'db', 'sfx.json');
const soundsDir = path.join(repoRoot, 'public', 'sounds');

async function askNonEmpty(rl, question) {
  while (true) {
    const value = (await rl.question(question)).trim();
    if (value.length > 0) {
      return value;
    }
    console.log('Value cannot be empty. Please try again.');
  }
}

async function askExistingSoundFilename(rl) {
  while (true) {
    const input = (await rl.question('Sound filename (must already exist in public/sounds): ')).trim();

    if (!input) {
      console.log('Filename cannot be empty.');
      continue;
    }

    if (path.basename(input) !== input || input.includes('..')) {
      console.log('Please provide only a filename from public/sounds (no paths).');
      continue;
    }

    const filePath = path.join(soundsDir, input);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        console.log('That name exists but is not a file.');
        continue;
      }
      return input;
    } catch {
      console.log(`File not found: ${path.join('public', 'sounds', input)}`);
    }
  }
}

async function loadDb() {
  const raw = await fs.readFile(dbPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sfx)) {
    throw new Error('Invalid db/sfx.json format. Expected an object with an sfx array.');
  }

  return parsed;
}

async function saveDb(db) {
  await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log('Add a new SFX entry to db/sfx.json');
    console.log('This script does not copy files. The sound file must already exist in public/sounds.');

    const name = await askNonEmpty(rl, 'SFX name: ');
    const filename = await askExistingSoundFilename(rl);

    const db = await loadDb();
    const url = `/sounds/${filename}`;

    const alreadyExists = db.sfx.some((item) => item && item.url === url);
    if (alreadyExists) {
      const confirm = (await rl.question('An entry already exists with this filename. Add another anyway? (y/N): '))
        .trim()
        .toLowerCase();
      if (confirm !== 'y' && confirm !== 'yes') {
        console.log('Cancelled. No changes were written.');
        return;
      }
    }

    const newEntry = {
      id: uuidv4(),
      name,
      url,
      downloads: 0,
      likes: 0,
      dislikes: 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    db.sfx.push(newEntry);
    await saveDb(db);

    console.log('Added SFX entry successfully:');
    console.log(JSON.stringify(newEntry, null, 2));
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Failed to add SFX entry:', error.message);
  process.exitCode = 1;
});
