import * as api from '/js/api.js';
import { initLanguage, getLanguage, t, formatPrice } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import { el } from '/js/components/dom.js';
import { renderPcCase } from '/js/components/pcCase.js';
import { createPartPicker } from '/js/components/partPicker.js';
import { loadBuild, saveBuild, itemsOf, choosePart, removeItem, MULTI_CATEGORIES } from '/js/buildStore.js';
import { PART_MODELS } from '/js/pcModels.js';

const $ = (id) => document.getElementById(id);

// The core parts, in the order of the list (docs/pages.md)
const CORE_ORDER = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler'];

const state = {
  build: loadBuild(),
  categories: [],
  pending: null, // { category, replaceIndex } while the picker is open
  scene: null,   // the 3D case, or null when the flat drawing is used
  modelSlugs: [], // the parts shown with a real 3D model (their authors are credited)
  check: null,     // the server's compatibility check: { status, estimate_w, results, parts }
  checking: false,
};

function categoryName(slug) {
  const category = state.categories.find((c) => c.slug === slug);
  if (!category) return slug;
  return getLanguage() === 'ar' ? category.name_ar : category.name_en;
}

// The chosen part of a category, for the circles: { name, image }, or null when nothing is chosen.
// Two drives (storage) are joined with " + ".
function partInfo(slug) {
  const items = itemsOf(state.build, slug);
  if (items.length === 0) return null;
  return {
    name: items.map(({ item }) => item.product.name).join(' + '),
    image: items[0].item.product.image_url,
  };
}

// Grey when nothing is chosen, green when it fits, yellow with a warning, red with an error
function status(slug) {
  const items = itemsOf(state.build, slug);
  if (items.length === 0) return 'empty';
  const levels = items.map(({ item }) => state.check?.parts?.[item.product.id]);
  if (levels.includes('error')) return 'error';
  if (levels.includes('warning')) return 'warning';
  return 'chosen';
}

// The picker gets the rest of the build (without the part being changed) to tell which parts fit
function openPicker(category, replaceIndex = null) {
  state.pending = { category, replaceIndex };
  const others = state.build.items
    .filter((item, index) => index !== replaceIndex && (MULTI_CATEGORIES.includes(category) || item.category !== category))
    .map((item) => item.product.id);
  picker.open(category, categoryName(category), others);
}

// ---------- Compatibility: the strip at the top and its details ----------

const STATUS_ICONS = { compatible: '✓', warnings: '!', incompatible: '✕' };

function overallStatus() {
  if (state.build.items.length === 0) return 'empty';
  if (state.checking && !state.check) return 'checking';
  return state.check?.status ?? 'error';
}

function renderSummary() {
  const overall = overallStatus();
  const button = $('compat-status');
  button.className = `build-pill is-${overall}`;
  button.disabled = overall === 'empty' || overall === 'checking';
  button.replaceChildren(
    STATUS_ICONS[overall] ? el('span', { class: 'build-pill-icon', 'aria-hidden': 'true', text: STATUS_ICONS[overall] }) : null,
    el('span', { text: t(`compat.${overall}`) }),
    reasonText(overall));

  const watts = state.check?.estimate_w;
  $('build-watts').hidden = !watts;
  if (watts) $('build-watts').textContent = `⚡ ${t('compat.watts', { watts })}`;
}

// The reason next to the status: the first error (or the first warning), and how many more there are
function reasonText(overall) {
  if (overall !== 'incompatible' && overall !== 'warnings') return null;
  const results = state.check.results;
  const first = results.find((item) => item.level === 'error') ?? results[0];
  const message = getLanguage() === 'ar' ? first.message_ar : first.message_en;
  const more = results.length > 1 ? ` ${t('compat.more', { count: results.length - 1 })}` : '';
  return el('span', { class: 'build-pill-reason', text: `${message}${more}` });
}

const PART_LABELS = { ok: 'compat.partOk', warning: 'compat.partWarning', error: 'compat.partError' };

function renderCompatDetails() {
  const overall = overallStatus();
  const results = state.check?.results ?? [];
  const message = (item) => (getLanguage() === 'ar' ? item.message_ar : item.message_en);
  $('compat-body').replaceChildren(
    el('p', { class: `build-pill compat-big is-${overall}` },
      STATUS_ICONS[overall] ? el('span', { class: 'build-pill-icon', 'aria-hidden': 'true', text: STATUS_ICONS[overall] }) : null,
      t(`compat.${overall}`)),
    el('p', { class: 'compat-note', text: t('compat.note') }),
    results.length > 0 && el('h3', { class: 'compat-heading', text: t('compat.problems') }),
    results.length > 0 && el('ul', { class: 'compat-results' },
      ...results.map((item) => el('li', { class: `is-${item.level}`, text: message(item) }))),
    el('h3', { class: 'compat-heading', text: t('compat.details') }),
    el('ul', { class: 'compat-parts' },
      ...state.build.items.map(({ product }) => {
        const partStatus = state.check?.parts?.[product.id] ?? 'ok';
        return el('li', {},
          el('span', { text: `${product.brand} ${product.name}` }),
          el('span', { class: `compat-part-status is-${partStatus}`, text: t(PART_LABELS[partStatus]) }));
      })));
}

// Only the answer to the latest request is used (the build may change while one is on its way)
let latestCheck = 0;

async function runCheck() {
  const request = ++latestCheck;
  const ids = state.build.items.map((item) => item.product.id);
  if (ids.length === 0) {
    state.check = null;
    render();
    return;
  }
  state.checking = true;
  renderSummary();
  let check = null;
  try {
    check = await api.checkBuild(ids);
  } catch {
    // the strip says the check failed; the build itself still works
  }
  if (request !== latestCheck) return;
  state.check = check;
  state.checking = false;
  render();
}

