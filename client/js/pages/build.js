import * as api from '/js/api.js';
import { initLanguage, getLanguage, t, formatPrice } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import { el } from '/js/components/dom.js';
import { renderPcCase } from '/js/components/pcCase.js';
import { createPartPicker } from '/js/components/partPicker.js';
import {
  loadLocalBuilds, saveLocalBuilds, clearLocalBuilds, loadOpenBuildId, saveOpenBuildId,
  itemsForApi, fromServer, newLocalId, itemsOf, choosePart, removeItem, MULTI_CATEGORIES,
} from '/js/buildStore.js';
import { renderBuildsBar } from '/js/components/buildsBar.js';
import { PART_MODELS } from '/js/pcModels.js';

const $ = (id) => document.getElementById(id);

// The core parts, in the order of the list (docs/pages.md)
const CORE_ORDER = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler'];
// Optional extras, shown under the core parts (not in the case drawing, not in the count)
const PERIPHERAL_ORDER = ['monitor', 'mouse', 'keyboard', 'headset'];

const state = {
  user: null,      // the signed-in user, or null for a guest
  builds: [],      // every build of the user (one tab each)
  build: { id: '', name: '', items: [] }, // the open build
  tabStatus: {},   // build id -> its last compatibility status, for the dot on its tab
  categories: [],
  pending: null, // { category, replaceIndex } while the picker is open
  scene: null,   // the 3D case, or null when the flat drawing is used
  modelSlugs: [], // the parts shown with a real 3D model (their authors are credited)
  check: null,     // the server's compatibility check: { status, estimate_w, results, parts }
  suggestion: null, // a ready-made PC like the build: { count, cheapest, cpu_name, gpu_chipset }
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

const STATUS_ICONS = { compatible: 'check', warnings: 'warning', incompatible: 'cross', error: 'cross' };

// The icons of the live bar (24x24 line drawings)
const BAR_ICONS = {
  money: 'M3 7h18v10H3z M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M6 10v4 M18 10v4',
  parts: 'M7 7h10v10H7z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  warning: 'M12 6v8 M12 18h.01',
  cross: 'M7 7l10 10 M17 7L7 17',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  expand: 'M14 4h6v6 M10 20H4v-6 M20 4l-7 7 M4 20l7-7',
};

function barIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', BAR_ICONS[name]);
  svg.append(path);
  return svg;
}

// One part of the bar: a round icon, a small label over the value, then anything extra
function pillContent(icon, label, value, ...extra) {
  return [
    el('span', { class: 'build-pill-icon', 'aria-hidden': 'true' }, barIcon(icon)),
    el('span', { class: 'build-pill-text' },
      el('span', { class: 'build-pill-label', text: label }),
      typeof value === 'string' ? el('span', { class: 'build-pill-value', text: value }) : value),
    ...extra,
  ].filter(Boolean);
}

function overallStatus() {
  if (state.build.items.length === 0) return 'empty';
  if (state.checking && !state.check) return 'checking';
  return state.check?.status ?? 'error';
}

// ---------- The live bar: total and readiness ----------

// Price + shipping of every chosen offer (peripherals too), in SAR
function buildTotal() {
  return state.build.items.reduce((sum, item) => sum + item.offer.total_sar, 0);
}

// The core parts not chosen yet. The cooler is not listed: whether one is needed depends on the
// CPU, and the compatibility check says so ("This CPU does not come with a cooler").
function missingParts(build = state.build) {
  return slugsToShow().filter((slug) => slug !== 'cooler' && itemsOf(build, slug).length === 0);
}

let shownTotal = null;

function renderTotal() {
  const total = buildTotal();
  const box = $('build-total');
  box.replaceChildren(...pillContent('money', t('build.total'),
    el('span', { class: 'build-pill-value price', text: formatPrice(total) })));
  // A short flash when the total changes, so the change is noticed
  if (shownTotal !== null && total !== shownTotal) {
    box.classList.remove('is-changed');
    void box.offsetWidth; // restarts the animation
    box.classList.add('is-changed');
  }
  shownTotal = total;
}

function renderReady() {
  const missing = missingParts();
  const box = $('build-ready');
  const ready = missing.length === 0 && state.check && state.check.status !== 'incompatible';
  box.className = `build-pill ${ready ? 'is-ready' : 'is-missing'}`;
  let value = t('build.ready');
  box.removeAttribute('title');
  if (!ready && missing.length > 0) {
    value = t('build.missing', { count: missing.length });
    box.title = t('build.missingList', { parts: missing.map((slug) => categoryName(slug)).join(' · ') });
  } else if (!ready) {
    value = t('build.notReady'); // every part is there, but they do not fit together
  }
  box.replaceChildren(...pillContent(ready ? 'check' : 'parts', t('build.partsLabel'), value));
}

