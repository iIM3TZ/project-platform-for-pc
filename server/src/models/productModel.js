const db = require('../config/db');

// Escapes % and _ so a search for "50%" matches the text "50%", not "50 followed by anything"
function toLikePattern(text) {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

// Visible products, optionally filtered by category slug and a search text
async function findAll({ category = null, q = null } = {}) {
  const result = await db.query(
    `SELECT p.id, p.brand, p.name, p.model, p.image_url, c.slug AS category
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.is_hidden = false
       AND ($1::text IS NULL OR c.slug = $1)
       AND ($2::text IS NULL OR p.name ILIKE $2 OR p.brand ILIKE $2 OR p.model ILIKE $2)
     ORDER BY p.name`,
    [category, q ? toLikePattern(q) : null]
  );
  return result.rows;
}

async function findById(id) {
  const result = await db.query(
    `SELECT p.id, p.brand, p.name, p.model, p.image_url, p.specs,
            c.slug AS category, c.name_ar AS category_name_ar, c.name_en AS category_name_en
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1 AND p.is_hidden = false`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { findAll, findById };
