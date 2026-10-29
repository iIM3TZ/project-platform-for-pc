import * as api from '/js/api.js';
import { initLanguage, getLanguage, t, formatPrice } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import { el } from '/js/components/dom.js';
import { loadLocalBuilds, loadOpenBuildId, fromServer, itemsForApi } from '/js/buildStore.js';

const $ = (id) => document.getElementById(id);

// The core parts, in the order of the sample build card
const CORE_ORDER = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler'];

const state = {
  categories: [],
  products: [],
  categoriesStatus: 'loading', // 'loading' | 'ready' | 'error'
  myBuild: null, // the visitor's open build from the Build page, when it has parts
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
      distance: 1.3,
      gridDivisions: 90,
    });
    enterOnClick($('hero-stage'));
  } catch (err) {
    console.warn('3D case not available on the home page:', err.message);
    $('hero-stage').hidden = true;
  }
}

// A click on the case (not the end of a drag that turned it) opens the Build page
function enterOnClick(stage) {
  let start = null;
  stage.addEventListener('pointerdown', (event) => { start = { x: event.clientX, y: event.clientY }; });
  stage.addEventListener('pointerup', (event) => {
    if (!start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    start = null;
    if (moved < 6) location.href = '/pages/build.html';
  });
}

// The cheapest part (with an offer in stock) of each core category
function sampleBuild() {
  return CORE_ORDER.map((slug) => state.products
    .filter((product) => product.category === slug && product.cheapest)
    .sort((a, b) => a.cheapest.total_sar - b.cheapest.total_sar)[0])
    .filter(Boolean);
}

// The card shows the visitor's own build when it has parts, or else the sample build.
// Each line: { name, image_url, price }.
function cardLines() {
  if (state.myBuild) {
    return state.myBuild.items.map(({ product, offer }) => ({ name: product.name, image_url: product.image_url, price: offer.total_sar }));
  }
  return sampleBuild().map((product) => ({ name: product.name, image_url: product.image_url, price: product.cheapest.total_sar }));
}

function renderSampleBuild() {
  const lines = cardLines();
  $('hero-card').hidden = lines.length === 0;
  if (lines.length === 0) return;

  $('hero-card-title').textContent = state.myBuild
    ? t('home.yourBuild', { name: state.myBuild.name })
    : t('home.sampleBuild');
  $('hero-count').textContent = t('home.partsCount', { count: lines.length });
  $('hero-card-list').replaceChildren(...lines.map((line) => el('span', { class: 'hero-card-item' },
    line.image_url
      ? el('img', { src: line.image_url, alt: '', loading: 'lazy' })
      : el('span', { class: 'hero-card-thumb', 'aria-hidden': 'true' }),
    el('span', { class: 'hero-card-name', text: line.name }),
    el('span', { class: 'price', text: formatPrice(line.price) }))));
  $('hero-total').textContent = formatPrice(lines.reduce((sum, line) => sum + line.price, 0));
}

// The open build of the Build page: from the account for a signed-in visitor, from this browser
// for a guest (with today's prices, as the guest's copy can be old). null when it has no parts.
async function loadMyBuild() {
  try {
    const user = await api.getMe();
    let build;
    if (user) {
      const builds = (await api.getBuilds()).map(fromServer);
      build = builds.find((item) => item.id === String(loadOpenBuildId(user.id))) ?? builds[0];
    } else {
      const local = loadLocalBuilds();
      build = local.builds.find((item) => item.id === local.currentId) ?? local.builds[0];
      if (build?.items.length) build.items = (await api.refreshBuildItems(itemsForApi(build))).items;
    }
    state.myBuild = build?.items.length ? build : null;
  } catch {
    state.myBuild = null; // the sample build shows instead
  }
  renderSampleBuild();
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
loadMyBuild();

// When the Build page changes the build in another tab, the card follows: at once for a guest
// (the browser tells about localStorage changes), and when coming back to this tab otherwise
window.addEventListener('storage', (event) => {
  if (event.key?.startsWith('builds:')) loadMyBuild();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadMyBuild();
});

// The category names, prices and the page title follow the language
document.addEventListener('languagechange', renderAll);
