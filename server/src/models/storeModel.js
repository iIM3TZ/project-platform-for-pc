const db = require('../config/db');

const STORE_COLUMNS = `
  id, name, website, logo_url, ships_from, avg_delivery_days,
  has_warranty, return_policy_ar, return_policy_en, trust_score
`;

async function findAll() {
  const result = await db.query(`SELECT ${STORE_COLUMNS} FROM stores ORDER BY name`);
  return result.rows;
}

async function findById(id) {
  const result = await db.query(`SELECT ${STORE_COLUMNS} FROM stores WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

module.exports = { findAll, findById };
