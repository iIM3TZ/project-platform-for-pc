// The part picker on the Build page: a panel over the page (full screen on phones) with the parts
// of one category, a search box and a price filter. Pressing a part shows its prices in every
// store; the user picks the store and seller (the cheapest is picked first) and adds it.
//
// The panel markup is in build.html (<dialog id="picker">). Usage:
//   const picker = createPartPicker({ onAdd: (item) => ... });
//   picker.open('gpu', 'كرت الشاشة');
// item: { category, product: { id, brand, name, image_url }, offer: { id, total_sar, store_name, seller_name } }

import * as api from '/js/api.js';
import { t, formatPrice } from '/js/i18n.js';
import { el } from '/js/components/dom.js';

const $ = (id) => document.getElementById(id);

function deliveryText(offer) {
  const { delivery_days_min: min, delivery_days_max: max } = offer;
  if (min === null && max === null) return '';
  if (min === null || max === null || min === max) return t('part.daysOne', { days: min ?? max });
  return t('part.days', { min, max });
}

function numberOrNull(input) {
  const number = Number(input.value);
  return input.value === '' || !Number.isFinite(number) || number < 0 ? null : number;
}

export function createPartPicker({ onAdd }) {
  const dialog = $('picker');
  const list = $('picker-list');
  const stateBox = $('picker-state');

  const productsCache = new Map(); // category -> parts (with their cheapest and most trusted price)
  const offersCache = new Map();   // product id -> { status, data } for the open part

  const state = {
    category: null,
    categoryLabel: '',
    products: [],
    status: 'loading', // 'loading' | 'ready' | 'error'
    openId: null,      // the part whose prices are shown
    compatibleIds: null, // Set of the parts that fit the rest of the build, or null when unknown
    chosenOfferId: null,
  };

  // ---------- The list of parts ----------

  function visibleProducts() {
    const q = $('picker-search').value.trim().toLowerCase();
    const min = numberOrNull($('picker-min'));
    const max = numberOrNull($('picker-max'));

    const onlyCompatible = $('picker-compatible').checked && state.compatibleIds;

    return state.products.filter((product) => {
      if (onlyCompatible && !state.compatibleIds.has(product.id)) return false;
      const text = `${product.brand} ${product.name} ${product.model ?? ''}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (min === null && max === null) return true;
      const price = product.cheapest?.total_sar;
      if (price === undefined) return false;
      return (min === null || price >= min) && (max === null || price <= max);
    });
  }

  function partPicture(product) {
    return product.image_url
      ? el('img', { class: 'picker-thumb', src: product.image_url, alt: '', loading: 'lazy' })
      : el('span', { class: 'picker-thumb picker-thumb-empty', 'aria-hidden': 'true' });
  }

  function partRow(product) {
    const isOpen = product.id === state.openId;
    const price = product.cheapest
      ? el('span', { class: 'price', text: formatPrice(product.cheapest.total_sar) })
      : el('span', { class: 'text-muted', text: t('parts.notAvailable') });

    const toggle = el('button', {
      class: 'picker-part',
      type: 'button',
      'aria-expanded': String(isOpen),
    },
      partPicture(product),
      el('span', { class: 'picker-part-text' },
        el('strong', { text: product.name }),
        el('span', { class: 'text-muted', text: product.brand })),
      price);
    toggle.addEventListener('click', () => toggleProduct(product));

    return el('li', { class: `picker-item${isOpen ? ' is-open' : ''}` }, toggle, isOpen && offersArea(product));
  }

  function renderList() {
    $('picker-title').textContent = t('build.pickerTitle', { category: state.categoryLabel });
    stateBox.hidden = false;
    stateBox.className = 'state';
    list.replaceChildren();

    if (state.status === 'loading') {
      stateBox.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }), t('states.loading'));
      return;
    }
    if (state.status === 'error') {
      stateBox.className = 'state alert alert-danger';
      const retry = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: t('actions.retry') });
      retry.addEventListener('click', () => loadProducts(true));
      stateBox.replaceChildren(t('states.error'), retry);
      return;
    }

    const products = visibleProducts();
    const counted = $('picker-compatible').checked && state.compatibleIds ? 'build.showingCompatible' : 'build.showing';
    $('picker-count').textContent = t(counted, { shown: products.length, total: state.products.length });
    if (products.length === 0) {
      stateBox.replaceChildren(t('build.noParts'));
      return;
    }
    stateBox.hidden = true;
    list.replaceChildren(...products.map((product) => partRow(product)));
  }

  // ---------- Prices of the open part ----------

  // Every offer of the part, cheapest first, with the name of its store
  function flatOffers(data) {
    return data.stores
      .flatMap((group) => group.offers.map((offer) => ({ ...offer, store_name: group.store.name })))
      .sort((a, b) => a.total_sar - b.total_sar);
  }

  function offerChoice(product, offer, data) {
    const input = el('input', {
      type: 'radio',
      name: `offer-${product.id}`,
      value: String(offer.id),
      checked: offer.id === state.chosenOfferId,
      disabled: !offer.in_stock,
    });
    input.addEventListener('change', () => { state.chosenOfferId = offer.id; });

    return el('label', { class: `offer-choice${offer.in_stock ? '' : ' is-out-of-stock'}` },
      input,
      el('span', { class: 'offer-choice-text' },
        el('span', { class: 'offer-choice-store' },
          el('strong', { text: offer.store_name }),
          el('span', { class: 'text-muted', text: offer.seller_name }),
          offer.is_official && el('span', { class: 'badge', text: t('offers.official') }),
          offer.id === data.cheapest_offer_id && el('span', { class: 'badge badge-success', text: t('offers.cheapest') }),
          offer.id === data.most_trusted_offer_id && el('span', { class: 'badge badge-primary', text: t('offers.mostTrusted') })),
        el('span', { class: 'text-muted', text: offer.in_stock ? deliveryText(offer) : t('offers.outOfStock') })),
      el('span', { class: 'price', text: formatPrice(offer.total_sar) }));
  }

  function offersArea(product) {
    const entry = offersCache.get(product.id);
    if (!entry || entry.status === 'loading') {
      return el('div', { class: 'picker-offers state' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), t('states.loading'));
    }
    if (entry.status === 'error') {
      return el('div', { class: 'picker-offers alert alert-danger', text: t('states.error') });
    }

    const offers = flatOffers(entry.data);
    if (!offers.some((offer) => offer.in_stock)) {
      return el('div', { class: 'picker-offers text-muted', text: t('build.noOffers') });
    }

    const add = el('button', { class: 'btn btn-primary', type: 'button', text: t('actions.addToBuild') });
    add.addEventListener('click', () => addToBuild(product, offers));

    return el('div', { class: 'picker-offers' },
      el('fieldset', { class: 'offer-choices' },
        el('legend', { text: t('build.pickOffer') }),
        ...offers.map((offer) => offerChoice(product, offer, entry.data))),
      el('div', { class: 'picker-actions' },
        add,
        el('a', { class: 'btn btn-ghost', href: `/pages/part.html?id=${product.id}`, target: '_blank', rel: 'noopener', text: t('actions.details') })));
  }

  async function toggleProduct(product) {
    if (state.openId === product.id) {
      state.openId = null;
      renderList();
      return;
    }
    state.openId = product.id;
    state.chosenOfferId = null;

    if (!offersCache.has(product.id) || offersCache.get(product.id).status === 'error') {
      offersCache.set(product.id, { status: 'loading' });
      renderList();
      try {
        offersCache.set(product.id, { status: 'ready', data: await api.getProductOffers(product.id) });
      } catch {
        offersCache.set(product.id, { status: 'error' });
      }
    }

    // The cheapest offer in stock is picked first
    const entry = offersCache.get(product.id);
    if (entry.status === 'ready') {
      const firstInStock = flatOffers(entry.data).find((offer) => offer.in_stock);
      state.chosenOfferId = entry.data.cheapest_offer_id ?? firstInStock?.id ?? null;
    }
    if (state.openId === product.id) renderList();
  }

  function addToBuild(product, offers) {
    const offer = offers.find((item) => item.id === state.chosenOfferId && item.in_stock);
    if (!offer) return;
    onAdd({
      category: state.category,
      product: { id: product.id, brand: product.brand, name: product.name, image_url: product.image_url },
      offer: { id: offer.id, total_sar: offer.total_sar, store_name: offer.store_name, seller_name: offer.seller_name },
    });
    dialog.close();
  }

  // ---------- Opening ----------

  async function loadProducts(force = false) {
    const category = state.category;
    if (!force && productsCache.has(category)) {
      state.products = productsCache.get(category);
      state.status = 'ready';
      renderList();
      return;
    }

    state.status = 'loading';
    renderList();
    try {
      const products = await api.getProducts({ category });
      productsCache.set(category, products);
      if (state.category !== category) return; // another category was opened meanwhile
      state.products = products;
      state.status = 'ready';
    } catch {
      if (state.category !== category) return;
      state.status = 'error';
    }
    renderList();
  }

  // Which parts of the category fit the rest of the build (asked again each time it opens)
  async function loadCompatible(category, otherIds) {
    state.compatibleIds = null;
    try {
      const { compatible_ids: ids } = await api.compatibleProducts(category, otherIds);
      if (state.category !== category) return;
      state.compatibleIds = new Set(ids);
    } catch {
      // Without the answer the picker shows every part
    }
    if (state.status === 'ready') renderList();
  }

  // otherIds: the product ids of the rest of the build, without the part being changed
  function open(category, categoryLabel, otherIds = []) {
    state.category = category;
    state.categoryLabel = categoryLabel;
    state.openId = null;
    $('picker-count').textContent = '';
    $('picker-search').value = '';
    $('picker-min').value = '';
    $('picker-max').value = '';
    dialog.showModal();
    $('picker-search').focus();
    loadProducts();
    loadCompatible(category, otherIds);
  }

  // ---------- Events ----------

  $('picker-close').addEventListener('click', () => dialog.close());
  // A click on the dark area around the panel closes it (Escape is handled by <dialog>)
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  $('picker-compatible').addEventListener('change', renderList);
  for (const id of ['picker-search', 'picker-min', 'picker-max']) {
    $(id).addEventListener('input', renderList);
  }
  document.addEventListener('languagechange', () => {
    if (dialog.open) renderList();
  });

  return { open };
}
