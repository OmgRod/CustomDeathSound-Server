const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Get SFX by ID route is working!' });
});

module.exports = router;