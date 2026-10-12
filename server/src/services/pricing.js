const { RATES_TO_SAR } = require('../config/currency');

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

function toSar(amount, currency) {
  const rate = RATES_TO_SAR[currency];
  if (rate === undefined) {
    throw new Error(`Unknown currency: ${currency}`);
  }
  return roundMoney(Number(amount) * rate);
}

// Turns an offer row from the database into the shape the API returns, with prices in SAR.
// pg returns NUMERIC columns as strings, so they are converted to numbers here.
function formatOffer(row) {
  const priceSar = toSar(row.price, row.currency);
  const shippingSar = toSar(row.shipping_cost, row.currency);

  return {
    id: row.id,
    product_id: row.product_id,
    store: {
      id: row.store_id,
      name: row.store_name,
      ships_from: row.ships_from,
      is_international: row.ships_from !== 'SA',
      trust_score: row.trust_score === null ? null : Number(row.trust_score),
    },
    seller_name: row.seller_name,
    is_official: row.is_official,
    seller_rating: row.seller_rating === null ? null : Number(row.seller_rating),
    seller_reviews: row.seller_reviews,
    price: Number(row.price),
    shipping_cost: Number(row.shipping_cost),
    currency: row.currency,
    price_sar: priceSar,
    shipping_sar: shippingSar,
    total_sar: roundMoney(priceSar + shippingSar),
    delivery_days_min: row.delivery_days_min,
    delivery_days_max: row.delivery_days_max,
    url: row.url,
    in_stock: row.in_stock,
    updated_at: row.updated_at,
  };
}

function pickCheapest(offers) {
  const available = offers.filter((offer) => offer.in_stock);
  if (available.length === 0) return null;
  return available.reduce((best, offer) => (offer.total_sar < best.total_sar ? offer : best));
}

// "Most trusted" order (docs/pages.md): official seller first, then store trust score,
// then seller rating, then number of reviews, then the cheaper total.
// Returns a negative number when `a` is more trusted than `b`.
function compareTrust(a, b) {
  if (a.is_official !== b.is_official) return a.is_official ? -1 : 1;

  const trustA = a.store.trust_score ?? -1;
  const trustB = b.store.trust_score ?? -1;
  if (trustA !== trustB) return trustB - trustA;

  const ratingA = a.seller_rating ?? -1;
  const ratingB = b.seller_rating ?? -1;
  if (ratingA !== ratingB) return ratingB - ratingA;

  const reviewsA = a.seller_reviews ?? -1;
  const reviewsB = b.seller_reviews ?? -1;
  if (reviewsA !== reviewsB) return reviewsB - reviewsA;

  return a.total_sar - b.total_sar;
}

function pickMostTrusted(offers) {
  const available = offers.filter((offer) => offer.in_stock);
  if (available.length === 0) return null;
  return [...available].sort(compareTrust)[0];
}

// Short version of an offer for product cards
function summarizeOffer(offer) {
  if (!offer) return null;
  return {
    offer_id: offer.id,
    total_sar: offer.total_sar,
    store_name: offer.store.name,
    seller_name: offer.seller_name,
    is_official: offer.is_official,
  };
}

module.exports = { toSar, formatOffer, pickCheapest, pickMostTrusted, summarizeOffer };
