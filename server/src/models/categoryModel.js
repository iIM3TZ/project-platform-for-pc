const db = require('../config/db');

async function findAll() {
  const result = await db.query(
    'SELECT id, slug, name_ar, name_en, kind FROM categories ORDER BY id'
  );
  return result.rows;
}

module.exports = { findAll };
