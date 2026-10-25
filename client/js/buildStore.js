// The current build: which part (and which store offer) is chosen for each category.
// Kept in localStorage for now, so a page reload keeps it; the builds bar task adds several
// builds and saving to the account.
//
// build: { items: [{ category, product: { id, brand, name, image_url }, offer: { id, total_sar, store_name, seller_name } }] }
// The product and offer are a copy of what the user picked, so the page can show them without
// asking the server again.

const STORAGE_KEY = 'build:current';

// Storage is the only core category that can have more than one part
export const MULTI_CATEGORIES = ['storage'];

function isItem(item) {
  return item && typeof item.category === 'string' && item.product?.id && item.offer?.id;
}

export function loadBuild() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.items)) return { items: saved.items.filter(isItem) };
  } catch {
    // Blocked or broken storage: start an empty build
  }
  return { items: [] };
}

export function saveBuild(build) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
  } catch {
    // The build just won't survive a reload
  }
}

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
