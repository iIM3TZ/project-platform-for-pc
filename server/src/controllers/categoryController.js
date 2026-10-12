const categoryModel = require('../models/categoryModel');

async function listCategories(req, res) {
  const categories = await categoryModel.findAll();
  res.json({ data: categories });
}

module.exports = { listCategories };
