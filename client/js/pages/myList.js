import * as api from '/js/api.js';
import { initLanguage, t, formatPrice } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import { el } from '/js/components/dom.js';
import { storeLink } from '/js/components/storeOffers.js';
import { loadLocalList, saveLocalList, clearLocalList, MAX_QUANTITY } from '/js/listStore.js';

const $ = (id) => document.getElementById(id);
const SAVE_DELAY_MS = 400;

// items: [{ product, quantity, offer, offers }] as the API describes them (offer is the chosen one)
const state = {
  user: null,
  items: [],
  status: 'loading', // 'loading' | 'ready' | 'error'
};

// ---------- Totals ----------

// Price times quantity, plus the shipping of that offer once
const lineTotal = (item) => item.offer.price_sar * item.quantity + item.offer.shipping_sar;

const deliveryDays = (offer) => offer.delivery_days_max ?? offer.delivery_days_min;

function deliveryText(offer) {
  const { delivery_days_min: min, delivery_days_max: max } = offer;
  if (min === null && max === null) return '—';
  if (min === null || max === null || min === max) return t('part.daysOne', { days: min ?? max });
  return t('part.days', { min, max });
}

// The longest delivery among some items, as text
function longestText(items) {
  const days = items.map((item) => deliveryDays(item.offer)).filter((value) => value !== null);
  return days.length > 0 ? t('part.daysOne', { days: Math.max(...days) }) : '—';
}

// The items grouped by the store of their chosen offer, in the order they were added
function byStore() {
  const groups = new Map();
  for (const item of state.items) {
    const store = item.offer.store;
    if (!groups.has(store.id)) groups.set(store.id, { store, items: [] });
    groups.get(store.id).items.push(item);
  }
  return [...groups.values()];
}

// ---------- Rendering ----------

function renderState() {
  const box = $('list-state');
  const empty = state.status === 'ready' && state.items.length === 0;
  $('list-layout').hidden = state.status !== 'ready' || empty;
  box.hidden = state.status === 'ready' && !empty;
  box.className = state.status === 'error' ? 'state alert alert-danger' : 'state';

  if (state.status === 'loading') {
    box.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }), t('states.loading'));
  } else if (state.status === 'error') {
    const retry = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: t('actions.retry') });
    retry.addEventListener('click', load);
    box.replaceChildren(t('states.error'), retry);
  } else if (empty) {
    box.replaceChildren(
      el('span', { text: t('myList.empty') }),
      el('a', { class: 'btn btn-primary btn-sm', href: '/pages/parts.html', text: t('myList.browse') }),
      el('a', { class: 'btn btn-secondary btn-sm', href: '/pages/build.html', text: t('nav.build') }));
  }
}

function offerLabel(offer) {
  const stock = offer.in_stock ? '' : ` (${t('offers.outOfStock')})`;
  return `${offer.store.name} · ${offer.seller_name} · ${formatPrice(offer.total_sar)}${stock}`;
}

function itemRow(item) {
  const { product, offer } = item;
  const name = `${product.brand} ${product.name}`;

  const offerSelect = el('select', { class: 'select', 'aria-label': t('myList.offer') },
    ...item.offers.map((choice) => el('option', { value: String(choice.id), selected: choice.id === offer.id, text: offerLabel(choice) })));
  offerSelect.addEventListener('change', () => {
    item.offer = item.offers.find((choice) => choice.id === Number(offerSelect.value));
    changed();
  });

  const quantity = el('input', {
    class: 'input list-qty', type: 'number', min: '1', max: String(MAX_QUANTITY), step: '1',
    value: String(item.quantity), 'aria-label': t('myList.quantity'),
  });
  quantity.addEventListener('change', () => {
    const value = Math.round(Number(quantity.value));
    item.quantity = Number.isFinite(value) ? Math.min(Math.max(value, 1), MAX_QUANTITY) : 1;
    changed();
  });

  const remove = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: t('build.remove'), 'aria-label': `${t('build.remove')}: ${name}` });
  remove.addEventListener('click', () => {
    state.items = state.items.filter((other) => other !== item);
    changed();
  });

  return el('li', { class: 'list-item' },
    el('a', { class: 'list-item-media', href: `/pages/part.html?id=${product.id}`, 'aria-hidden': 'true', tabindex: '-1' },
      product.image_url ? el('img', { src: product.image_url, alt: '' }) : el('span', { class: 'card-media-empty', text: t('parts.noImage') })),
    el('div', { class: 'list-item-main' },
      el('a', { class: 'list-item-name', href: `/pages/part.html?id=${product.id}`, text: name }),
      el('div', { class: 'list-item-meta' },
        el('span', { text: t('myList.priceLine', { price: formatPrice(offer.price_sar) }) }),
        el('span', { text: offer.shipping_sar > 0 ? t('myList.shippingLine', { price: formatPrice(offer.shipping_sar) }) : t('part.freeShipping') }),
        el('span', { text: t('myList.deliveryLine', { days: deliveryText(offer) }) }),
        !offer.in_stock && el('span', { class: 'badge badge-danger', text: t('offers.outOfStock') })),
      el('div', { class: 'list-item-controls' }, offerSelect, quantity)),
    el('div', { class: 'list-item-end' },
      el('strong', { class: 'price', text: formatPrice(lineTotal(item)) }),
      storeLink(offer, offer.store.name),
      remove));
}

