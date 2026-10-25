import * as api from '/js/api.js';
import { initLanguage, getLanguage, t, formatPrice } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import { el } from '/js/components/dom.js';

const $ = (id) => document.getElementById(id);

// The core parts, in the order of the sample build card
const CORE_ORDER = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler'];

const state = {
  categories: [],
  products: [],
  categoriesStatus: 'loading', // 'loading' | 'ready' | 'error'
};

// ---------- Hero: the 3D case and the sample build ----------

// The same 3D case as the Build page, with every part in place, no circles and no zoom
// (so the mouse wheel still scrolls the page). Without WebGL the hero shows the card alone.
async function setupHeroCase() {
  try {
    const { createPcScene } = await import('/js/components/pcCase3d.js');
    createPcScene($('hero-stage'), {
      slugs: [],
      categoryName: () => '',
      partInfo: () => null,
      status: () => 'chosen',
      onPick: () => {},
      zoom: false,
    });
  } catch (err) {
    console.warn('3D case not available on the home page:', err.message);
    $('hero-stage').hidden = true;
  }
}

// The cheapest part (with an offer in stock) of each core category
function sampleBuild() {
  return CORE_ORDER.map((slug) => state.products
    .filter((product) => product.category === slug && product.cheapest)
    .sort((a, b) => a.cheapest.total_sar - b.cheapest.total_sar)[0])
    .filter(Boolean);
}

function renderSampleBuild() {
  const parts = sampleBuild();
  $('hero-card').hidden = parts.length === 0;
  if (parts.length === 0) return;

  $('hero-count').textContent = t('home.partsCount', { count: parts.length });
  $('hero-card-list').replaceChildren(...parts.map((product) => el('span', { class: 'hero-card-item' },
    product.image_url
      ? el('img', { src: product.image_url, alt: '', loading: 'lazy' })
      : el('span', { class: 'hero-card-thumb', 'aria-hidden': 'true' }),
    el('span', { class: 'hero-card-name', text: product.name }),
    el('span', { class: 'price', text: formatPrice(product.cheapest.total_sar) }))));
  const total = parts.reduce((sum, product) => sum + product.cheapest.total_sar, 0);
  $('hero-total').textContent = formatPrice(total);
}

// ---------- Category cards ----------

function showCategoryState(text, isError = false) {
  const box = $('category-state');
  box.hidden = false;
  box.className = isError ? 'state alert alert-danger' : 'state';
  box.textContent = text;
  $('category-grid').replaceChildren();
}

// One card per category; each opens the parts page filtered by it
function renderCategories() {
  if (state.categoriesStatus === 'loading') return showCategoryState(t('states.loading'));
  if (state.categoriesStatus === 'error') return showCategoryState(t('states.error'), true);
  if (state.categories.length === 0) return showCategoryState(t('states.empty'));

  $('category-state').hidden = true;
  const lang = getLanguage();
  $('category-grid').replaceChildren(...state.categories.map((category) => el('a', {
    class: 'card category-card',
    href: `/pages/parts.html?category=${encodeURIComponent(category.slug)}`,
  },
    // The picture is decorative: the name under it says the same thing
    el('img', { src: `/images/categories/${category.slug}.svg`, alt: '', loading: 'lazy' }),
    el('span', { text: lang === 'ar' ? category.name_ar : category.name_en }))));
}

function renderAll() {
  document.title = t('site.name');
  renderCategories();
  renderSampleBuild();
}

// ---------- Start ----------

async function loadData() {
  const [categories, products] = await Promise.allSettled([api.getCategories(), api.getProducts()]);
  state.categoriesStatus = categories.status === 'fulfilled' ? 'ready' : 'error';
  if (categories.status === 'fulfilled') state.categories = categories.value;
  if (products.status === 'fulfilled') state.products = products.value;
  renderAll();
}

initTheme();
await initLanguage();
initNavbar();
renderAll();
setupHeroCase();
loadData();

// The category names, prices and the page title follow the language
document.addEventListener('languagechange', renderAll);