function renderSummary() {
  renderTotal();
  renderReady();
  const overall = overallStatus();
  const button = $('compat-status');
  button.className = `build-pill is-${overall}`;
  button.disabled = overall === 'empty' || overall === 'checking';
  button.replaceChildren(...pillContent(STATUS_ICONS[overall] ?? 'check', t('compat.label'), t(`compat.${overall}`),
    reasonText(overall),
    !button.disabled && el('span', { class: 'build-pill-expand', 'aria-hidden': 'true' }, barIcon('expand'))));

  const watts = state.check?.estimate_w;
  $('build-watts').hidden = !watts;
  if (watts) $('build-watts').replaceChildren(...pillContent('bolt', t('compat.wattsLabel'), t('compat.wattsValue', { watts })));
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
      STATUS_ICONS[overall] ? el('span', { class: 'build-pill-icon', 'aria-hidden': 'true' }, barIcon(STATUS_ICONS[overall])) : null,
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

// ---------- Ready-made PC suggestion ----------

// The parts a ready-made PC replaces; with all of them chosen, the build has a total to compare
const PC_PARTS = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case'];
const DISMISSED_KEY = 'build:prebuiltDismissed';

// The card stays closed until the CPU or the GPU changes: it remembers which pair it was closed for
function cpuGpuKey() {
  const id = (category) => itemsOf(state.build, category)[0]?.item.product.id ?? '';
  return `${id('cpu')}-${id('gpu')}`;
}

function isDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === cpuGpuKey();
  } catch {
    return false;
  }
}

function renderSuggestion() {
  const match = state.suggestion;
  $('prebuilt-card').hidden = !match || isDismissed();
  if (!match) return;

  // Filtered on the GPU only: a CPU filter by name would hide the same-class CPUs of the other brand
  const query = new URLSearchParams({ category: 'prebuilt', gpu_chipset: match.gpu_chipset });
  $('prebuilt-link').href = `/pages/parts.html?${query}`;
  $('prebuilt-offer').textContent = `${t('suggest.from', { price: formatPrice(match.cheapest.total_sar), store: match.cheapest.store_name })} · ${t('suggest.count', { count: match.count })}`;

  // The difference only means something when the build has every part a ready-made PC has
  const complete = PC_PARTS.every((category) => itemsOf(state.build, category).length > 0);
  const buildTotal = state.build.items
    .filter((item) => CORE_ORDER.includes(item.category))
    .reduce((sum, item) => sum + item.offer.total_sar, 0);
  const diff = match.cheapest.total_sar - buildTotal;
  const diffBox = $('prebuilt-diff');
  diffBox.hidden = !complete;
  diffBox.className = `prebuilt-diff ${diff < 0 ? 'is-cheaper' : 'is-dearer'}`;
  if (complete) {
    diffBox.textContent = Math.abs(diff) < 1
      ? t('suggest.same')
      : t(diff < 0 ? 'suggest.cheaper' : 'suggest.dearer', { amount: formatPrice(Math.abs(diff)) });
  }
}

let latestSuggestion = 0;

async function runSuggestion() {
  const request = ++latestSuggestion;
  const hasCpuAndGpu = ['cpu', 'gpu'].every((category) => itemsOf(state.build, category).length > 0);
  let match = null;
  if (hasCpuAndGpu) {
    try {
      match = await api.prebuiltMatch(state.build.items.map((item) => item.product.id));
    } catch {
      // No suggestion this time; the build works without it
    }
  }
  if (request !== latestSuggestion) return;
  state.suggestion = match;
  renderSuggestion();
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
  state.tabStatus[state.build.id] = check?.status;
  state.checking = false;
  render();
}

function slugsToShow() {
  const core = state.categories.filter((c) => c.kind === 'core').map((c) => c.slug);
  return CORE_ORDER.filter((slug) => core.length === 0 || core.includes(slug));
}