function storeBox({ store, items }) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  return el('section', { class: 'card list-store' },
    el('header', { class: 'list-store-head' },
      el('h2', { text: store.name }),
      store.is_international && el('span', { class: 'badge badge-warning', text: t('myList.international') })),
    store.is_international && el('p', { class: 'alert alert-warning', text: t('offers.customsNote') }),
    el('ul', { class: 'list-items' }, ...items.map(itemRow)),
    el('footer', { class: 'list-store-foot' },
      el('span', { text: t('myList.storeDelivery', { days: longestText(items) }) }),
      el('span', {}, `${t('myList.subtotal')} `, el('strong', { class: 'price', text: formatPrice(subtotal) }))));
}

function render() {
  renderState();
  document.title = `${t('myList.title')} | ${t('site.name')}`;
  if (state.status !== 'ready' || state.items.length === 0) return;

  const groups = byStore();
  $('list-stores').replaceChildren(...groups.map(storeBox));
  $('list-count').textContent = String(state.items.reduce((sum, item) => sum + item.quantity, 0));
  $('list-store-count').textContent = String(groups.length);
  $('list-longest').textContent = longestText(state.items);
  $('list-total').textContent = formatPrice(state.items.reduce((sum, item) => sum + lineTotal(item), 0));
}

// ---------- Saving ----------

const refsOf = (items) => items.map((item) => ({ product_id: item.product.id, offer_id: item.offer.id, quantity: item.quantity }));

let saveTimer = null;

async function saveToAccount(options = {}) {
  saveTimer = null;
  try {
    await api.replaceList(refsOf(state.items), options);
    $('list-save-error').hidden = true;
  } catch {
    $('list-save-error').textContent = t('myList.saveError');
    $('list-save-error').hidden = false;
  }
}

// Every change is saved right away: guests in this browser, signed-in users in their account
function changed() {
  render();
  if (!state.user) {
    saveLocalList(refsOf(state.items));
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToAccount, SAVE_DELAY_MS);
}

// A change made just before closing the page is still sent
window.addEventListener('pagehide', () => {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  saveToAccount({ keepalive: true });
});

// ---------- Loading ----------

function showNotice(text) {
  $('list-notice').textContent = text;
  $('list-notice').hidden = false;
}

async function load() {
  state.status = 'loading';
  render();
  try {
    const local = loadLocalList();
    if (state.user) {
      // A list made as a guest in this browser moves to the account
      if (local.length > 0) {
        await api.addListItems(local);
        clearLocalList();
        showNotice(t('myList.movedToAccount'));
      }
      state.items = (await api.getList()).items;
    } else {
      state.items = (await api.listDetails(local)).items;
      const removed = local.length - state.items.length;
      if (removed > 0) showNotice(t('myList.partsRemoved', { count: removed }));
      saveLocalList(refsOf(state.items)); // removed parts and replaced offers are saved too
    }
    state.status = 'ready';
  } catch {
    state.status = 'error';
  }
  render();
}

// ---------- Start ----------

initTheme();
await initLanguage();
initNavbar();

try {
  state.user = await api.getMe();
} catch {
  state.user = null; // treated as a guest
}
document.addEventListener('languagechange', render);
load();
