const express = require('express');
const admin = require('../controllers/adminController');
const { validateIdParam } = require('../middleware/validation');
const { requireAdmin } = require('../middleware/auth');
const { MAX_UPLOAD_BYTES } = require('../services/productImages');

// Admin-only routes: every one of them goes through requireAdmin first
// (401 for guests, 403 for users who are not admins)
const router = express.Router();
router.use(requireAdmin);

router.get('/spec-fields', admin.getSpecFields);
router.get('/product-images', admin.listImages);
// The picture is sent as raw bytes (no extra library); a bigger file gets 413 from express.raw
router.post('/product-images', express.raw({ type: 'image/*', limit: MAX_UPLOAD_BYTES }), admin.uploadImage);

router.get('/products', admin.listProducts);
router.post('/products', admin.createProduct);
router.get('/products/:id', validateIdParam, admin.getProduct);
router.put('/products/:id', validateIdParam, admin.updateProduct);
router.get('/products/:id/offers', validateIdParam, admin.listProductOffers);

router.post('/offers', admin.createOffer);
router.put('/offers/:id', validateIdParam, admin.updateOffer);

router.get('/users', admin.listUsers);
router.put('/users/:id/role', validateIdParam, admin.updateUserRole);

module.exports = router;
