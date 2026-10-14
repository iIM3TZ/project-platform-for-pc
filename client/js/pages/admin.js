import * as api from '/js/api.js';
import { initLanguage, toggleLanguage, getLanguage, t } from '/js/i18n.js';
import { initTheme, toggleTheme, getTheme } from '/js/theme.js';

const state = {
  specFields: {},        // category slug -> list of field definitions (from the server)
  trustedSeller: null,   // { min_rating, min_reviews }
  categories: [],
  stores: [],
  images: [],            // paths of the pictures in client/images/products
  products: [],
  offers: [],
  editingProductId: null,
  editingOfferId: null,
};

const $ = (id) => document.getElementById(id);

// ---------- Small DOM helpers (text is always set with textContent, never as HTML) ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

function categoryName(slug) {
  const category = state.categories.find((c) => c.slug === slug);
  if (!category) return slug;
  return getLanguage() === 'ar' ? category.name_ar : category.name_en;
}

function numberOrNull(input) {
  return input.value.trim() === '' ? null : Number(input.value);
}

// ---------- Form messages and field errors ----------

function clearErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((span) => { span.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
}

// errors: { fieldName: message } using the same names as the API (e.g. "brand", "specs.vram_gb")
function showErrors(form, errors) {
  for (const [name, message] of Object.entries(errors)) {
    const span = form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    if (span) span.textContent = message === 'is required' ? t('admin.required') : message;
    form.querySelectorAll(`[data-field="${CSS.escape(name)}"]`).forEach((input) => input.setAttribute('aria-invalid', 'true'));
  }
}

// When the admin edits a field, its old error goes away
function clearFieldErrorOnEdit(event) {
  const name = event.target.dataset?.field;
  if (!name) return;
  const form = event.currentTarget;
  const span = form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
  if (span) span.textContent = '';
  form.querySelectorAll(`[data-field="${CSS.escape(name)}"]`).forEach((input) => input.removeAttribute('aria-invalid'));
}

function showMessage(target, text, kind) {
  target.textContent = text;
  target.className = kind ? `admin-form-message is-${kind}` : 'admin-form-message';
}

// Adds an error line under every form field that has a data-field name and no error line yet
function addErrorSlots(form) {
  form.querySelectorAll('[name]').forEach((input) => {
    const name = input.name;
    input.dataset.field = name;
    if (!form.querySelector(`[data-error-for="${CSS.escape(name)}"]`)) {
      input.closest('.field')?.append(el('span', { class: 'field-error', 'data-error-for': name }));
    }
  });
}

// ---------- Tabs ----------

function selectTab(name) {
  for (const tab of ['products', 'offers']) {
    const selected = tab === name;
    $(`tab-${tab}`).setAttribute('aria-selected', String(selected));
    $(`panel-${tab}`).hidden = !selected;
  }
}

// ---------- Product form: specs fields built from the category definition ----------

function specInputId(key) {
  return `spec-${key}`;
}

// The options a field offers right now. GPU chipsets, for example, depend on the chosen chip_brand.
function currentOptions(field, values) {
  if (field.optionGroups) return field.optionGroups[values[field.optionsBy]] || [];
  return field.options;
}

function optionLabel(field, option) {
  return field.translateOptions ? t(`specOptions.${option}`) : String(option);
}

// values: all spec values in the form, so a field can read the field it depends on
function renderSpecField(field, value, values = {}) {
  const id = specInputId(field.key);
  const name = `specs.${field.key}`;
  const label = el('label', { for: id }, t(`specs.${field.key}`));
  if (field.required) label.append(' ', el('span', { class: 'admin-required', text: `(${t('admin.requiredMark')})` }));

  let control;

  if (field.type === 'boolean' && field.required) {
    control = el('label', { class: 'checkbox' },
      el('input', { type: 'checkbox', id, 'data-field': name, checked: value === true }),
      t('admin.yes'));
  } else if (field.type === 'boolean') {
    control = el('select', { class: 'select', id, 'data-field': name },
      el('option', { value: '', text: t('admin.notSet') }),
      el('option', { value: 'true', text: t('admin.yes'), selected: value === true }),
      el('option', { value: 'false', text: t('admin.no'), selected: value === false }));
  } else if (field.type === 'string[]') {
    const selected = Array.isArray(value) ? value : [];
    control = el('div', { class: 'admin-options', role: 'group', 'aria-label': t(`specs.${field.key}`) },
      ...field.options.map((option) => el('label', { class: 'checkbox' },
        el('input', { type: 'checkbox', name: id, value: option, 'data-field': name, checked: selected.includes(option) }),
        option)));
  } else if (field.optionGroups && currentOptions(field, values).length === 0) {
    // Nothing to pick until the field it depends on has a value
    control = el('select', { class: 'select', id, 'data-field': name, disabled: true },
      el('option', { value: '', text: t('admin.chooseFirst', { field: t(`specs.${field.optionsBy}`) }) }));
  } else if (field.options || field.optionGroups) {
    control = el('select', { class: 'select', id, 'data-field': name },
      el('option', { value: '', text: t('admin.notSet') }),
      ...currentOptions(field, values).map((option) => el('option', {
        value: String(option), text: optionLabel(field, option), selected: value === option,
      })));
  } else if (field.type === 'integer' || field.type === 'number') {
    control = el('input', {
      class: 'input', id, type: 'number', 'data-field': name,
      step: field.type === 'integer' ? '1' : 'any', min: field.min, max: field.max,
      value: value ?? '',
    });
  } else {
    control = el('input', { class: 'input', id, type: 'text', 'data-field': name, value: value ?? '' });
  }

  // A checkbox group has no single input to point the label at
  if (field.type === 'string[]') label.removeAttribute('for');

  return el('div', { class: 'field', id: `spec-wrap-${field.key}` },
    label, control, el('span', { class: 'field-error', 'data-error-for': name }));
}

function renderSpecFields(category, values = {}) {
  const container = $('spec-fields');
  container.replaceChildren();
  const fields = state.specFields[category];

  if (!fields) {
    container.append(el('p', { class: 'text-muted admin-grid-wide', text: t('admin.chooseCategoryFirst') }));
    return;
  }
  for (const field of fields) {
    container.append(renderSpecField(field, values[field.key], values));
  }

  // When a parent field changes (e.g. chip_brand), redraw the fields whose options depend on it
  for (const field of fields.filter((f) => f.optionsBy)) {
    $(specInputId(field.optionsBy)).addEventListener('change', () => {
      const current = readSpecValues(category);
      const keep = currentOptions(field, current).includes(current[field.key]) ? current[field.key] : null;
      $(`spec-wrap-${field.key}`).replaceWith(renderSpecField(field, keep, current));
    });
  }
}

// Reads the specs inputs back into an object with real types (numbers, booleans, lists)
function readSpecValues(category) {
  const specs = {};
  for (const field of state.specFields[category] || []) {
    const id = specInputId(field.key);

    if (field.type === 'string[]') {
      specs[field.key] = [...document.querySelectorAll(`input[name="${id}"]:checked`)].map((box) => box.value);
      continue;
    }

    const input = $(id);
    if (field.type === 'boolean' && field.required) {
      specs[field.key] = input.checked;
    } else if (field.type === 'boolean') {
      specs[field.key] = input.value === '' ? null : input.value === 'true';
    } else if (field.type === 'integer' || field.type === 'number') {
      specs[field.key] = numberOrNull(input);
    } else {
      specs[field.key] = input.value.trim() || null;
    }
  }
  return specs;
}

// Same required check as the server, so most mistakes show before saving
function findMissingRequired(category, specs) {
  const errors = {};
  for (const field of state.specFields[category] || []) {
    const value = specs[field.key];
    const empty = value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (field.required && empty) errors[`specs.${field.key}`] = 'is required';
  }
  return errors;
}

function renderCategoryOptions() {
  const select = $('product-category');
  const current = select.value;
  select.replaceChildren(
    el('option', { value: '', text: t('admin.chooseCategory') }),
    ...state.categories.map((c) => el('option', { value: c.slug, text: categoryName(c.slug), selected: c.slug === current })));
}

// ---------- Product picture: pick one from the folder, or type a link ----------

function renderImageOptions() {
  const current = $('product-image').value;
  $('product-image-pick').replaceChildren(
    el('option', { value: '', text: state.images.length ? t('admin.imagePick') : t('admin.imageNone') }),
    ...state.images.map((path) => el('option', {
      value: path, text: path.split('/').pop(), selected: path === current,
    })));
}

// A small preview of the picture in the field (nothing when the field is empty)
function renderImagePreview() {
  const url = $('product-image').value.trim();
  const preview = $('product-image-preview');
  if (!url) {
    preview.replaceChildren();
    return;
  }
  const image = el('img', { src: url, alt: t('admin.imagePreview') });
  image.addEventListener('error', () => preview.replaceChildren(el('span', { text: '?' })));
  preview.replaceChildren(image);
}

// The list is read when the page opens: a picture added to the folder later needs a page reload
async function loadImages() {
  try {
    state.images = await api.getProductImages();
  } catch {
    state.images = []; // typing the path still works
  }
  renderImageOptions();
}

function syncImageField() {
  renderImageOptions();
  renderImagePreview();
}

function renderProductFormTitle() {
  const product = state.products.find((p) => p.id === state.editingProductId);
  $('product-form-title').textContent = product
    ? t('admin.editProduct', { name: `${product.brand} ${product.name}` })
    : t('admin.newProduct');
  $('product-cancel').hidden = !product;
}

function resetProductForm() {
  state.editingProductId = null;
  const form = $('product-form');
  form.reset();
  clearErrors(form);
  syncImageField();
  renderSpecFields('');
  renderProductFormTitle();
}

function startEditingProduct(product) {
  state.editingProductId = product.id;
  const form = $('product-form');
  clearErrors(form);
  showMessage($('product-form-message'), '');
  $('product-category').value = product.category;
  $('product-brand').value = product.brand;
  $('product-name').value = product.name;
  $('product-model').value = product.model ?? '';
  $('product-image').value = product.image_url ?? '';
  syncImageField();
  renderSpecFields(product.category, product.specs);
  renderProductFormTitle();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveProduct(event) {
  event.preventDefault();
  const form = $('product-form');
  const message = $('product-form-message');
  clearErrors(form);

  const category = $('product-category').value;
  const product = {
    category,
    brand: $('product-brand').value,
    name: $('product-name').value,
    model: $('product-model').value,
    image_url: $('product-image').value,
    specs: readSpecValues(category),
  };

  const missing = { ...findMissingRequired(category, product.specs) };
  if (!category) missing.category = 'is required';
  if (!product.brand.trim()) missing.brand = 'is required';
  if (!product.name.trim()) missing.name = 'is required';
  if (Object.keys(missing).length > 0) {
    showErrors(form, missing);
    showMessage(message, t('admin.saveFailed'), 'error');
    return;
  }

  showMessage(message, t('admin.saving'));
  try {
    const saved = state.editingProductId
      ? await api.updateProduct(state.editingProductId, product)
      : await api.createProduct(product);
    await loadProducts();
    resetProductForm();
    showMessage(message, `${t('admin.productSaved')} (${saved.brand} ${saved.name})`, 'success');
  } catch (err) {
    showErrors(form, err.fields || {});
    showMessage(message, Object.keys(err.fields || {}).length ? t('admin.saveFailed') : err.message, 'error');
  }
}

// ---------- Products list ----------

function renderProductsList() {
  const container = $('products-list');
  if (state.products.length === 0) {
    container.replaceChildren(el('div', { class: 'card state' }, el('p', { text: t('admin.noProducts') })));
    return;
  }

  const rows = state.products.map((product) => el('tr', {},
    el('td', {}, product.name, product.is_hidden ? el('span', { class: 'badge badge-warning', text: ` ${t('admin.hidden')}` }) : null),
    el('td', { text: product.brand }),
    el('td', { text: categoryName(product.category) }),
    el('td', { class: 'admin-row-actions' },
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: t('admin.edit'), onclick: () => startEditingProduct(product) }))));

  container.replaceChildren(el('div', { class: 'table-wrap' },
    el('table', { class: 'table' },
      el('thead', {}, el('tr', {},
        el('th', { text: t('admin.name') }),
        el('th', { text: t('admin.brand') }),
        el('th', { text: t('admin.category') }),
        el('th', {}, el('span', { class: 'visually-hidden', text: t('admin.edit') })))),
      el('tbody', {}, ...rows))));
}

