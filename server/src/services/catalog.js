const productModel = require('../models/productModel');
const offerModel = require('../models/offerModel');
const pricing = require('./pricing');

// Visible parts with their prices: how many stores have each one in stock, which ones, and its
// cheapest and most trusted offer (in SAR). Used by the Parts page and the ready-made PC suggestion.
async function productsWithPrices(filters) {
  const products = await productModel.findAll(filters);
  const offerRows = await offerModel.findVisibleByProductIds(products.map((p) => p.id));
  const offers = offerRows.map(pricing.formatOffer);

  return products.map((product) => {
    const productOffers = offers.filter((offer) => offer.product_id === product.id);
    const storesInStock = new Set(
      productOffers.filter((offer) => offer.in_stock).map((offer) => offer.store.id)
    );

    return {
      ...product,
      store_count: storesInStock.size,
      store_ids: [...storesInStock],
      cheapest: pricing.summarizeOffer(pricing.pickCheapest(productOffers)),
      most_trusted: pricing.summarizeOffer(pricing.pickMostTrusted(productOffers)),
    };
  });
}

module.exports = { productsWithPrices };
