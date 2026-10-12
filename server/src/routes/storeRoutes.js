const express = require('express');
const { listStores, getStore } = require('../controllers/storeController');

const router = express.Router();

router.get('/', listStores);
router.get('/:id', getStore);

module.exports = router;
