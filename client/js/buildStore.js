// Builds on the Build page: which part (and which store offer) is chosen for each category.
// A user can have several builds (one tab each). Guests keep them in localStorage; signed-in users
// keep them in their account (the page saves through the API) and only the open tab is remembered here.
//
// build: { id, name, items: [{ category, product: { id, brand, name, image_url },
//                              offer: { id, total_sar, store_name, seller_name } }] }
// The product and offer are a copy of what the user picked, so the page can show them without
// asking the server again. A guest build's id starts with "local-".

const LOCAL_KEY = 'builds:local';
const OLD_KEY = 'build:current'; // the single build saved before builds had tabs

// Storage is the only core category that can have more than one part
export const MULTI_CATEGORIES = ['storage'];

function isItem(item) {
  return item && typeof item.category === 'string' && item.product?.id && item.offer?.id;
}

function cleanBuild(build) {
  return {
    id: String(build.id),
    name: typeof build.name === 'string' ? build.name : '',
    items: Array.isArray(build.items) ? build.items.filter(isItem) : [],
  };
}

export function newLocalId() {
  return `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const isLocalId = (id) => String(id).startsWith('local-');

// localStorage can be blocked or hold broken data: reading never throws
function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The builds just won't survive a reload
  }
}

// ---------- Guests ----------

// { builds, currentId }. The single build of the old format becomes the first build.
export function loadLocalBuilds() {
  const saved = readJson(LOCAL_KEY);
  if (saved && Array.isArray(saved.builds)) {
    return { builds: saved.builds.map(cleanBuild), currentId: saved.currentId ?? null };
  }
  const old = readJson(OLD_KEY);
  if (old && Array.isArray(old.items)) {
    return { builds: [cleanBuild({ id: newLocalId(), name: '', items: old.items })], currentId: null };
  }
  return { builds: [], currentId: null };
}

export function saveLocalBuilds(builds, currentId) {
  writeJson(LOCAL_KEY, { builds, currentId });
  writeJson(OLD_KEY, null);
}

export function clearLocalBuilds() {
  writeJson(LOCAL_KEY, null);
  writeJson(OLD_KEY, null);
}

// ---------- Signed-in users: which tab was open ----------

export const loadOpenBuildId = (userId) => readJson(`builds:open:${userId}`);
export const saveOpenBuildId = (userId, buildId) => writeJson(`builds:open:${userId}`, buildId);

// The parts as the API wants them
export const itemsForApi = (build) => build.items.map((item) => ({ product_id: item.product.id, offer_id: item.offer.id }));

export const fromServer = (build) => cleanBuild(build);

// ---------- Parts of a build ----------

// The items of one category, each with its index in build.items (used to change or remove it)
export function itemsOf(build, category) {
  return build.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.category === category);
}

// Puts a part in the build. It replaces the part of that category, except for storage, which
// adds a drive (or replaces the drive at replaceIndex when the user chose "Change").
export function choosePart(build, item, replaceIndex = null) {
  if (replaceIndex !== null && build.items[replaceIndex]) {
    build.items[replaceIndex] = item;
  } else if (MULTI_CATEGORIES.includes(item.category)) {
    build.items.push(item);
  } else {
    build.items = [...build.items.filter((existing) => existing.category !== item.category), item];
  }
}

export function removeItem(build, index) {
  build.items.splice(index, 1);
}
