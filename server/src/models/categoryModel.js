const db = require('../config/db');

async function findAll() {
  const result = await db.query(
    'SELECT id, slug, name_ar, name_en, kind FROM categories ORDER BY id'
  );
  return result.rows;
}

async function findBySlug(slug) {
  const result = await db.query(
    'SELECT id, slug, name_ar, name_en, kind FROM categories WHERE slug = $1',
    [slug]
  );
  return result.rows[0] || null;
}

module.exports = { findAll, findBySlug };
