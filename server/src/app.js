const path = require('path');
const express = require('express');

const app = express();

app.use(express.json());

// Static frontend
app.use(express.static(path.join(__dirname, '..', '..', 'client')));

app.get('/api/health', (req, res) => {
  res.json({ data: { status: 'ok' } });
});

module.exports = app;
