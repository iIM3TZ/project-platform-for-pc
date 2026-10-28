const db = require('../config/db');

// Visible offers (with their store) for one or more products, in a single query
async function findVisibleByProductIds(productIds) {
  if (productIds.length === 0) return [];

  const result = await db.query(
    `SELECT o.id, o.product_id, o.store_id, o.seller_name, o.is_official,
            o.seller_rating, o.seller_reviews, o.price, o.shipping_cost, o.currency,
            o.delivery_days_min, o.delivery_days_max, o.url, o.in_stock, o.updated_at,
            s.name AS store_name, s.ships_from, s.trust_score
     FROM offers o
     JOIN stores s ON s.id = o.store_id
     WHERE o.product_id = ANY($1::int[]) AND o.is_hidden = false`,
    [productIds]
  );
  return result.rows;
}

// The offers among these ids, with their part, to check that an offer belongs to its part
async function findOwners(offerIds) {
  if (offerIds.length === 0) return [];
  const result = await db.query('SELECT id, product_id FROM offers WHERE id = ANY($1::int[])', [offerIds]);
  return result.rows;
}

// ---------- Admin: includes hidden offers ----------

const ADMIN_COLUMNS = `
  o.id, o.product_id, o.store_id, s.name AS store_name, o.seller_name, o.is_official,
  o.seller_rating, o.seller_reviews, o.price, o.shipping_cost, o.currency,
  o.delivery_days_min, o.delivery_days_max, o.url, o.in_stock, o.is_hidden, o.updated_at
`;

async function findByProductForAdmin(productId) {
  const result = await db.query(
    `SELECT ${ADMIN_COLUMNS}
     FROM offers o
     JOIN stores s ON s.id = o.store_id
     WHERE o.product_id = $1
     ORDER BY s.name, o.price`,
    [productId]
  );
  return result.rows;
}

async function findByIdForAdmin(id) {
  const result = await db.query(
    `SELECT ${ADMIN_COLUMNS}
     FROM offers o
     JOIN stores s ON s.id = o.store_id
     WHERE o.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// How many sellers this product already has in this store (not counting excludeOfferId)
async function countSellersInStore(productId, storeId, excludeOfferId = null) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM offers
     WHERE product_id = $1 AND store_id = $2 AND ($3::int IS NULL OR id <> $3)`,
    [productId, storeId, excludeOfferId]
  );
  return result.rows[0].count;
}

// Fixed list of column names (never user input), so it is safe to build the column list from it.
// The values themselves are always passed as $1, $2... parameters.
const OFFER_FIELDS = [
  'product_id', 'store_id', 'seller_name', 'is_official', 'seller_rating', 'seller_reviews',
  'price', 'shipping_cost', 'currency', 'delivery_days_min', 'delivery_days_max', 'url', 'in_stock',
];

async function create(offer) {
  const values = OFFER_FIELDS.map((field) => offer[field]);
  const result = await db.query(
    `INSERT INTO offers (${OFFER_FIELDS.join(', ')})
     VALUES (${OFFER_FIELDS.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING id`,
    values
  );
  return findByIdForAdmin(result.rows[0].id);
}

async function update(id, offer) {
  const values = OFFER_FIELDS.map((field) => offer[field]);
  const assignments = OFFER_FIELDS.map((field, i) => `${field} = $${i + 2}`).join(', ');
  const result = await db.query(
    `UPDATE offers SET ${assignments}, updated_at = now() WHERE id = $1 RETURNING id`,
    [id, ...values]
  );
  return result.rowCount === 0 ? null : findByIdForAdmin(id);
}

module.exports = {
  findVisibleByProductIds,
  findOwners,
  findByProductForAdmin,
  findByIdForAdmin,
  countSellersInStore,
  create,
  update,
};
