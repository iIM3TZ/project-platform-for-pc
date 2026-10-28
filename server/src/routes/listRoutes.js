const express = require('express');
const list = require('../controllers/listController');
const { requireAuth } = require('../middleware/auth');

// My list (قائمتي). Guests keep it in the browser and only ask for its details;
// signed-in users keep it in their account, and each user only reaches their own.
const router = express.Router();

router.post('/details', list.details);

router.get('/', requireAuth, list.listMine);
router.post('/', requireAuth, list.addMine);
router.put('/', requireAuth, list.replaceMine);

module.exports = router;
