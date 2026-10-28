const { Pool } = require('pg');

// One shared pool of connections for the whole app.
// Settings come from .env (see .env.example).
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// An idle connection can fail (e.g. the database restarts). Log it instead of crashing.
pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

// Run a parameterized query: query('SELECT * FROM stores WHERE id = $1', [id])
function query(text, params) {
  return pool.query(text, params);
}

// Runs work(client) in one transaction: everything is saved, or nothing when it fails half way
async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, inTransaction };
