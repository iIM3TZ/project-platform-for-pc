const { SPEC_FIELDS } = require('../config/specFields');
const categoryModel = require('../models/categoryModel');
const productModel = require('../models/productModel');
const offerModel = require('../models/offerModel');
const storeModel = require('../models/storeModel');
const { validateProduct, validateOffer, TRUSTED_MIN_RATING, TRUSTED_MIN_REVIEWS } = require('../services/adminValidation');

const MAX_SELLERS_PER_STORE = 2;
const UNIQUE_VIOLATION = '23505'; // PostgreSQL error code

function sendValidationErrors(res, errors) {
  return res.status(400).json({ error: { message: 'Some fields are not valid', fields: errors } });
}

// GET /api/admin/spec-fields: the form definition for every category, and the trusted seller rule
function getSpecFields(req, res) {
  res.json({
    data: {
      categories: SPEC_FIELDS,
      trusted_seller: { min_rating: TRUSTED_MIN_RATING, min_reviews: TRUSTED_MIN_REVIEWS },
    },
  });
}

// ---------- Products ----------

async function listProducts(req, res) {
  res.json({ data: await productModel.findAllForAdmin() });
}

async function getProduct(req, res) {
  const product = await productModel.findByIdForAdmin(req.id);
  if (!product) {
    return res.status(404).json({ error: { message: 'Product not found' } });
  }
  res.json({ data: product });
}

// Shared by create and update: validates the body and finds the category id
async function readProductBody(body) {
  const { product, errors } = validateProduct(body);
  if (errors) return { errors };

  const category = await categoryModel.findBySlug(product.category);
  if (!category) return { errors: { category: 'Unknown category' } };

  return { product: { ...product, categoryId: category.id } };
}

async function createProduct(req, res) {
  const { product, errors } = await readProductBody(req.body);
  if (errors) return sendValidationErrors(res, errors);

  const created = await productModel.create(product);
  res.status(201).json({ data: created });
}

async function updateProduct(req, res) {
  const { product, errors } = await readProductBody(req.body);
  if (errors) return sendValidationErrors(res, errors);

  const updated = await productModel.update(req.id, product);
  if (!updated) {
    return res.status(404).json({ error: { message: 'Product not found' } });
  }
  res.json({ data: updated });
}

// ---------- Offers ----------

async function listProductOffers(req, res) {
  const product = await productModel.findByIdForAdmin(req.id);
  if (!product) {
    return res.status(404).json({ error: { message: 'Product not found' } });
  }
  res.json({ data: await offerModel.findByProductForAdmin(req.id) });
}

// Shared by create and update. Returns { offer } or { status, error }.
async function readOfferBody(body, offerId = null) {
  const { offer, errors } = validateOffer(body);
  if (errors) return { status: 400, errors };

  if (!(await productModel.findByIdForAdmin(offer.product_id))) {
    return { status: 400, errors: { product_id: 'Product not found' } };
  }
  if (!(await storeModel.findById(offer.store_id))) {
    return { status: 400, errors: { store_id: 'Store not found' } };
  }

  const otherSellers = await offerModel.countSellersInStore(offer.product_id, offer.store_id, offerId);
  if (otherSellers >= MAX_SELLERS_PER_STORE) {
    return {
      status: 409,
      errors: { store_id: `This part already has ${MAX_SELLERS_PER_STORE} sellers in this store` },
    };
  }

  return { offer };
}

// The same seller twice for one product and store breaks the UNIQUE rule in the schema
function isDuplicateSeller(err) {
  return err.code === UNIQUE_VIOLATION;
}

async function createOffer(req, res) {
  const { offer, status, errors } = await readOfferBody(req.body);
  if (errors) {
    return res.status(status).json({ error: { message: 'Some fields are not valid', fields: errors } });
  }

  try {
    const created = await offerModel.create(offer);
    res.status(201).json({ data: created });
  } catch (err) {
    if (!isDuplicateSeller(err)) throw err;
    res.status(409).json({ error: { message: 'This seller already has an offer for this part in this store', fields: { seller_name: 'already exists in this store' } } });
  }
}

async function updateOffer(req, res) {
  const { offer, status, errors } = await readOfferBody(req.body, req.id);
  if (errors) {
    return res.status(status).json({ error: { message: 'Some fields are not valid', fields: errors } });
  }

  try {
    const updated = await offerModel.update(req.id, offer);
    if (!updated) {
      return res.status(404).json({ error: { message: 'Offer not found' } });
    }
    res.json({ data: updated });
  } catch (err) {
    if (!isDuplicateSeller(err)) throw err;
    res.status(409).json({ error: { message: 'This seller already has an offer for this part in this store', fields: { seller_name: 'already exists in this store' } } });
  }
}

module.exports = {
  getSpecFields,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  listProductOffers,
  createOffer,
  updateOffer,
};
