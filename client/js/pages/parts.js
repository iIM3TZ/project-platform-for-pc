import * as api from '/js/api.js';
import { initLanguage, getLanguage, t } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import { createPartCard } from '/js/components/partCard.js';
import { el } from '/js/components/dom.js';

const $ = (id) => document.getElementById(id);

// The category and the search text come from the address, e.g. parts.html?category=gpu&q=4060
const params = new URLSearchParams(location.search);

const state = {
  category: params.get('category') || '',
  q: (params.get('q') || '').trim(),
  sort: 'price',
  categories: [],
  products: [],
  status: 'loading', // 'loading' | 'ready' | 'error'
};

// ---------- Rendering ----------

function categoryName(slug) {
  const category = state.categories.find((c) => c.slug === slug);
  if (!category) return slug;
  return getLanguage() === 'ar' ? category.name_ar : category.name_en;
}

function pageTitle() {
  if (state.q) return t('parts.resultsFor', { q: state.q });
  if (state.category) return categoryName(state.category);
  return t('parts.allParts');
}

function renderHeading() {
  const title = pageTitle();
  $('parts-title').textContent = title;
  $('parts-count').textContent = state.status === 'ready' ? t('parts.count', { count: state.products.length }) : '';
  document.title = `${title} | ${t('site.name')}`;
}

function renderCategorySelect() {
  const options = [
    el('option', { value: '', text: t('parts.allCategories') }),
    ...state.categories.map((c) => el('option', { value: c.slug, text: categoryName(c.slug) })),
  ];
  $('category-select').replaceChildren(...options);
  $('category-select').value = state.category;
}

// Cheapest first (parts with no available offer last), or by name
function sortedProducts() {
  const products = [...state.products];
  const byName = (a, b) => a.name.localeCompare(b.name, getLanguage());

  if (state.sort === 'name') return products.sort(byName);

  const price = (product) => product.cheapest?.total_sar ?? Infinity;
  return products.sort((a, b) => (price(a) === price(b) ? byName(a, b) : price(a) - price(b)));
}

function renderList() {
  const box = $('parts-state');
  const grid = $('parts-grid');
  grid.replaceChildren();
  box.hidden = false;

  if (state.status === 'loading') {
    box.className = 'state';
    box.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }), t('states.loading'));
  } else if (state.status === 'error') {
    box.className = 'state alert alert-danger';
    box.replaceChildren(
      t('states.error'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'retry', text: t('actions.retry') }));
    $('retry').addEventListener('click', loadProducts);
  } else if (state.products.length === 0) {
    box.className = 'state';
    box.replaceChildren(t('parts.noMatch'), el('a', { href: '/pages/parts.html', text: t('parts.showAll') }));
  } else {
    box.hidden = true;
    grid.replaceChildren(...sortedProducts().map((product) => createPartCard(product)));
  }
}

function renderAll() {
  renderHeading();
  renderCategorySelect();
  renderList();
}

// ---------- Data ----------

// Keeps the address in sync with the chosen category, so the page can be shared or reloaded
function updateAddress() {
  const next = new URLSearchParams();
  if (state.category) next.set('category', state.category);
  if (state.q) next.set('q', state.q);
  const query = next.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

let latestRequest = 0;

async function loadProducts() {
  const request = ++latestRequest;
  state.status = 'loading';
  renderHeading();
  renderList();

  let products = [];
  let status = 'ready';
  try {
    products = await api.getProducts({ category: state.category, q: state.q });
  } catch {
    status = 'error';
  }

  // The user may have changed the category while this was loading: only the last request counts
  if (request !== latestRequest) return;
  state.products = products;
  state.status = status;
  renderHeading();
  renderList();
}

async function loadCategories() {
  try {
    state.categories = await api.getCategories();
  } catch {
    // The list still works without the category names; the select just shows "All"
  }
  renderCategorySelect();
  renderHeading();
}

// ---------- Start ----------

initTheme();
await initLanguage();
initNavbar();
renderAll();

$('category-select').addEventListener('change', (event) => {
  state.category = event.target.value;
  updateAddress();
  loadProducts();
});
$('sort-select').addEventListener('change', (event) => {
  state.sort = event.target.value;
  renderList();
});
document.addEventListener('languagechange', renderAll);

loadCategories();
loadProducts();