function slugsToShow() {
  const core = state.categories.filter((c) => c.kind === 'core').map((c) => c.slug);
  return CORE_ORDER.filter((slug) => core.length === 0 || core.includes(slug));
}

// ---------- The case: 3D when the browser can, the flat drawing otherwise ----------

async function setupStage() {
  const options = {
    slugs: slugsToShow(),
    categoryName,
    partInfo,
    status,
    onPick: (slug) => openPicker(slug),
    onModels: (loaded) => {
      state.modelSlugs = loaded;
      renderCredits();
    },
  };
  try {
    // Loaded only here, so a browser without WebGL never downloads three.js for nothing
    const { createPcScene } = await import('/js/components/pcCase3d.js');
    state.scene = createPcScene($('pc-stage'), options);
  } catch (err) {
    console.warn('3D case not available, using the flat drawing:', err.message);
    $('pc-stage').classList.add('is-flat');
    state.scene = null;
  }
}

function renderStage() {
  if (state.scene) {
    state.scene.update();
    return;
  }
  const flat = $('pc-stage');
  flat.querySelector('.pc-hint')?.remove();
  renderPcCase(flat, {
    slugs: slugsToShow(),
    categoryName,
    partName: (slug) => partInfo(slug)?.name ?? null,
    status,
    onPick: (slug) => openPicker(slug),
  });
}

// The authors of the 3D models in use (free models under CC BY must name them)
function renderCredits() {
  const credits = state.modelSlugs.map((slug) => PART_MODELS[slug].credit).filter(Boolean);
  $('model-credits').hidden = credits.length === 0;
  $('model-credits-list').replaceChildren(...credits.map((credit) => el('li', {},
    el('a', { href: credit.url, target: '_blank', rel: 'noopener noreferrer', text: credit.title }),
    ` ${t('build.creditBy', { author: credit.author, license: credit.license })}`)));
}

// ---------- The parts list beside the case ----------

function iconButton(symbol, label, onClick) {
  const node = el('button', { class: 'build-icon-btn', type: 'button', 'aria-label': label, title: label, text: symbol });
  node.addEventListener('click', onClick);
  return node;
}

function chosenLine({ item, index }) {
  const { product, offer } = item;
  return el('div', { class: 'build-item' },
    product.image_url
      ? el('img', { class: 'build-thumb', src: product.image_url, alt: '', loading: 'lazy' })
      : el('span', { class: 'build-thumb', 'aria-hidden': 'true' }),
    el('div', { class: 'build-item-text' },
      el('a', { class: 'build-item-name', href: `/pages/part.html?id=${product.id}`, text: `${product.brand} ${product.name}` }),
      el('span', { class: 'build-item-price' },
        el('span', { class: 'price', text: formatPrice(offer.total_sar) }),
        el('span', { class: 'text-muted', text: offer.store_name }))),
    el('div', { class: 'build-item-actions' },
      iconButton('⇄', t('build.change'), () => openPicker(item.category, index)),
      iconButton('×', t('build.remove'), () => {
        removeItem(state.build, index);
        update();
      })));
}

function addButton(text, onClick) {
  const node = el('button', { class: 'build-add', type: 'button', text: `+ ${text}` });
  node.addEventListener('click', onClick);
  return node;
}

function categoryRow(slug) {
  const items = itemsOf(state.build, slug);
  const chosen = items.length > 0;
  const row = el('li', { class: `build-row${chosen ? ' is-chosen' : ''}` },
    el('div', { class: 'build-row-head' },
      el('span', { class: `build-status is-${status(slug)}`, 'aria-hidden': 'true' }),
      el('h3', { text: categoryName(slug) }),
      !chosen && addButton(t('build.choose'), () => openPicker(slug)),
      chosen && MULTI_CATEGORIES.includes(slug) && addButton(t('build.addDrive'), () => openPicker(slug))),
    ...items.map((entry) => chosenLine(entry)));

  // Pointing at a row lights up its part in the 3D case
  row.addEventListener('mouseenter', () => state.scene?.highlight(slug));
  row.addEventListener('mouseleave', () => state.scene?.highlight(null));
  return row;
}

function render() {
  const slugs = slugsToShow();
  const chosenCount = slugs.filter((slug) => status(slug) !== 'empty').length;
  $('build-count').textContent = t('build.count', { count: chosenCount, total: slugs.length });
  $('build-list').replaceChildren(...slugs.map((slug) => categoryRow(slug)));
  renderStage();
  renderCredits();
  renderSummary();
  if ($('compat-dialog').open) renderCompatDetails();
  document.title = `${t('build.title')} | ${t('site.name')}`;
}

function update() {
  saveBuild(state.build);
  render();
  runCheck();
}

// ---------- Start ----------

const picker = createPartPicker({
  onAdd: (item) => {
    choosePart(state.build, item, state.pending?.replaceIndex ?? null);
    state.pending = null;
    update();
  },
});

initTheme();
await initLanguage();
initNavbar();

try {
  state.categories = await api.getCategories();
} catch {
  $('build-error').hidden = false; // the parts list still shows, with the category slugs
}
await setupStage();
render();
runCheck();
document.addEventListener('languagechange', render);

$('compat-status').addEventListener('click', () => {
  renderCompatDetails();
  $('compat-dialog').showModal();
});
$('compat-close').addEventListener('click', () => $('compat-dialog').close());
$('compat-dialog').addEventListener('click', (event) => {
  if (event.target === $('compat-dialog')) $('compat-dialog').close();
});
