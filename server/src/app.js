const path = require('path');
const express = require('express');
const db = require('./config/db');
const categoryRoutes = require('./routes/categoryRoutes');
const storeRoutes = require('./routes/storeRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

// Static frontend
app.use(express.static(path.join(__dirname, '..', '..', 'client')));

// Reports whether the server is up and can reach the database
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ data: { status: 'ok', database: 'connected' } });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(503).json({ error: { message: 'Database is not reachable' } });
  }
});

app.use('/api/categories', categoryRoutes);
app.use('/api/stores', storeRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
