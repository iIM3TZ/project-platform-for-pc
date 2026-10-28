const db = require('../config/db');

// A user's builds, oldest first, and their parts (only parts that are still visible)
async function findAllByUser(userId) {
  const builds = await db.query(
    'SELECT id, name, updated_at FROM builds WHERE user_id = $1 ORDER BY created_at, id',
    [userId]
  );
  const items = await db.query(
    `SELECT bi.build_id, bi.product_id, bi.offer_id,
            p.brand, p.name, p.image_url, c.slug AS category
     FROM build_items bi
     JOIN builds b ON b.id = bi.build_id
     JOIN products p ON p.id = bi.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE b.user_id = $1 AND p.is_hidden = false
     ORDER BY bi.id`,
    [userId]
  );
  return { builds: builds.rows, items: items.rows };
}

async function countByUser(userId) {
  const result = await db.query('SELECT COUNT(*)::int AS count FROM builds WHERE user_id = $1', [userId]);
  return result.rows[0].count;
}

// Writes the parts of a build: the old ones are removed and the new ones added in one
// transaction, so a failure half way never leaves a build with only some of its parts.
// items: [{ product_id, offer_id }]
async function replaceItems(client, buildId, items) {
  await client.query('DELETE FROM build_items WHERE build_id = $1', [buildId]);
  for (const item of items) {
    await client.query(
      'INSERT INTO build_items (build_id, product_id, offer_id) VALUES ($1, $2, $3)',
      [buildId, item.product_id, item.offer_id]
    );
  }
}

async function create(userId, name, items) {
  return db.inTransaction(async (client) => {
    const result = await client.query(
      'INSERT INTO builds (user_id, name) VALUES ($1, $2) RETURNING id, name, updated_at',
      [userId, name]
    );
    await replaceItems(client, result.rows[0].id, items);
    return result.rows[0];
  });
}

// Returns null when the build does not exist or belongs to someone else
async function update(id, userId, name, items) {
  return db.inTransaction(async (client) => {
    const result = await client.query(
      `UPDATE builds SET name = $3, updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id, name, updated_at`,
      [id, userId, name]
    );
    if (result.rowCount === 0) return null;
    await replaceItems(client, id, items);
    return result.rows[0];
  });
}

// Returns false when the build does not exist or belongs to someone else
async function remove(id, userId) {
  const result = await db.query('DELETE FROM builds WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rowCount > 0;
}

module.exports = { findAllByUser, countByUser, create, update, remove };
