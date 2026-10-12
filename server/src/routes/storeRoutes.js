const express = require('express');
const { listStores, getStore } = require('../controllers/storeController');
const { validateIdParam } = require('../middleware/validation');

const router = express.Router();

router.get('/', listStores);
router.get('/:id', validateIdParam, getStore);

module.exports = router;
