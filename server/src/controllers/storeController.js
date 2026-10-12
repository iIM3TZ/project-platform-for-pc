const storeModel = require('../models/storeModel');

async function listStores(req, res) {
  const stores = await storeModel.findAll();
  res.json({ data: stores });
}

async function getStore(req, res) {
  const store = await storeModel.findById(req.id);
  if (!store) {
    return res.status(404).json({ error: { message: 'Store not found' } });
  }

  res.json({ data: store });
}

module.exports = { listStores, getStore };
