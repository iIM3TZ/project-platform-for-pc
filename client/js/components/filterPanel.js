// The filter panel next to the results, and the chips above them that show what is chosen.
// Both change the `filters` object they are given, then call a callback so the page can update.

import { t, formatPrice } from '/js/i18n.js';
import { el } from '/js/components/dom.js';
import { optionValues, isSelected, listActive, removeActive, ADDED_DAYS } from '/js/filtering.js';

// The words for each "Added" choice: 1 = today, 2 = last 2 days, 3 = last 3 days
const ADDED_LABELS = { 1: 'filters.addedToday', 2: 'filters.added2', 3: 'filters.added3' };

function filterLabel(def) {
  return def.labelKey ? t(def.labelKey) : t(`specs.${def.key}`);
}

function numberOrNull(input) {
  const number = Number(input.value);
  return input.value === '' || !Number.isFinite(number) || number <= 0 ? null : number;
}

// A group of checkboxes. options: [{ value, label }]; isChecked(value); toggle(value, checked)
function checkboxGroup(legend, options, isChecked, toggle) {
  const boxes = options.map((option) => {
    const input = el('input', { type: 'checkbox', checked: isChecked(option.value) });
    input.addEventListener('change', () => toggle(option.value, input.checked));
    return el('label', { class: 'checkbox' }, input, option.label);
  });
  return el('fieldset', { class: 'filter-group' }, el('legend', { text: legend }), el('div', { class: 'filter-options' }, ...boxes));
}

function numberField(label, hint, value, onInput) {
  const input = el('input', { class: 'input', type: 'number', min: '0', step: 'any', value: value ?? '' });
  input.addEventListener('change', () => onInput(numberOrNull(input)));
  return el('div', { class: 'field' }, el('label', { text: label }, input), hint && el('span', { class: 'field-hint', text: hint }));
}

function toggleInList(list, value, checked) {
  const rest = list.filter((item) => item !== value);
  return checked ? [...rest, value] : rest;
}

function yesNoField(def, filters, onChange) {
  const current = filters.specs[def.key];
  const select = el('select', { class: 'select' },
    el('option', { value: '', text: t('filters.any') }),
    el('option', { value: 'true', text: t('filters.yes'), selected: current === true }),
    el('option', { value: 'false', text: t('filters.no'), selected: current === false }));
  select.addEventListener('change', () => {
    if (select.value === '') delete filters.specs[def.key];
    else filters.specs[def.key] = select.value === 'true';
    onChange();
  });
  return el('div', { class: 'field' }, el('label', { text: filterLabel(def) }, select));
}

function addedField(filters, onChange) {
  const select = el('select', { class: 'select' },
    el('option', { value: '', text: t('filters.addedAny') }),
    ...ADDED_DAYS.map((days) => el('option', {
      value: String(days), text: t(ADDED_LABELS[days]), selected: filters.addedDays === days,
    })));
  select.addEventListener('change', () => {
    filters.addedDays = select.value === '' ? null : Number(select.value);
    onChange();
  });
  return el('div', { class: 'field' }, el('label', { text: t('filters.added') }, select));
}

function specFilter(def, products, filters, onChange) {
  if (def.type === 'bool') return yesNoField(def, filters, onChange);

  if (def.type === 'min') {
    return numberField(filterLabel(def), t('filters.atLeast'), filters.specs[def.key], (number) => {
      if (number === null) delete filters.specs[def.key];
      else filters.specs[def.key] = number;
      onChange();
    });
  }

  // A value chosen from a link may not be in the parts found, so it is listed too
  const chosen = filters.specs[def.key] || [];
  const found = optionValues(products, def);
  const options = [...found, ...chosen.filter((value) => !isSelected(found, value, def.normalize))];
  if (options.length === 0) return null;

  return checkboxGroup(
    filterLabel(def),
    options.map((value) => ({ value, label: String(value) })),
    (value) => isSelected(chosen, value, def.normalize),
    (value, checked) => {
      const list = toggleInList(filters.specs[def.key] || [], value, checked);
      if (list.length === 0) delete filters.specs[def.key];
      else filters.specs[def.key] = list;
      onChange();
    });
}

// Fills `container` with the filters. stores: [{ id, name }] from the API.
export function renderFilterPanel(container, { definitions, products, stores, filters, onChange }) {
  const brands = [...new Set(products.map((product) => product.brand))].sort((a, b) => a.localeCompare(b));
  const storeIds = new Set(products.flatMap((product) => product.store_ids));
  const storeOptions = stores
    .filter((store) => storeIds.has(store.id))
    .map((store) => ({ value: store.id, label: store.name }));

  const groups = [
    addedField(filters, onChange),

    brands.length > 0 && checkboxGroup(
      t('filters.brand'),
      brands.map((brand) => ({ value: brand, label: brand })),
      (brand) => isSelected(filters.brand, brand),
      (brand, checked) => { filters.brand = toggleInList(filters.brand, brand, checked); onChange(); }),

    storeOptions.length > 0 && checkboxGroup(
      t('filters.store'),
      storeOptions,
      (id) => filters.store.includes(id),
      (id, checked) => { filters.store = toggleInList(filters.store, id, checked); onChange(); }),

    el('fieldset', { class: 'filter-group' },
      el('legend', { text: t('filters.price') }),
      el('div', { class: 'filter-range' },
        numberField(t('filters.priceMin'), '', filters.priceMin, (number) => { filters.priceMin = number; onChange(); }),
        numberField(t('filters.priceMax'), '', filters.priceMax, (number) => { filters.priceMax = number; onChange(); }))),

    ...definitions.map((def) => specFilter(def, products, filters, onChange)),
  ];

  container.replaceChildren(...groups.filter(Boolean));
}

// ---------- Chips ----------

function chipText(item, definitions, stores) {
  if (item.kind === 'brand') return `${t('filters.brand')}: ${item.value}`;
  if (item.kind === 'store') return `${t('filters.store')}: ${stores.find((store) => store.id === item.value)?.name ?? item.value}`;
  if (item.kind === 'priceMin') return t('filters.chipPriceMin', { value: formatPrice(item.value) });
  if (item.kind === 'priceMax') return t('filters.chipPriceMax', { value: formatPrice(item.value) });
  if (item.kind === 'added') return `${t('filters.added')}: ${t(ADDED_LABELS[item.value])}`;

  const label = filterLabel(definitions.find((def) => def.key === item.key));
  if (typeof item.value === 'boolean') return `${label}: ${t(item.value ? 'filters.yes' : 'filters.no')}`;
  if (typeof item.value === 'number') return t('filters.chipMin', { label, value: item.value });
  return `${label}: ${item.value}`;
}

// Fills `container` (a list) with one chip per chosen value, and a "clear all" button.
// onRemove runs after a chip is removed, onClear after "clear all".
export function renderChips(container, { definitions, stores, filters, onRemove, onClear }) {
  const items = listActive(filters);

  const chips = items.map((item) => {
    const text = chipText(item, definitions, stores);
    const button = el('button', { type: 'button', 'aria-label': t('filters.remove', { filter: text }), text: '×' });
    button.addEventListener('click', () => {
      removeActive(filters, item);
      onRemove();
    });
    return el('li', { class: 'chip' }, text, button);
  });

  if (items.length > 1) {
    const clear = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: t('filters.clearAll') });
    clear.addEventListener('click', onClear);
    chips.push(el('li', {}, clear));
  }

  container.hidden = chips.length === 0;
  container.replaceChildren(...chips);
}