async function loadProducts() {
  state.products = await api.getAdminProducts();
  renderProductsList();
  renderOfferProductOptions();
}

// ---------- Offers ----------

function renderOfferProductOptions() {
  const select = $('offers-product');
  const current = select.value;
  select.replaceChildren(
    el('option', { value: '', text: t('admin.chooseProduct') }),
    ...state.products.map((p) => el('option', {
      value: String(p.id),
      text: `${p.brand} ${p.name} (${categoryName(p.category)})`,
      selected: String(p.id) === current,
    })));
}

function renderStoreOptions() {
  const select = $('offer-store');
  const current = select.value;
  select.replaceChildren(
    el('option', { value: '', text: t('admin.chooseStore') }),
    ...state.stores.map((s) => el('option', { value: String(s.id), text: s.name, selected: String(s.id) === current })));
}

function renderOffersList() {
  const container = $('offers-list');
  if (state.offers.length === 0) {
    container.replaceChildren(el('div', { class: 'card state' }, el('p', { text: t('admin.noOffers') })));
    return;
  }

  const rows = state.offers.map((offer) => el('tr', {},
    el('td', { text: offer.store_name }),
    el('td', {}, offer.seller_name, offer.is_official ? el('span', { class: 'badge', text: ` ${t('offers.official')}` }) : null),
    el('td', { class: 'price', text: `${Number(offer.price).toFixed(2)} ${offer.currency}` }),
    el('td', { class: 'price', text: Number(offer.shipping_cost).toFixed(2) }),
    el('td', { text: offer.delivery_days_min !== null && offer.delivery_days_max !== null
      ? t('admin.days', { min: offer.delivery_days_min, max: offer.delivery_days_max }) : '-' }),
    el('td', {}, el('span', {
      class: `badge ${offer.in_stock ? 'badge-success' : 'badge-danger'}`,
      text: offer.in_stock ? t('admin.inStock') : t('admin.outOfStock'),
    })),
    el('td', { class: 'admin-row-actions' },
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: t('admin.edit'), onclick: () => startEditingOffer(offer) }))));

  container.replaceChildren(el('div', { class: 'table-wrap' },
    el('table', { class: 'table' },
      el('thead', {}, el('tr', {},
        el('th', { text: t('admin.store') }),
        el('th', { text: t('admin.seller') }),
        el('th', { text: t('admin.price') }),
        el('th', { text: t('admin.shipping') }),
        el('th', { text: t('admin.delivery') }),
        el('th', { text: t('admin.inStock') }),
        el('th', {}, el('span', { class: 'visually-hidden', text: t('admin.edit') })))),
      el('tbody', {}, ...rows))));
}

