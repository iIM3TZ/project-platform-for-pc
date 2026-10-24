const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./config/db');
const categoryRoutes = require('./routes/categoryRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { currentUser } = require('./middleware/auth');

const app = express();
const PAGES_DIR = path.join(__dirname, '..', '..', 'client', 'pages');

app.use(express.json());
app.use(cookieParser()); // fills req.cookies (the sign-in token)

// The style guide is a developer page: hide it on the live site
if (process.env.NODE_ENV === 'production') {
  app.get('/pages/styleguide.html', (req, res) => res.status(404).end());
}

// The home page is served at / (the file lives in client/pages)
app.get('/', (req, res) => {
  res.sendFile(path.join(PAGES_DIR, 'index.html'));
});

// The admin page: guests go to sign in, signed-in users who are not admins get the 403 page.
// The real protection is requireAdmin on every /api/admin route (the page alone holds no data);
// this keeps the page itself out of sight. Never cached, so it is not shown again after signing out.
app.get('/pages/admin.html', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const user = await currentUser(req);
  if (!user) {
    return res.redirect(`/pages/signin.html?next=${encodeURIComponent('/pages/admin.html')}`);
  }
  if (user.role !== 'admin') {
    return res.status(403).sendFile(path.join(PAGES_DIR, 'forbidden.html'));
  }
  next(); // express.static below serves the file
});

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
app.use('/api/auth', authRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
