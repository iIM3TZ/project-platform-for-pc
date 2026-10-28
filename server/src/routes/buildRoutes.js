const express = require('express');
const builds = require('../controllers/buildController');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');

// The checks are open to everyone (guests build too): they only read part specs.
const router = express.Router();

router.post('/check', builds.check);
router.post('/compatible', builds.compatible);
router.post('/prebuilt-match', builds.prebuiltMatch);
router.post('/refresh', builds.refresh);

// Saved builds: signed-in users only, and each user only sees and changes their own
router.get('/', requireAuth, builds.listMine);
router.post('/', requireAuth, builds.createMine);
router.put('/:id', requireAuth, validateIdParam, builds.updateMine);
router.delete('/:id', requireAuth, validateIdParam, builds.removeMine);

module.exports = router;
