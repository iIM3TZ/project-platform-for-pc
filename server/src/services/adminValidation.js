const { RATES_TO_SAR } = require('../config/currency');
const { validateSpecs } = require('./specValidation');

// A seller that is not the store itself must have at least this rating and reviews (CLAUDE.md)
const TRUSTED_MIN_RATING = 4.5;
const TRUSTED_MIN_REVIEWS = 100;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isWebUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isOptionalNumber(value) {
  return value === null || value === undefined || value === '' || Number.isFinite(value);
}

// Product: category, brand, name, model, image_url and specs.
// Returns { product } ready to save, or { errors } keyed by field.
function validateProduct(input) {
  const errors = {};
  const category = cleanText(input.category);
  const brand = cleanText(input.brand);
  const name = cleanText(input.name);
  const model = cleanText(input.model);
  const imageUrl = cleanText(input.image_url);

  if (!brand) errors.brand = 'is required';
  else if (brand.length > 100) errors.brand = 'must be at most 100 characters';

  if (!name) errors.name = 'is required';
  else if (name.length > 200) errors.name = 'must be at most 200 characters';

  if (model.length > 100) errors.model = 'must be at most 100 characters';

  // Our own files start with "/" (e.g. /images/products/x.jpg); other images must be full links
  if (imageUrl && !imageUrl.startsWith('/') && !isWebUrl(imageUrl)) {
    errors.image_url = 'must be a link (https://...) or a path starting with /';
  }

  const specResult = validateSpecs(category, input.specs ?? {});
  if (specResult.errors) {
    for (const [key, message] of Object.entries(specResult.errors)) {
      errors[key === 'category' ? 'category' : `specs.${key}`] = message;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    product: {
      category,
      brand,
      name,
      model: model || null,
      image_url: imageUrl || null,
      specs: specResult.specs,
    },
  };
}

function isTrustedSeller({ is_official, seller_rating, seller_reviews }) {
  return (
    is_official ||
    (seller_rating !== null && seller_rating >= TRUSTED_MIN_RATING &&
      seller_reviews !== null && seller_reviews >= TRUSTED_MIN_REVIEWS)
  );
}

// Offer: store, seller, price and delivery details.
// Returns { offer } ready to save, or { errors } keyed by field.
function validateOffer(input) {
  const errors = {};

  const productId = Number(input.product_id);
  const storeId = Number(input.store_id);
  const sellerName = cleanText(input.seller_name);
  const isOfficial = input.is_official === true;
  const url = cleanText(input.url);
  const currency = cleanText(input.currency) || 'SAR';

  if (!Number.isInteger(productId) || productId <= 0) errors.product_id = 'is required';
  if (!Number.isInteger(storeId) || storeId <= 0) errors.store_id = 'is required';

  if (!sellerName) errors.seller_name = 'is required';
  else if (sellerName.length > 100) errors.seller_name = 'must be at most 100 characters';

  if (!isOptionalNumber(input.seller_rating) || (Number.isFinite(input.seller_rating) && (input.seller_rating < 0 || input.seller_rating > 5))) {
    errors.seller_rating = 'must be between 0 and 5';
  }
  if (!isOptionalNumber(input.seller_reviews) || (Number.isFinite(input.seller_reviews) && (!Number.isInteger(input.seller_reviews) || input.seller_reviews < 0))) {
    errors.seller_reviews = 'must be a whole number, 0 or more';
  }

  if (!Number.isFinite(input.price) || input.price < 0) errors.price = 'must be a number, 0 or more';
  const shipping = input.shipping_cost ?? 0;
  if (!Number.isFinite(shipping) || shipping < 0) errors.shipping_cost = 'must be a number, 0 or more';

  if (!(currency in RATES_TO_SAR)) errors.currency = `must be one of: ${Object.keys(RATES_TO_SAR).join(', ')}`;

  const daysMin = input.delivery_days_min ?? null;
  const daysMax = input.delivery_days_max ?? null;
  for (const [key, value] of [['delivery_days_min', daysMin], ['delivery_days_max', daysMax]]) {
    if (value !== null && (!Number.isInteger(value) || value < 0)) errors[key] = 'must be a whole number, 0 or more';
  }
  if (Number.isInteger(daysMin) && Number.isInteger(daysMax) && daysMax < daysMin) {
    errors.delivery_days_max = 'must be greater than or equal to the minimum';
  }

  if (!isWebUrl(url)) errors.url = 'must be a link to the product page (https://...)';

  if (Object.keys(errors).length > 0) return { errors };

  const offer = {
    product_id: productId,
    store_id: storeId,
    seller_name: sellerName,
    is_official: isOfficial,
    seller_rating: Number.isFinite(input.seller_rating) ? input.seller_rating : null,
    seller_reviews: Number.isInteger(input.seller_reviews) ? input.seller_reviews : null,
    price: input.price,
    shipping_cost: shipping,
    currency,
    delivery_days_min: daysMin,
    delivery_days_max: daysMax,
    url,
    in_stock: input.in_stock !== false,
  };

  // A seller below the trust rule can only be saved after the admin confirms they checked it
  if (!isTrustedSeller(offer) && input.seller_checked !== true) {
    return {
      errors: {
        seller_checked: `This seller is not official and is rated below ${TRUSTED_MIN_RATING} or has fewer than ${TRUSTED_MIN_REVIEWS} reviews. Confirm you checked it to save.`,
      },
    };
  }

  return { offer };
}

module.exports = { validateProduct, validateOffer, TRUSTED_MIN_RATING, TRUSTED_MIN_REVIEWS };
