// The offers of one part, grouped by store: one row per store (its best price and price range),
// and inside it the store's sellers (up to two). Used by the Part page, and later by the
// part picker in Build.
//
// data: the response of GET /api/products/:id/offers
// sort: 'total' | 'delivery' | 'trust'

import { t, formatPrice, formatDate } from '/js/i18n.js';
import { el } from '/js/components/dom.js';

function fastestDelivery(group) {
  return Math.min(...group.offers.map((offer) => offer.delivery_days_min ?? Infinity));
}

// Stores in the chosen order; ties go to the cheaper store
export function sortStores(stores, sort) {
  const byTotal = (a, b) => a.min_total_sar - b.min_total_sar;
  const compare = {
    total: byTotal,
    delivery: (a, b) => fastestDelivery(a) - fastestDelivery(b) || byTotal(a, b),
    trust: (a, b) => (b.store.trust_score ?? -1) - (a.store.trust_score ?? -1) || byTotal(a, b),
  }[sort] || byTotal;
  return [...stores].sort(compare);
}

function deliveryText(offer) {
  const { delivery_days_min: min, delivery_days_max: max } = offer;
  if (min === null && max === null) return '—';
  if (min === null || max === null || min === max) return t('part.daysOne', { days: min ?? max });
  return t('part.days', { min, max });
}

function badgesFor(offerId, data) {
  return [
    offerId === data.cheapest_offer_id && el('span', { class: 'badge badge-success', text: t('offers.cheapest') }),
    offerId === data.most_trusted_offer_id && el('span', { class: 'badge badge-primary', text: t('offers.mostTrusted') }),
  ];
}

function fact(label, value) {
  return el('div', { class: 'offer-fact' }, el('dt', { text: label }), el('dd', { text: value }));
}

// The store link opens in a new tab; screen readers are told so
export function storeLink(offer, storeName) {
  return el('a', {
    class: 'btn btn-primary btn-sm',
    href: offer.url,
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-label': `${t('part.goTo', { store: storeName })} ${t('part.newTab')}`,
  }, `${t('part.goTo', { store: storeName })} ↗`);
}

function offerRow(offer, storeName, data) {
  return el('div', { class: `offer-row${offer.in_stock ? '' : ' is-out-of-stock'}` },
    el('div', { class: 'offer-seller' },
      el('strong', { text: offer.seller_name }),
      offer.is_official && el('span', { class: 'badge', text: t('offers.official') }),
      ...badgesFor(offer.id, data)),
    el('dl', { class: 'offer-facts' },
      fact(t('part.price'), formatPrice(offer.price_sar)),
      fact(t('part.shipping'), offer.shipping_sar > 0 ? formatPrice(offer.shipping_sar) : t('part.freeShipping')),
      fact(t('part.total'), formatPrice(offer.total_sar)),
      fact(t('part.delivery'), deliveryText(offer)),
      fact(t('part.updated'), formatDate(offer.updated_at))),
    el('div', { class: 'offer-actions' },
      el('span', {
        class: offer.in_stock ? 'badge badge-success' : 'badge badge-danger',
        text: offer.in_stock ? t('part.inStock') : t('offers.outOfStock'),
      }),
      storeLink(offer, storeName)));
}

function storeRow(group, data) {
  const ids = group.offers.map((offer) => offer.id);
  const hasCheapest = ids.includes(data.cheapest_offer_id);
  const price = group.min_total_sar === group.max_total_sar
    ? formatPrice(group.min_total_sar)
    : t('part.range', { min: formatPrice(group.min_total_sar), max: formatPrice(group.max_total_sar) });

  return el('details', { class: `store-row${hasCheapest ? ' is-best' : ''}` },
    el('summary', { class: 'store-summary' },
      el('span', { class: 'store-name', text: group.store.name }),
      hasCheapest && el('span', { class: 'badge badge-success', text: t('offers.cheapest') }),
      ids.includes(data.most_trusted_offer_id) && el('span', { class: 'badge badge-primary', text: t('offers.mostTrusted') }),
      el('span', { class: 'price store-price', text: price })),
    el('div', { class: 'store-body' },
      group.store.is_international && el('p', { class: 'alert alert-warning', text: t('offers.customsNote') }),
      ...group.offers.map((offer) => offerRow(offer, group.store.name, data))));
}

export function renderStoreList(container, { data, sort }) {
  container.replaceChildren(...sortStores(data.stores, sort).map((group) => storeRow(group, data)));
}