async function loadOffers(productId) {
  state.offers = await api.getAdminProductOffers(productId);
  renderOffersList();
}

// Shows the warning (and the "I checked" box) when the seller is not official and below the trust rule
function updateSellerWarning() {
  const { min_rating: minRating, min_reviews: minReviews } = state.trustedSeller;
  const official = $('offer-official').checked;
  const rating = numberOrNull($('offer-rating'));
  const reviews = numberOrNull($('offer-reviews'));
  const trusted = official || (rating !== null && rating >= minRating && reviews !== null && reviews >= minReviews);

  $('seller-warning').hidden = trusted;
  $('seller-warning-text').textContent = t('admin.sellerWarning', { rating: minRating, reviews: minReviews });
  if (trusted) $('offer-seller-checked').checked = false;
}

function renderOfferFormTitle() {
  const offer = state.offers.find((o) => o.id === state.editingOfferId);
  $('offer-form-title').textContent = offer
    ? t('admin.editOffer', { seller: offer.seller_name, store: offer.store_name })
    : t('admin.newOffer');
  $('offer-cancel').hidden = !offer;
}

function resetOfferForm() {
  state.editingOfferId = null;
  const form = $('offer-form');
  form.reset();
  clearErrors(form);
  updateSellerWarning();
  renderOfferFormTitle();
}

