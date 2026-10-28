const productModel = require('../models/productModel');
const offerModel = require('../models/offerModel');
const listModel = require('../models/listModel');
const pricing = require('../services/pricing');
const { cleanItems } = require('../services/savedItems');

const MAX_ITEMS = 100;
const MAX_QUANTITY = 20;

// Reads { items: [{ product_id, offer_id, quantity }] } (quantity is 1 when left out).
// Returns { items } or { error }.
function readListItems(body) {
  const items = body?.items;
  if (!Array.isArray(items) || items.length > MAX_ITEMS) {
    return { error: `items must be a list of at most ${MAX_ITEMS} parts` };
  }
  const clean = [];
  for (const item of items) {
    const productId = Number(item?.product_id);
    const offerId = item?.offer_id === null || item?.offer_id === undefined ? null : Number(item.offer_id);
    const quantity = item?.quantity === undefined ? 1 : Number(item.quantity);
    if (!Number.isInteger(productId) || productId <= 0) return { error: 'Every item needs a product_id (a positive integer)' };
    if (offerId !== null && (!Number.isInteger(offerId) || offerId <= 0)) return { error: 'offer_id must be a positive integer or null' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { error: `quantity must be a whole number from 1 to ${MAX_QUANTITY}` };
    }
    clean.push({ product_id: productId, offer_id: offerId, quantity });
  }
  return { items: clean };
}

// Saved parts ({ product_id, offer_id, quantity, brand, name, image_url, category }) in the shape
// My list shows: the chosen offer with today's price, and every offer of the part (cheapest first)
// to switch store. An offer that was removed or hidden is replaced by the cheapest in stock; a part
// with no offer left is dropped.
async function describe(rows) {
  const productIds = [...new Set(rows.map((row) => row.product_id))];
  const offers = (await offerModel.findVisibleByProductIds(productIds)).map(pricing.formatOffer);

  return rows.map((row) => {
    const own = offers.filter((offer) => offer.product_id === row.product_id).sort((a, b) => a.total_sar - b.total_sar);
    const offer = own.find((o) => o.id === row.offer_id) ?? pricing.pickCheapest(own) ?? own[0];
    if (!offer) return null;
    return {
      product: { id: row.product_id, brand: row.brand, name: row.name, image_url: row.image_url, category: row.category },
      quantity: row.quantity,
      offer,
      offers: own,
    };
  }).filter(Boolean);
}

// POST /api/list/details { items }: a list kept in the browser (a guest's), described like the saved
// one. Parts that were removed or hidden are left out.
async function details(req, res) {
  const { items, error } = readListItems(req.body);
  if (error) return res.status(400).json({ error: { message: error } });

  const parts = await productModel.findByIds([...new Set(items.map((item) => item.product_id))]);
  const byId = new Map(parts.map((part) => [part.id, part]));
  const rows = items
    .filter((item) => byId.has(item.product_id))
    .map((item) => {
      const part = byId.get(item.product_id);
      return { ...item, brand: part.brand, name: part.name, image_url: part.image_url, category: part.category };
    });
  res.json({ data: { items: await describe(rows) } });
}

// GET /api/list: the signed-in user's list at today's prices
async function listMine(req, res) {
  res.json({ data: { items: await describe(await listModel.findByUser(req.user.id)) } });
}

// POST /api/list { items }: adds parts (from the part page, the picker or a whole build)
async function addMine(req, res) {
  const { items, error } = readListItems(req.body);
  if (error) return res.status(400).json({ error: { message: error } });
  if (items.length === 0) return res.status(400).json({ error: { message: 'items must not be empty' } });
  if (await listModel.countByUser(req.user.id) + items.length > MAX_ITEMS) {
    return res.status(400).json({ error: { message: `At most ${MAX_ITEMS} parts in My list` } });
  }
  await listModel.add(req.user.id, await cleanItems(items), MAX_QUANTITY);
  res.status(201).json({ data: { count: await listModel.countByUser(req.user.id) } });
}

// PUT /api/list { items }: saves the whole list (after a change on the My list page)
async function replaceMine(req, res) {
  const { items, error } = readListItems(req.body);
  if (error) return res.status(400).json({ error: { message: error } });
  await listModel.replace(req.user.id, await cleanItems(items));
  res.json({ data: { saved: true } });
}

module.exports = { details, listMine, addMine, replaceMine };
