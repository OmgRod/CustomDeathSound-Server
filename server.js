const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());

function ensureDirectoriesAndFiles() {
    const publicDir = path.join(__dirname, 'public');
    const soundsDir = path.join(publicDir, 'sounds');
    const dbDir = path.join(__dirname, 'db');
    const sfxJsonPath = path.join(dbDir, 'sfx.json');

    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
    }
    if (!fs.existsSync(soundsDir)) {
        fs.mkdirSync(soundsDir);
    }
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir);
    }
    if (!fs.existsSync(sfxJsonPath)) {
        fs.writeFileSync(sfxJsonPath, JSON.stringify([]));
    }

    return { publicDir, soundsDir, dbDir, sfxJsonPath };
}

const { publicDir } = ensureDirectoriesAndFiles();

app.use(express.static(publicDir));

app.use('/uploadSFX', require('./routes/uploadSFX'));
app.use('/getSFXbyID', require('./routes/getSFXbyID'));
app.use('/getSFXlist', require('./routes/getSFXlist'));

app.get('/', (req, res) => {
    res.send("Server is running!");
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