function startEditingOffer(offer) {
  state.editingOfferId = offer.id;
  const form = $('offer-form');
  clearErrors(form);
  showMessage($('offer-form-message'), '');
  $('offer-store').value = String(offer.store_id);
  $('offer-seller').value = offer.seller_name;
  $('offer-official').checked = offer.is_official;
  $('offer-rating').value = offer.seller_rating ?? '';
  $('offer-reviews').value = offer.seller_reviews ?? '';
  $('offer-price').value = offer.price;
  $('offer-shipping').value = offer.shipping_cost;
  $('offer-currency').value = offer.currency;
  $('offer-days-min').value = offer.delivery_days_min ?? '';
  $('offer-days-max').value = offer.delivery_days_max ?? '';
  $('offer-url').value = offer.url;
  $('offer-in-stock').checked = offer.in_stock;
  updateSellerWarning();
  // An existing offer below the rule was already checked once
  if (!$('seller-warning').hidden) $('offer-seller-checked').checked = true;
  renderOfferFormTitle();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveOffer(event) {
  event.preventDefault();
  const form = $('offer-form');
  const message = $('offer-form-message');
  clearErrors(form);

  const offer = {
    product_id: Number($('offers-product').value),
    store_id: Number($('offer-store').value) || null,
    seller_name: $('offer-seller').value,
    is_official: $('offer-official').checked,
    seller_rating: numberOrNull($('offer-rating')),
    seller_reviews: numberOrNull($('offer-reviews')),
    price: numberOrNull($('offer-price')),
    shipping_cost: numberOrNull($('offer-shipping')) ?? 0,
    currency: $('offer-currency').value,
    delivery_days_min: numberOrNull($('offer-days-min')),
    delivery_days_max: numberOrNull($('offer-days-max')),
    url: $('offer-url').value,
    in_stock: $('offer-in-stock').checked,
    seller_checked: $('offer-seller-checked').checked,
  };

  const missing = {};
  if (!offer.store_id) missing.store_id = 'is required';
  if (!offer.seller_name.trim()) missing.seller_name = 'is required';
  if (offer.price === null) missing.price = 'is required';
  if (!offer.url.trim()) missing.url = 'is required';
  if (Object.keys(missing).length > 0) {
    showErrors(form, missing);
    showMessage(message, t('admin.saveFailed'), 'error');
    return;
  }

  showMessage(message, t('admin.saving'));
  try {
    if (state.editingOfferId) await api.updateOffer(state.editingOfferId, offer);
    else await api.createOffer(offer);
    await loadOffers(offer.product_id);
    resetOfferForm();
    showMessage(message, t('admin.offerSaved'), 'success');
  } catch (err) {
    showErrors(form, err.fields || {});
    showMessage(message, Object.keys(err.fields || {}).length ? t('admin.saveFailed') : err.message, 'error');
  }
}

async function onOfferProductChange() {
  const productId = Number($('offers-product').value);
  $('offers-area').hidden = !productId;
  $('offers-empty-hint').hidden = Boolean(productId);
  resetOfferForm();
  showMessage($('offer-form-message'), '');
  if (productId) await loadOffers(productId);
}

// ---------- Language and theme ----------

function renderThemeButton() {
  $('theme-toggle').textContent = getTheme() === 'dark' ? t('theme.toLight') : t('theme.toDark');
}

// Text built in code is redrawn after a language change; spec values the admin typed are kept
function rerenderForLanguage() {
  const category = $('product-category').value;
  const specValues = category ? readSpecValues(category) : {};
  renderCategoryOptions();
  renderSpecFields(category, specValues);
  renderProductFormTitle();
  renderProductsList();
  renderOfferProductOptions();
  renderStoreOptions();
  renderOffersList();
  renderOfferFormTitle();
  updateSellerWarning();
  renderImageOptions();
  renderThemeButton();
}

// ---------- Start ----------

async function start() {
  initTheme();
  await initLanguage();
  renderThemeButton();

  $('language-toggle').addEventListener('click', toggleLanguage);
  $('theme-toggle').addEventListener('click', toggleTheme);
  document.addEventListener('languagechange', rerenderForLanguage);
  document.addEventListener('themechange', renderThemeButton);
  $('tab-products').addEventListener('click', () => selectTab('products'));
  $('tab-offers').addEventListener('click', () => selectTab('offers'));

  try {
    const [specData, categories, stores] = await Promise.all([api.getSpecFields(), api.getCategories(), api.getStores()]);
    state.specFields = specData.categories;
    state.trustedSeller = specData.trusted_seller;
    state.categories = categories;
    state.stores = stores;
    await loadProducts();
  } catch {
    $('load-error').hidden = false;
    return;
  }

  renderCategoryOptions();
  renderStoreOptions();
  resetProductForm();
  resetOfferForm();
  addErrorSlots($('product-form'));
  addErrorSlots($('offer-form'));
  for (const form of [$('product-form'), $('offer-form')]) {
    form.addEventListener('input', clearFieldErrorOnEdit);
    form.addEventListener('change', clearFieldErrorOnEdit);
  }

  $('product-category').addEventListener('change', (e) => {
    clearErrors($('product-form'));
    renderSpecFields(e.target.value);
  });
  $('product-image-pick').addEventListener('change', (e) => {
    if (!e.target.value) return;
    $('product-image').value = e.target.value;
    renderImagePreview();
  });
  $('product-image').addEventListener('input', syncImageField);
  loadImages();
  $('product-form').addEventListener('submit', saveProduct);
  $('product-cancel').addEventListener('click', () => {
    resetProductForm();
    showMessage($('product-form-message'), '');
  });

  $('offers-product').addEventListener('change', onOfferProductChange);
  for (const id of ['offer-official', 'offer-rating', 'offer-reviews']) {
    $(id).addEventListener('input', updateSellerWarning);
  }
  $('offer-form').addEventListener('submit', saveOffer);
  $('offer-cancel').addEventListener('click', () => {
    resetOfferForm();
    showMessage($('offer-form-message'), '');
  });
}

// If the page cannot start (e.g. the translations fail to load), show the load error
start().catch(() => {
  $('load-error').hidden = false;
});
