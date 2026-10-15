import * as api from '/js/api.js';
import { initLanguage, getLanguage, t, formatPrice } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import { renderStoreList, storeLink } from '/js/components/storeOffers.js';
import { el } from '/js/components/dom.js';
import { isAddedToday } from '/js/addedDate.js';

const $ = (id) => document.getElementById(id);

// The part comes from the address: part.html?id=12
const productId = Number(new URLSearchParams(location.search).get('id'));

const state = {
  product: null,
  offers: null,      // the response of GET /api/products/:id/offers
  status: 'loading', // 'loading' | 'ready' | 'notFound' | 'error'
  storesOpen: false,
  sort: 'total',
};

// Labels in `specs` that carry examples for the admin form get a shorter label here
const SHORT_LABELS = { chipset: 'filters.chipset', cpu_name: 'filters.cpuName' };

// ---------- Rendering ----------

function renderState() {
  const box = $('part-state');
  $('part').hidden = state.status !== 'ready';
  box.hidden = state.status === 'ready';
  box.className = state.status === 'error' ? 'state alert alert-danger' : 'state';

  if (state.status === 'loading') {
    box.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }), t('states.loading'));
  } else if (state.status === 'notFound') {
    box.replaceChildren(t('part.notFound'), el('a', { href: '/pages/parts.html', text: t('parts.showAll') }));
  } else if (state.status === 'error') {
    const retry = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: t('actions.retry') });
    retry.addEventListener('click', load);
    box.replaceChildren(t('states.error'), retry);
  }
}

function renderHeader() {
  const { product } = state;
  const categoryName = getLanguage() === 'ar' ? product.category_name_ar : product.category_name_en;
  $('part-category').textContent = categoryName;
  $('part-category').href = `/pages/parts.html?category=${encodeURIComponent(product.category)}`;

  $('part-brand').textContent = product.brand;
  $('part-name').textContent = product.name;
  $('part-model').textContent = product.model ? t('part.model', { model: product.model }) : '';
  $('part-new').hidden = !isAddedToday(product.created_at);
  document.title = `${product.brand} ${product.name} | ${t('site.name')}`;

  const media = $('part-media');
  if (product.image_url) {
    media.replaceChildren(el('img', { src: product.image_url, alt: `${product.brand} ${product.name}` }));
  } else {
    media.replaceChildren(el('span', { class: 'card-media-empty', text: t('parts.noImage') }));
  }
}

// Finds an offer by id in the store groups, with the name of its store
function findOffer(id) {
  for (const group of state.offers.stores) {
    const offer = group.offers.find((item) => item.id === id);
    if (offer) return { offer, storeName: group.store.name };
  }
  return null;
}

function pickCard(badges, { offer, storeName }) {
  return el('div', { class: 'card part-pick' },
    el('div', { class: 'part-pick-badges' }, ...badges),
    el('p', { class: 'price part-pick-price', text: formatPrice(offer.total_sar) }),
    el('p', { class: 'text-muted', text: t('part.atStore', { store: storeName }) }),
    storeLink(offer, storeName));
}

// The cheapest and the most trusted offer. When they are the same offer, one card with both labels.
function renderPicks() {
  const cheapest = findOffer(state.offers.cheapest_offer_id);
  const trusted = findOffer(state.offers.most_trusted_offer_id);
  const cheapestBadge = el('span', { class: 'badge badge-success', text: t('offers.cheapest') });
  const trustedBadge = el('span', { class: 'badge badge-primary', text: t('offers.mostTrusted') });

  let cards;
  if (!cheapest || !trusted) {
    cards = [el('p', { class: 'text-muted', text: t('parts.notAvailable') })];
  } else if (cheapest.offer.id === trusted.offer.id) {
    cards = [pickCard([cheapestBadge, trustedBadge], cheapest)];
  } else {
    cards = [pickCard([cheapestBadge], cheapest), pickCard([trustedBadge], trusted)];
  }
  $('part-picks').replaceChildren(...cards);
}

function renderStores() {
  const hasStores = state.offers.stores.length > 0;
  const toggle = $('stores-toggle');
  toggle.hidden = !hasStores;
  toggle.textContent = state.storesOpen ? t('part.hideStores') : t('part.explore');
  toggle.setAttribute('aria-expanded', String(state.storesOpen));

  $('stores-panel').hidden = !(hasStores && state.storesOpen);
  if (hasStores) renderStoreList($('store-list'), { data: state.offers, sort: state.sort });
}

function specValue(row) {
  if (typeof row.value === 'boolean') return t(row.value ? 'filters.yes' : 'filters.no');
  if (Array.isArray(row.value)) return row.value.join(', ');
  if (row.translate) return t(`specOptions.${row.value}`);
  return String(row.value);
}

function renderSpecs() {
  const rows = state.product.spec_rows.map((row) => {
    const value = el('td', {}, specValue(row));
    // Monitor panel types come with a short explanation (docs/categories.md)
    if (row.key === 'panel') value.append(el('p', { class: 'field-hint', text: t(`panelHelp.${row.value}`) }));
    return el('tr', {}, el('th', { scope: 'row', text: t(SHORT_LABELS[row.key] || `specs.${row.key}`) }), value);
  });
  $('specs-body').replaceChildren(...rows);
}

function renderAll() {
  renderState();
  if (state.status !== 'ready') return;
  renderHeader();
  renderPicks();
  renderStores();
  renderSpecs();
}

// ---------- Data ----------

async function load() {
  state.status = 'loading';
  renderState();

  if (!Number.isInteger(productId) || productId <= 0) {
    state.status = 'notFound';
    renderAll();
    return;
  }

  try {
    const [product, offers] = await Promise.all([api.getProduct(productId), api.getProductOffers(productId)]);
    state.product = product;
    state.offers = offers;
    state.status = 'ready';
  } catch (err) {
    state.status = err.status === 404 ? 'notFound' : 'error';
  }
  renderAll();
}

// ---------- Start ----------

initTheme();
await initLanguage();
initNavbar();

$('stores-toggle').addEventListener('click', () => {
  state.storesOpen = !state.storesOpen;
  renderStores();
});
$('stores-sort').addEventListener('change', (event) => {
  state.sort = event.target.value;
  renderStores();
});
document.addEventListener('languagechange', renderAll);

load();
