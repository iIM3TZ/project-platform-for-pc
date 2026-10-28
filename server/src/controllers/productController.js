const productModel = require('../models/productModel');
const offerModel = require('../models/offerModel');
const pricing = require('../services/pricing');
const { SPEC_FIELDS } = require('../config/specFields');
const { productsWithPrices } = require('../services/catalog');

const MAX_SEARCH_LENGTH = 100;

// Reads ?category= and ?q= from the URL. Returns { filters } or { error }.
function readListFilters(query) {
  const category = typeof query.category === 'string' ? query.category.trim() : '';
  const q = typeof query.q === 'string' ? query.q.trim() : '';

  if (category && !/^[a-z]+$/.test(category)) {
    return { error: 'Category must be a slug such as "gpu"' };
  }
  if (q.length > MAX_SEARCH_LENGTH) {
    return { error: `Search text must be at most ${MAX_SEARCH_LENGTH} characters` };
  }

  return { filters: { category: category || null, q: q || null } };
}

// GET /api/products?category=gpu&q=4060
// Each part comes with its specs and the ids of the stores that have it in stock,
// so the Parts page can filter in the browser.
async function listProducts(req, res) {
  const { filters, error } = readListFilters(req.query);
  if (error) {
    return res.status(400).json({ error: { message: error } });
  }

  res.json({ data: await productsWithPrices(filters) });
}

// The specs as a list in the order of the category's fields (docs/categories.md), only the
// fields that have a value. PostgreSQL stores JSONB keys in its own order, so the page
// cannot rely on the order of `specs`.
// translate: the value is a word to translate on the page (e.g. "excellent" -> "ممتاز")
function specRows(category, specs) {
  return (SPEC_FIELDS[category] || [])
    .filter((field) => specs[field.key] !== undefined && specs[field.key] !== null)
    .map((field) => ({ key: field.key, value: specs[field.key], translate: Boolean(field.translateOptions) }));
}

// GET /api/products/:id
async function getProduct(req, res) {
  const product = await productModel.findById(req.id);
  if (!product) {
    return res.status(404).json({ error: { message: 'Product not found' } });
  }
  res.json({ data: { ...product, spec_rows: specRows(product.category, product.specs) } });
}

// Groups offers by store. Each store gets its price range, its cheapest and most trusted
// seller (up to two sellers per store), and its offers, cheapest first.
function groupByStore(offers) {
  const groups = new Map();

  for (const offer of offers) {
    if (!groups.has(offer.store.id)) {
      groups.set(offer.store.id, { store: offer.store, offers: [] });
    }
    groups.get(offer.store.id).offers.push(offer);
  }

  return [...groups.values()]
    .map((group) => {
      const sorted = group.offers.sort((a, b) => a.total_sar - b.total_sar);
      return {
        store: group.store,
        min_total_sar: sorted[0].total_sar,
        max_total_sar: sorted[sorted.length - 1].total_sar,
        cheapest_offer_id: pricing.pickCheapest(sorted)?.id ?? null,
        most_trusted_offer_id: pricing.pickMostTrusted(sorted)?.id ?? null,
        offers: sorted.map(({ store, ...offer }) => offer),
      };
    })
    .sort((a, b) => a.min_total_sar - b.min_total_sar);
}

// GET /api/products/:id/offers
async function getProductOffers(req, res) {
  const product = await productModel.findById(req.id);
  if (!product) {
    return res.status(404).json({ error: { message: 'Product not found' } });
  }

  const offerRows = await offerModel.findVisibleByProductIds([product.id]);
  const offers = offerRows.map(pricing.formatOffer);

  res.json({
    data: {
      product_id: product.id,
      cheapest_offer_id: pricing.pickCheapest(offers)?.id ?? null,
      most_trusted_offer_id: pricing.pickMostTrusted(offers)?.id ?? null,
      stores: groupByStore(offers),
    },
  });
}

module.exports = { listProducts, getProduct, getProductOffers };
