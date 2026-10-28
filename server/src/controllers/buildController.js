const productModel = require('../models/productModel');
const buildModel = require('../models/buildModel');
const offerModel = require('../models/offerModel');
const pricing = require('../services/pricing');
const { checkBuild, fitsBuild } = require('../services/compatibility');
const { matchPrebuilts } = require('../services/prebuiltMatch');
const { productsWithPrices } = require('../services/catalog');
const { cleanItems } = require('../services/savedItems');

const MAX_ITEMS = 40;

// Reads { items: [{ product_id }] } from the body. Returns { ids } or { error }.
function readItems(body) {
  const items = body?.items;
  if (!Array.isArray(items) || items.length > MAX_ITEMS) {
    return { error: `items must be a list of at most ${MAX_ITEMS} parts` };
  }
  const ids = items.map((item) => Number(item?.product_id));
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
    return { error: 'Every item needs a product_id (a positive integer)' };
  }
  return { ids };
}

// The parts in the order of the items (the same part twice, e.g. two identical drives, stays twice)
async function loadParts(ids) {
  const rows = await productModel.findByIds([...new Set(ids)]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    parts: ids.filter((id) => byId.has(id)).map((id) => byId.get(id)),
    missing: [...new Set(ids.filter((id) => !byId.has(id)))], // removed or hidden since they were picked
  };
}

// POST /api/builds/check { items: [{ product_id }] }: the compatibility of a build
async function check(req, res) {
  const { ids, error } = readItems(req.body);
  if (error) return res.status(400).json({ error: { message: error } });

  const { parts, missing } = await loadParts(ids);
  res.json({ data: { ...checkBuild(parts), missing } });
}

// POST /api/builds/compatible { category, items }: which parts of a category fit the rest of the
// build, for the part picker's "compatible only" filter. The items are the build without the part
// being changed; for every category but storage, a part of the same category is replaced, so it is
// left out here too.
async function compatible(req, res) {
  const category = typeof req.body?.category === 'string' ? req.body.category : '';
  if (!/^[a-z]+$/.test(category)) {
    return res.status(400).json({ error: { message: 'category must be a slug such as "gpu"' } });
  }
  const { ids, error } = readItems(req.body);
  if (error) return res.status(400).json({ error: { message: error } });

  const { parts } = await loadParts(ids);
  const others = category === 'storage' ? parts : parts.filter((part) => part.category !== category);
  const candidates = await productModel.findAll({ category });
  const compatibleIds = candidates
    .filter((product) => fitsBuild({ id: product.id, category, specs: product.specs }, others))
    .map((product) => product.id);

  res.json({ data: { compatible_ids: compatibleIds, total: candidates.length } });
}

// POST /api/builds/prebuilt-match { items }: ready-made PCs with the same CPU and GPU as the build
// (and at least its RAM and storage). data is null when the build has no CPU or GPU, or nothing matches.
async function prebuiltMatch(req, res) {
  const { ids, error } = readItems(req.body);
  if (error) return res.status(400).json({ error: { message: error } });

  const { parts } = await loadParts(ids);
  const hasCpuAndGpu = parts.some((p) => p.category === 'cpu') && parts.some((p) => p.category === 'gpu');
  if (!hasCpuAndGpu) return res.json({ data: null });

  const prebuilts = await productsWithPrices({ category: 'prebuilt' });
  res.json({ data: matchPrebuilts(parts, prebuilts) });
}

// ---------- Saved builds (signed-in users) ----------

const MAX_BUILDS = 50;
const MAX_NAME = 60;

