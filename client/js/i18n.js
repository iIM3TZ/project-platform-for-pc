// Language handling: Arabic (default) and English.
// UI text lives in /js/locales/<lang>.json and is read with t('section.key').

const LANGUAGES = {
  ar: { dir: 'rtl', locale: 'ar-SA-u-nu-latn' }, // Arabic text with 0-9 digits, like most Saudi stores
  en: { dir: 'ltr', locale: 'en-SA' },
};
const DEFAULT_LANGUAGE = 'ar';
const STORAGE_KEY = 'lang';

let currentLanguage = DEFAULT_LANGUAGE;
let messages = {};

// localStorage can be blocked (private mode, browser settings), so reads and writes never throw
function readStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLanguage(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // The choice just won't be remembered next time
  }
}

async function loadMessages(lang) {
  const response = await fetch(`/js/locales/${lang}.json`);
  if (!response.ok) {
    throw new Error(`Could not load the ${lang} translations`);
  }
  return response.json();
}

// t('nav.parts') -> "القطع". t('offers.availableIn', { count: 3 }) fills {count}.
// A missing key returns the key itself, so it is easy to spot on the page.
export function t(key, params = {}) {
  const text = key.split('.').reduce((node, part) => node?.[part], messages);
  if (typeof text !== 'string') {
    console.warn(`Missing translation: ${key} (${currentLanguage})`);
    return key;
  }
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match));
}

export function getLanguage() {
  return currentLanguage;
}

// Fills every element that has data-i18n="key" (text) or data-i18n-placeholder,
// data-i18n-aria-label, data-i18n-title (attributes).
export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  const attributes = { i18nPlaceholder: 'placeholder', i18nAriaLabel: 'aria-label', i18nTitle: 'title' };
  for (const [dataName, attribute] of Object.entries(attributes)) {
    const selector = `[data-${dataName.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
    root.querySelectorAll(selector).forEach((el) => {
      el.setAttribute(attribute, t(el.dataset[dataName]));
    });
  }
}

export async function setLanguage(lang) {
  if (!LANGUAGES[lang]) {
    throw new Error(`Unsupported language: ${lang}`);
  }

  messages = await loadMessages(lang);
  currentLanguage = lang;
  storeLanguage(lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = LANGUAGES[lang].dir;
  translatePage();
  document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

export function toggleLanguage() {
  return setLanguage(currentLanguage === 'ar' ? 'en' : 'ar');
}

// Call once when a page loads
export function initLanguage() {
  const stored = readStoredLanguage();
  return setLanguage(LANGUAGES[stored] ? stored : DEFAULT_LANGUAGE);
}

// A date such as "15 Oct 2026", in the current language
export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LANGUAGES[currentLanguage].locale, { dateStyle: 'medium' }).format(date);
}

// Prices are shown in SAR, formatted for the current language
export function formatPrice(amount) {
  return new Intl.NumberFormat(LANGUAGES[currentLanguage].locale, {
    style: 'currency',
    currency: 'SAR',
  }).format(amount);
}
