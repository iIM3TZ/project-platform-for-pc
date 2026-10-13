const path = require('path');
const express = require('express');
const db = require('./config/db');
const categoryRoutes = require('./routes/categoryRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

// The style guide is a developer page: hide it on the live site
if (process.env.NODE_ENV === 'production') {
  app.get('/pages/styleguide.html', (req, res) => res.status(404).end());
}

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
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
