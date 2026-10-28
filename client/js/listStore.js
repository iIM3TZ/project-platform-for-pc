// My list (قائمتي): single parts with the store offer the user chose, separate from builds.
// Guests keep it in localStorage; signed-in users keep it in their account.
//
// An item: { product_id, offer_id, quantity }

import * as api from '/js/api.js';

const LOCAL_KEY = 'list:local';
export const MAX_QUANTITY = 20;

function isItem(item) {
  return item && Number.isInteger(item.product_id) && Number.isInteger(item.offer_id);
}

function cleanItem(item) {
  const quantity = Number(item.quantity);
  return {
    product_id: item.product_id,
    offer_id: item.offer_id,
    quantity: Number.isInteger(quantity) ? Math.min(Math.max(quantity, 1), MAX_QUANTITY) : 1,
  };
}

// localStorage can be blocked or hold broken data: reading never throws
export function loadLocalList() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
    return Array.isArray(saved) ? saved.filter(isItem).map(cleanItem) : [];
  } catch {
    return [];
  }
}

export function saveLocalList(items) {
  try {
    if (items.length === 0) localStorage.removeItem(LOCAL_KEY);
    else localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    // The list just won't survive a reload
  }
}

export const clearLocalList = () => saveLocalList([]);

// Puts items in a list: the same part with the same offer gets its quantity raised
export function mergeItems(list, items) {
  const merged = list.map((item) => ({ ...item }));
  for (const item of items.map(cleanItem)) {
    const same = merged.find((existing) => existing.product_id === item.product_id && existing.offer_id === item.offer_id);
    if (same) same.quantity = Math.min(same.quantity + item.quantity, MAX_QUANTITY);
    else merged.push(item);
  }
  return merged;
}

// Asked once per page
let userPromise = null;
const currentUser = () => (userPromise ??= api.getMe().catch(() => null));

// Adds parts to My list (from the part page, the part picker or a whole build).
// items: [{ product_id, offer_id, quantity? }]
export async function addToMyList(items) {
  const clean = items.filter(isItem).map(cleanItem);
  if (clean.length === 0) return;
  if (await currentUser()) await api.addListItems(clean);
  else saveLocalList(mergeItems(loadLocalList(), clean));
}
