const express = require('express');
const { listProducts, getProduct, getProductOffers } = require('../controllers/productController');
const { validateIdParam } = require('../middleware/validation');

const router = express.Router();

router.get('/', listProducts);
router.get('/:id', validateIdParam, getProduct);
router.get('/:id/offers', validateIdParam, getProductOffers);

module.exports = router;
