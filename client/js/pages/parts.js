import * as api from '/js/api.js';
import { initLanguage, getLanguage, t } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import { createPartCard } from '/js/components/partCard.js';
import { renderFilterPanel, renderChips } from '/js/components/filterPanel.js';
import { el } from '/js/components/dom.js';
import {
  definitionsFor, emptyFilters, readFilters, writeFilters, matches, hasActive, listActive,
} from '/js/filtering.js';

const $ = (id) => document.getElementById(id);

// The category, the search text and the filters come from the address,
// e.g. parts.html?category=gpu&q=4060&brand=ASUS&vram_gb=8
const params = new URLSearchParams(location.search);
const initialCategory = params.get('category') || '';

const state = {
  category: initialCategory,
  q: (params.get('q') || '').trim(),
  sort: 'price',
  filters: readFilters(params, definitionsFor(initialCategory)),
  categories: [],
  stores: [],
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

// Cheapest first (parts with no available offer last), or by name
function sortedProducts(products) {
  const byName = (a, b) => a.name.localeCompare(b.name, getLanguage());
  if (state.sort === 'name') return products.sort(byName);

  const price = (product) => product.cheapest?.total_sar ?? Infinity;
  return products.sort((a, b) => (price(a) === price(b) ? byName(a, b) : price(a) - price(b)));
}

function visibleProducts() {
  const definitions = definitionsFor(state.category);
  return sortedProducts(state.products.filter((product) => matches(product, state.filters, definitions)));
}

function renderHeading() {
  const title = pageTitle();
  $('parts-title').textContent = title;
  $('parts-count').textContent = state.status === 'ready' ? t('parts.count', { count: visibleProducts().length }) : '';
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

// The filter panel is only redrawn when the list of parts, the category or the language changes,
// not on every click, so the checkbox the user is using keeps its focus
function renderPanel() {
  renderPanelSummary();

  if (state.status !== 'ready') {
    $('filters-body').replaceChildren();
    return;
  }
  renderFilterPanel($('filters-body'), {
    definitions: definitionsFor(state.category),
    products: state.products,
    stores: state.stores,
    filters: state.filters,
    onChange: onFiltersChanged,
  });
}

function renderChipList() {
  renderChips($('chips'), {
    definitions: definitionsFor(state.category),
    stores: state.stores,
    filters: state.filters,
    onRemove: onFiltersReset,
    onClear: () => {
      state.filters = emptyFilters();
      onFiltersReset();
    },
  });
}

function renderList() {
  const box = $('parts-state');
  const grid = $('parts-grid');
  grid.replaceChildren();
  box.hidden = false;

  if (state.status === 'loading') {
    box.className = 'state';
    box.replaceChildren(el('span', { class: 'spinner', 'aria-hidden': 'true' }), t('states.loading'));
    return;
  }

  if (state.status === 'error') {
    box.className = 'state alert alert-danger';
    const retry = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: t('actions.retry') });
    retry.addEventListener('click', loadProducts);
    box.replaceChildren(t('states.error'), retry);
    return;
  }

  const products = visibleProducts();
  if (products.length > 0) {
    box.hidden = true;
    grid.replaceChildren(...products.map((product) => createPartCard(product)));
    return;
  }

  box.className = 'state';
  if (hasActive(state.filters)) {
    const clear = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: t('filters.clearAll') });
    clear.addEventListener('click', () => {
      state.filters = emptyFilters();
      onFiltersReset();
    });
    box.replaceChildren(t('filters.noMatch'), clear);
  } else {
    box.replaceChildren(t('parts.noMatch'), el('a', { href: '/pages/parts.html', text: t('parts.showAll') }));
  }
}

function renderResults() {
  renderHeading();
  renderChipList();
  renderList();
  renderPanelSummary();
}

function renderPanelSummary() {
  const count = listActive(state.filters).length;
  $('filters-summary').textContent = count > 0 ? `${t('filters.title')} (${count})` : t('filters.title');
}

function renderAll() {
  renderCategorySelect();
  renderPanel();
  renderResults();
}

// ---------- Changes ----------

// Keeps the address in sync, so the page can be shared or reloaded as it is
function updateAddress() {
  const next = new URLSearchParams();
  if (state.category) next.set('category', state.category);
  if (state.q) next.set('q', state.q);
  writeFilters(state.filters, next);
  const query = next.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

// A checkbox, a field or a select in the panel changed
function onFiltersChanged() {
  updateAddress();
  renderResults();
}

// A chip was removed, or "clear all": the panel must show the new choices too
function onFiltersReset() {
  updateAddress();
  renderPanel();
  renderResults();
}

// ---------- Data ----------

let latestRequest = 0;

async function loadProducts() {
  const request = ++latestRequest;
  state.status = 'loading';
  renderPanel();
  renderResults();

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
  renderPanel();
  renderResults();
}

// The category names and the store names are only labels: the list still works without them
async function loadLabels() {
  const [categories, stores] = await Promise.allSettled([api.getCategories(), api.getStores()]);
  if (categories.status === 'fulfilled') state.categories = categories.value;
  if (stores.status === 'fulfilled') state.stores = stores.value;
  renderAll();
}

// ---------- Start ----------

initTheme();
await initLanguage();
initNavbar();
renderAll();

// The panel is open on wide screens and closed on phones
$('filters').open = matchMedia('(min-width: 900px)').matches;

$('category-select').addEventListener('change', (event) => {
  state.category = event.target.value;
  state.filters = emptyFilters(); // the filters of the old category do not apply
  updateAddress();
  loadProducts();
});
$('sort-select').addEventListener('change', (event) => {
  state.sort = event.target.value;
  renderList();
});
document.addEventListener('languagechange', renderAll);

loadLabels();
loadProducts();
