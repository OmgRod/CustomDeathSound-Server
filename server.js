const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());

const publicDir = path.join(__dirname, 'public');
const soundsDir = path.join(publicDir, 'sounds');

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir);
}

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
