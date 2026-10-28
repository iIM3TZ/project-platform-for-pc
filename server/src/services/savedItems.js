const productModel = require('../models/productModel');
const offerModel = require('../models/offerModel');

// Parts a user saves (in a build or in My list): keeps only visible parts, and an offer only when
// it belongs to its part (otherwise null, which means "use the cheapest offer").
// items: [{ product_id, offer_id, ... }]; other fields (such as quantity) are kept.
async function cleanItems(items) {
  const visible = new Set((await productModel.findByIds([...new Set(items.map((i) => i.product_id))])).map((p) => p.id));
  const owners = new Map(
    (await offerModel.findOwners(items.map((i) => i.offer_id).filter(Boolean))).map((o) => [o.id, o.product_id])
  );
  return items
    .filter((item) => visible.has(item.product_id))
    .map((item) => ({ ...item, offer_id: owners.get(item.offer_id) === item.product_id ? item.offer_id : null }));
}

module.exports = { cleanItems };