// Reads { name, items: [{ product_id, offer_id }] }. Returns { value } or { error }.
function readBuildBody(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > MAX_NAME) return { error: `name must be 1 to ${MAX_NAME} characters` };

  const items = body?.items ?? [];
  if (!Array.isArray(items) || items.length > MAX_ITEMS) {
    return { error: `items must be a list of at most ${MAX_ITEMS} parts` };
  }
  const clean = [];
  for (const item of items) {
    const productId = Number(item?.product_id);
    const offerId = item?.offer_id === null || item?.offer_id === undefined ? null : Number(item.offer_id);
    if (!Number.isInteger(productId) || productId <= 0) return { error: 'Every item needs a product_id (a positive integer)' };
    if (offerId !== null && (!Number.isInteger(offerId) || offerId <= 0)) return { error: 'offer_id must be a positive integer or null' };
    clean.push({ product_id: productId, offer_id: offerId });
  }
  return { value: { name, items: clean } };
}

// Saved parts ({ product_id, offer_id, brand, name, image_url, category }) in the shape the Build page
// uses, with today's price of the chosen offer. An offer that was removed or hidden is replaced by
// the cheapest in stock; a part with no offer left is dropped.
async function withCurrentPrices(rows) {
  const productIds = [...new Set(rows.map((row) => row.product_id))];
  const offers = (await offerModel.findVisibleByProductIds(productIds)).map(pricing.formatOffer);

  return rows.map((row) => {
    const own = offers.filter((offer) => offer.product_id === row.product_id);
    const offer = own.find((o) => o.id === row.offer_id) ?? pricing.pickCheapest(own) ?? own[0];
    if (!offer) return null;
    return {
      category: row.category,
      product: { id: row.product_id, brand: row.brand, name: row.name, image_url: row.image_url },
      offer: { id: offer.id, total_sar: offer.total_sar, store_name: offer.store.name, seller_name: offer.seller_name },
    };
  }).filter(Boolean);
}

// GET /api/builds: the user's builds with their parts at today's prices
async function listMine(req, res) {
  const { builds, items } = await buildModel.findAllByUser(req.user.id);
  const priced = await Promise.all(builds.map((build) => withCurrentPrices(items.filter((item) => item.build_id === build.id))));
  res.json({ data: builds.map((build, index) => ({ ...build, items: priced[index] })) });
}

// POST /api/builds/refresh { items: [{ product_id, offer_id }] }: the parts of a build kept in the
// browser (a guest's), with today's prices. Parts that were removed or hidden are left out.
async function refresh(req, res) {
  const { value, error } = readBuildBody({ name: 'refresh', items: req.body?.items });
  if (error) return res.status(400).json({ error: { message: error } });

  const parts = await productModel.findByIds([...new Set(value.items.map((item) => item.product_id))]);
  const byId = new Map(parts.map((part) => [part.id, part]));
  const rows = value.items
    .filter((item) => byId.has(item.product_id))
    .map((item) => {
      const part = byId.get(item.product_id);
      return { ...item, brand: part.brand, name: part.name, image_url: part.image_url, category: part.category };
    });
  res.json({ data: { items: await withCurrentPrices(rows) } });
}

// POST /api/builds { name, items }
async function createMine(req, res) {
  const { value, error } = readBuildBody(req.body);
  if (error) return res.status(400).json({ error: { message: error } });
  if (await buildModel.countByUser(req.user.id) >= MAX_BUILDS) {
    return res.status(400).json({ error: { message: `At most ${MAX_BUILDS} builds per account` } });
  }
  const build = await buildModel.create(req.user.id, value.name, await cleanItems(value.items));
  res.status(201).json({ data: build });
}

// PUT /api/builds/:id { name, items }: the whole build is saved (its parts are replaced)
async function updateMine(req, res) {
  const { value, error } = readBuildBody(req.body);
  if (error) return res.status(400).json({ error: { message: error } });
  const build = await buildModel.update(req.id, req.user.id, value.name, await cleanItems(value.items));
  if (!build) return res.status(404).json({ error: { message: 'Build not found' } });
  res.json({ data: build });
}

// DELETE /api/builds/:id
async function removeMine(req, res) {
  const removed = await buildModel.remove(req.id, req.user.id);
  if (!removed) return res.status(404).json({ error: { message: 'Build not found' } });
  res.json({ data: { deleted: true } });
}

module.exports = { check, compatible, prebuiltMatch, refresh, listMine, createMine, updateMine, removeMine };
