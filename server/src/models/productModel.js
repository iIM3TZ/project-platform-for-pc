const db = require('../config/db');

// Escapes % and _ so a search for "50%" matches the text "50%", not "50 followed by anything"
function toLikePattern(text) {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

// Visible products, optionally filtered by category slug and a search text
async function findAll({ category = null, q = null } = {}) {
  const result = await db.query(
    `SELECT p.id, p.brand, p.name, p.model, p.image_url, p.specs, p.created_at, c.slug AS category
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
    `SELECT p.id, p.brand, p.name, p.model, p.image_url, p.specs, p.created_at,
            c.slug AS category, c.name_ar AS category_name_ar, c.name_en AS category_name_en
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1 AND p.is_hidden = false`,
    [id]
  );
  return result.rows[0] || null;
}

// ---------- Admin: includes hidden products ----------

const ADMIN_COLUMNS = `
  p.id, p.brand, p.name, p.model, p.image_url, p.specs, p.is_hidden, p.created_at,
  c.slug AS category
`;

async function findAllForAdmin() {
  const result = await db.query(
    `SELECT ${ADMIN_COLUMNS}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ORDER BY p.created_at DESC`
  );
  return result.rows;
}

async function findByIdForAdmin(id) {
  const result = await db.query(
    `SELECT ${ADMIN_COLUMNS}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function create({ categoryId, brand, name, model, image_url, specs }) {
  const result = await db.query(
    `INSERT INTO products (category_id, brand, name, model, image_url, specs)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [categoryId, brand, name, model, image_url, specs]
  );
  return findByIdForAdmin(result.rows[0].id);
}

async function update(id, { categoryId, brand, name, model, image_url, specs }) {
  const result = await db.query(
    `UPDATE products
     SET category_id = $2, brand = $3, name = $4, model = $5, image_url = $6, specs = $7
     WHERE id = $1
     RETURNING id`,
    [id, categoryId, brand, name, model, image_url, specs]
  );
  return result.rowCount === 0 ? null : findByIdForAdmin(id);
}

module.exports = { findAll, findById, findAllForAdmin, findByIdForAdmin, create, update };
