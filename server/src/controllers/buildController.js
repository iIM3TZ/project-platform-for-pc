const productModel = require('../models/productModel');
const { checkBuild, fitsBuild } = require('../services/compatibility');

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

module.exports = { check, compatible };