function peripheralsToShow() {
  const extras = state.categories.filter((c) => c.kind === 'peripheral').map((c) => c.slug);
  return PERIPHERAL_ORDER.filter((slug) => extras.length === 0 || extras.includes(slug));
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
  renderBar();
  const slugs = slugsToShow();
  const chosenCount = slugs.filter((slug) => status(slug) !== 'empty').length;
  $('build-count').textContent = t('build.count', { count: chosenCount, total: slugs.length });
  $('build-list').replaceChildren(...slugs.map((slug) => categoryRow(slug)));
  $('peripheral-list').replaceChildren(...peripheralsToShow().map((slug) => categoryRow(slug)));
  renderStage();
  renderCredits();
  renderSummary();
  renderSuggestion();
  if ($('compat-dialog').open) renderCompatDetails();
  document.title = `${t('build.title')} | ${t('site.name')}`;
}

function update() {
  saveOpenBuild();
  render();
  runCheck();
  runSuggestion();
}

// The live bar sticks right under the top bar, whose height changes with the screen size
function followHeaderHeight() {
  const header = $('site-header');
  const apply = () => document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
  new ResizeObserver(apply).observe(header);
  apply();
}

// ---------- Builds: tabs, saving, and moving a guest's builds to the account ----------

const SAVE_DELAY_MS = 400; // quick changes in a row are saved in one request
const saveTimers = new Map(); // build id -> waiting save

function defaultName(number) {
  return t('build.defaultName', { n: number });
}

function showNote() {
  $('build-saved-note').textContent = t(state.user ? 'build.savedAccount' : 'build.savedGuest');
}

// The dot on a tab: red with a clash, green when ready, grey while empty or in progress
function dotOf(build) {
  if (build.items.length === 0) return 'empty';
  const status = state.tabStatus[build.id];
  if (status === 'incompatible') return 'error';
  if (status && missingParts(build).length === 0) return 'ready';
  return 'progress';
}

function renderBar() {
  renderBuildsBar($('builds-bar'), {
    builds: state.builds,
    currentId: state.build.id,
    dotOf,
    onSelect: openBuild,
    onAdd: () => addBuild(),
    onRename: renameBuild,
    onDuplicate: duplicateBuild,
    onDelete: deleteBuild,
  });
  showNote();
}

function rememberOpenBuild() {
  if (state.user) saveOpenBuildId(state.user.id, state.build.id);
  else saveLocalBuilds(state.builds, state.build.id);
}

function openBuild(id) {
  state.build = state.builds.find((build) => build.id === id) ?? state.builds[0];
  state.check = null;
  state.suggestion = null;
  rememberOpenBuild();
  render();
  runCheck();
  runSuggestion();
}

async function saveToAccount(build, options) {
  saveTimers.delete(build.id);
  try {
    await api.updateBuild(build.id, { name: build.name, items: itemsForApi(build) }, options);
    $('build-save-error').hidden = true;
  } catch {
    $('build-save-error').hidden = false;
  }
}

// Every change is saved right away: guests in this browser, signed-in users in their account
function saveOpenBuild() {
  if (!state.user) {
    saveLocalBuilds(state.builds, state.build.id);
    return;
  }
  const build = state.build;
  clearTimeout(saveTimers.get(build.id));
  saveTimers.set(build.id, setTimeout(() => saveToAccount(build), SAVE_DELAY_MS));
}

// A change made just before closing the page is still sent
window.addEventListener('pagehide', () => {
  for (const [id, timer] of saveTimers) {
    clearTimeout(timer);
    const build = state.builds.find((item) => item.id === id);
    if (build) saveToAccount(build, { keepalive: true });
  }
});

async function addBuild(name = defaultName(state.builds.length + 1), items = []) {
  let build;
  if (state.user) {
    try {
      const saved = await api.createBuild({ name, items: itemsForApi({ items }) });
      build = { id: String(saved.id), name: saved.name, items };
    } catch {
      $('build-save-error').hidden = false;
      return;
    }
  } else {
    build = { id: newLocalId(), name, items };
  }
  state.builds.push(build);
  openBuild(build.id);
}

function renameBuild() {
  const answer = window.prompt(t('build.renamePrompt'), state.build.name);
  const name = answer?.trim().slice(0, 60);
  if (!name) return;
  state.build.name = name;
  saveOpenBuild();
  renderBar();
}

// A copy in a new tab, to try other parts without changing the original
function duplicateBuild() {
  const items = state.build.items.map((item) => ({ ...item, product: { ...item.product }, offer: { ...item.offer } }));
  addBuild(t('build.copyName', { name: state.build.name }).slice(0, 60), items);
}

