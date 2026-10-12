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

module.exports = { findVisibleByProductIds };
