const express = require('express');

const router = express.Router();

router.post('/', (req, res) => {
    res.json({ message: 'Upload Pack route is working!' });
});

module.exports = router;