// Only the user deletes a build, after saying yes. There is always at least one build.
async function deleteBuild() {
  if (!window.confirm(t('build.deleteConfirm', { name: state.build.name }))) return;
  const build = state.build;
  if (state.user) {
    clearTimeout(saveTimers.get(build.id));
    saveTimers.delete(build.id);
    try {
      await api.deleteBuild(build.id);
    } catch {
      $('build-save-error').hidden = false;
      return;
    }
  }
  state.builds = state.builds.filter((item) => item !== build);
  delete state.tabStatus[build.id];
  if (state.builds.length === 0) {
    await addBuild(defaultName(1));
    return;
  }
  openBuild(state.builds[0].id);
}

// After signing in, the builds made as a guest in this browser move to the account
async function moveGuestBuilds(local) {
  const waiting = local.builds.filter((build) => build.items.length > 0);
  let moved = 0;
  for (const build of waiting) {
    try {
      await api.createBuild({ name: build.name || defaultName(moved + 1), items: itemsForApi(build) });
      moved += 1;
    } catch {
      // The rest stay in this browser and move next time
      saveLocalBuilds(waiting.slice(moved), null);
      return moved;
    }
  }
  clearLocalBuilds();
  return moved;
}

function chooseOpenBuild(rememberedId) {
  state.build = state.builds.find((build) => build.id === rememberedId) ?? state.builds[0];
}

async function loadBuilds() {
  const local = loadLocalBuilds();

  if (state.user) {
    try {
      const moved = await moveGuestBuilds(local);
      if (moved > 0) {
        $('build-notice').textContent = t('build.movedToAccount');
        $('build-notice').hidden = false;
      }
      state.builds = (await api.getBuilds()).map(fromServer);
      if (state.builds.length === 0) {
        const saved = await api.createBuild({ name: defaultName(1), items: [] });
        state.builds = [{ id: String(saved.id), name: saved.name, items: [] }];
      }
      chooseOpenBuild(String(loadOpenBuildId(state.user.id) ?? ''));
      return;
    } catch {
      // The account could not be read: keep building in this browser for now
      $('build-error').hidden = false;
      state.user = null;
    }
  }

  state.builds = local.builds.length > 0 ? local.builds : [{ id: newLocalId(), name: '', items: [] }];
  state.builds.forEach((build, index) => { if (!build.name) build.name = defaultName(index + 1); });
  chooseOpenBuild(local.currentId);
  await refreshLocalPrices();
}

// A guest's builds keep a copy of each price, so the prices are asked again when the page opens:
// a changed price is updated, a removed offer becomes the cheapest one, a removed part goes away.
async function refreshLocalPrices() {
  let removed = 0;
  await Promise.all(state.builds.filter((build) => build.items.length > 0).map(async (build) => {
    try {
      const { items } = await api.refreshBuildItems(itemsForApi(build));
      removed += build.items.length - items.length;
      build.items = items;
    } catch {
      // The saved prices stay until next time
    }
  }));
  saveLocalBuilds(state.builds, state.build.id);
  if (removed > 0) {
    $('build-notice').textContent = t('build.partsRemoved', { count: removed });
    $('build-notice').hidden = false;
  }
}

// The dots of the other tabs: their compatibility is checked once when the page opens
async function checkOtherTabs() {
  const others = state.builds.filter((build) => build !== state.build && build.items.length > 0);
  await Promise.all(others.map(async (build) => {
    try {
      state.tabStatus[build.id] = (await api.checkBuild(build.items.map((item) => item.product.id))).status;
    } catch {
      // the tab keeps a grey dot
    }
  }));
  renderBar();
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
followHeaderHeight();

try {
  state.user = await api.getMe();
} catch {
  state.user = null; // treated as a guest
}
await loadBuilds();

try {
  state.categories = await api.getCategories();
} catch {
  $('build-error').hidden = false; // the parts list still shows, with the category slugs
}
await setupStage();
render();
runCheck();
runSuggestion();
checkOtherTabs();
document.addEventListener('languagechange', render);

$('prebuilt-close').addEventListener('click', () => {
  try {
    localStorage.setItem(DISMISSED_KEY, cpuGpuKey());
  } catch {
    // It will show again after a reload
  }
  $('prebuilt-card').hidden = true;
});

$('compat-status').addEventListener('click', () => {
  renderCompatDetails();
  $('compat-dialog').showModal();
});
$('compat-close').addEventListener('click', () => $('compat-dialog').close());
$('compat-dialog').addEventListener('click', (event) => {
  if (event.target === $('compat-dialog')) $('compat-dialog').close();
});
