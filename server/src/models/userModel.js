const db = require('../config/db');

// The fields that are safe to send to the browser (never password_hash)
const PUBLIC_COLUMNS = 'id, username, email, role';

async function create({ username, email, passwordHash }) {
  const result = await db.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [username, email, passwordHash]
  );
  return result.rows[0];
}

// Sign in with a username or an email, without caring about letter case.
// This one returns password_hash, to check the password; it is never sent to the browser.
async function findForSignIn(login) {
  const result = await db.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash
     FROM users
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)`,
    [login]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

// ---------- Admin ----------

async function findAllForAdmin() {
  const result = await db.query(
    `SELECT ${PUBLIC_COLUMNS}, created_at FROM users ORDER BY created_at`
  );
  return result.rows;
}

// Returns the updated user, or null when there is no user with this id
async function updateRole(id, role) {
  const result = await db.query(
    `UPDATE users SET role = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}, created_at`,
    [id, role]
  );
  return result.rows[0] || null;
}

module.exports = { create, findForSignIn, findById, findAllForAdmin, updateRole };
