// A part as a card: image, brand, name, how many stores have it, and its prices.
// Used by the Parts page, and later by the part picker in Build.

import { t, formatPrice } from '/js/i18n.js';
import { el } from '/js/components/dom.js';

function priceLine(badges, offer) {
  return el('p', { class: 'part-card-price' },
    ...badges.map((badge) => el('span', { class: `badge ${badge.className}`, text: badge.text })),
    el('span', { class: 'price', text: formatPrice(offer.total_sar) }),
    el('span', { class: 'text-muted', text: offer.store_name }));
}

// The cheapest and the most trusted offer. When they are the same offer, one price with both labels.
function renderPrices(product) {
  const { cheapest, most_trusted: mostTrusted } = product;
  const cheapestBadge = { className: 'badge-success', text: t('offers.cheapest') };
  const trustedBadge = { className: 'badge-primary', text: t('offers.mostTrusted') };

  if (!cheapest || !mostTrusted) {
    return el('p', { class: 'text-muted', text: t('parts.notAvailable') });
  }
  if (cheapest.offer_id === mostTrusted.offer_id) {
    return priceLine([cheapestBadge, trustedBadge], cheapest);
  }
  return el('div', {}, priceLine([cheapestBadge], cheapest), priceLine([trustedBadge], mostTrusted));
}

export function createPartCard(product) {
  const media = el('div', { class: 'card-media' });
  if (product.image_url) {
    media.append(el('img', { src: product.image_url, alt: `${product.brand} ${product.name}`, loading: 'lazy' }));
  } else {
    media.append(el('span', { class: 'card-media-empty', text: t('parts.noImage') }));
  }

  return el('a', { class: 'card part-card', href: `/pages/part.html?id=${product.id}` },
    media,
    el('p', { class: 'part-card-brand text-muted', text: product.brand }),
    el('h3', { class: 'card-title', text: product.name }),
    el('p', { class: 'text-muted', text: t('offers.availableIn', { count: product.store_count }) }),
    renderPrices(product));
}
