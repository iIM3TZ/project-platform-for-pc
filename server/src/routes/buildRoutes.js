const express = require('express');
const builds = require('../controllers/buildController');

// Open to everyone (guests build too): they only read part specs and run the checks
const router = express.Router();

router.post('/check', builds.check);
router.post('/compatible', builds.compatible);

module.exports = router;
