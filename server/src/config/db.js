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

module.exports = { pool, query };
