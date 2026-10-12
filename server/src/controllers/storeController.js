const storeModel = require('../models/storeModel');

async function listStores(req, res) {
  const stores = await storeModel.findAll();
  res.json({ data: stores });
}

async function getStore(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: { message: 'Store id must be a positive integer' } });
  }

  const store = await storeModel.findById(id);
  if (!store) {
    return res.status(404).json({ error: { message: 'Store not found' } });
  }

  res.json({ data: store });
}

module.exports = { listStores, getStore };
