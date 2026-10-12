// Light / dark mode.
// With no saved choice, base.css follows the system setting (prefers-color-scheme).
// A saved choice sets data-theme on <html>, which base.css uses instead.

const STORAGE_KEY = 'theme';
const THEMES = ['light', 'dark'];

function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice just won't be remembered next time
  }
}

// The theme on screen right now: the saved choice, or else the system setting
export function getTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (THEMES.includes(explicit)) return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) {
    throw new Error(`Unsupported theme: ${theme}`);
  }
  document.documentElement.dataset.theme = theme;
  storeTheme(theme);
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

// Call once when a page loads
export function initTheme() {
  const stored = readStoredTheme();
  if (stored) {
    document.documentElement.dataset.theme = stored;
  }
}
