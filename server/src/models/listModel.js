const db = require('../config/db');

// The user's My list, oldest first (only parts that are still visible)
async function findByUser(userId) {
  const result = await db.query(
    `SELECT li.product_id, li.offer_id, li.quantity,
            p.brand, p.name, p.image_url, c.slug AS category
     FROM list_items li
     JOIN products p ON p.id = li.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE li.user_id = $1 AND p.is_hidden = false
     ORDER BY li.id`,
    [userId]
  );
  return result.rows;
}

async function countByUser(userId) {
  const result = await db.query('SELECT COUNT(*)::int AS count FROM list_items WHERE user_id = $1', [userId]);
  return result.rows[0].count;
}

function insertItem(client, userId, item) {
  return client.query(
    'INSERT INTO list_items (user_id, product_id, offer_id, quantity) VALUES ($1, $2, $3, $4)',
    [userId, item.product_id, item.offer_id, item.quantity]
  );
}

// Adds parts. A part already in the list with the same offer gets its quantity raised instead
// (never above maxQuantity). items: [{ product_id, offer_id, quantity }]
async function add(userId, items, maxQuantity) {
  return db.inTransaction(async (client) => {
    for (const item of items) {
      const updated = await client.query(
        `UPDATE list_items SET quantity = LEAST(quantity + $4, $5)
         WHERE user_id = $1 AND product_id = $2 AND offer_id IS NOT DISTINCT FROM $3`,
        [userId, item.product_id, item.offer_id, item.quantity, maxQuantity]
      );
      if (updated.rowCount === 0) await insertItem(client, userId, item);
    }
  });
}

// Saves the whole list (the My list page sends it after every change)
async function replace(userId, items) {
  return db.inTransaction(async (client) => {
    await client.query('DELETE FROM list_items WHERE user_id = $1', [userId]);
    for (const item of items) await insertItem(client, userId, item);
  });
}

module.exports = { findByUser, countByUser, add, replace };
