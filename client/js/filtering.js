// The logic of the Parts page filters, with no DOM: reading them from the address,
// writing them back, and checking whether a part matches.
//
// The filters object:
// { brand: ['ASUS'], store: [2], priceMin: null, priceMax: 1500, specs: { socket: ['AM5'], cores: 6, wifi: true } }
// specs: a list of values for a `multi` filter, a number for `min`, true/false for `bool`.

import { SPEC_FILTERS } from '/js/filterConfig.js';

export function definitionsFor(category) {
  return SPEC_FILTERS[category] || [];
}

export function emptyFilters() {
  return { brand: [], store: [], priceMin: null, priceMax: null, specs: {} };
}

// Text compared without case and spaces. 'cpu' also drops the brand word at the start.
export function normalize(value, mode) {
  const text = String(value).toLowerCase().replace(/\s+/g, '');
  return mode === 'cpu' ? text.replace(/^(amd|intel)/, '') : text;
}

function positiveNumber(text) {
  if (text === null || text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// ---------- The address ----------

// Reads the filters from the address, e.g. ?brand=ASUS&socket=AM5&cores=6&wifi=true&price_max=1500
export function readFilters(params, definitions) {
  const filters = emptyFilters();
  filters.brand = params.getAll('brand');
  filters.store = params.getAll('store').map(Number).filter(Number.isInteger);
  filters.priceMin = positiveNumber(params.get('price_min'));
  filters.priceMax = positiveNumber(params.get('price_max'));

  for (const def of definitions) {
    if (def.type === 'multi') {
      const values = params.getAll(def.key);
      if (values.length > 0) filters.specs[def.key] = values;
    } else if (def.type === 'min') {
      const number = positiveNumber(params.get(def.key));
      if (number !== null) filters.specs[def.key] = number;
    } else if (def.type === 'bool') {
      const text = params.get(def.key);
      if (text === 'true' || text === 'false') filters.specs[def.key] = text === 'true';
    }
  }
  return filters;
}

export function writeFilters(filters, params) {
  filters.brand.forEach((brand) => params.append('brand', brand));
  filters.store.forEach((id) => params.append('store', id));
  if (filters.priceMin !== null) params.set('price_min', filters.priceMin);
  if (filters.priceMax !== null) params.set('price_max', filters.priceMax);

  for (const [key, value] of Object.entries(filters.specs)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else params.set(key, value);
  }
}

// ---------- The active filters (shown as chips) ----------

// One item per chosen value: { kind: 'brand' | 'store' | 'priceMin' | 'priceMax' | 'spec', key, value }
export function listActive(filters) {
  const items = [
    ...filters.brand.map((value) => ({ kind: 'brand', value })),
    ...filters.store.map((value) => ({ kind: 'store', value })),
  ];
  if (filters.priceMin !== null) items.push({ kind: 'priceMin', value: filters.priceMin });
  if (filters.priceMax !== null) items.push({ kind: 'priceMax', value: filters.priceMax });

  for (const [key, value] of Object.entries(filters.specs)) {
    if (Array.isArray(value)) value.forEach((item) => items.push({ kind: 'spec', key, value: item }));
    else items.push({ kind: 'spec', key, value });
  }
  return items;
}

export function removeActive(filters, item) {
  if (item.kind === 'brand') filters.brand = filters.brand.filter((value) => value !== item.value);
  else if (item.kind === 'store') filters.store = filters.store.filter((value) => value !== item.value);
  else if (item.kind === 'priceMin') filters.priceMin = null;
  else if (item.kind === 'priceMax') filters.priceMax = null;
  else if (Array.isArray(filters.specs[item.key])) {
    const rest = filters.specs[item.key].filter((value) => value !== item.value);
    if (rest.length > 0) filters.specs[item.key] = rest;
    else delete filters.specs[item.key];
  } else {
    delete filters.specs[item.key];
  }
}

export function hasActive(filters) {
  return listActive(filters).length > 0;
}

// ---------- Options for the panel ----------

const byText = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

// The values of a field found in the parts, without repeats, in order
export function optionValues(products, def) {
  const found = new Map();
  for (const product of products) {
    const raw = product.specs?.[def.key];
    const values = def.array ? raw ?? [] : [raw];
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const id = normalize(value, def.normalize);
      if (!found.has(id)) found.set(id, value);
    }
  }
  return [...found.values()].sort(byText);
}

export function isSelected(list, value, mode) {
  return list.some((item) => normalize(item, mode) === normalize(value, mode));
}

// ---------- Matching ----------

function matchesSpec(product, def, wanted) {
  const value = product.specs?.[def.key];
  if (value === undefined || value === null) return false;

  if (def.type === 'multi') {
    const values = def.array ? value : [value];
    return wanted.some((item) => isSelected(values, item, def.normalize));
  }
  if (def.type === 'min') return Number(value) >= wanted;
  return value === wanted;
}

export function matches(product, filters, definitions) {
  if (filters.brand.length > 0 && !isSelected(filters.brand, product.brand)) return false;
  if (filters.store.length > 0 && !product.store_ids.some((id) => filters.store.includes(id))) return false;

  if (filters.priceMin !== null || filters.priceMax !== null) {
    const price = product.cheapest?.total_sar;
    if (price === undefined) return false;
    if (filters.priceMin !== null && price < filters.priceMin) return false;
    if (filters.priceMax !== null && price > filters.priceMax) return false;
  }

  return definitions.every((def) => {
    const wanted = filters.specs[def.key];
    return wanted === undefined || matchesSpec(product, def, wanted);
  });
}
