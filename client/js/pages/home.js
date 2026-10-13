import * as api from '/js/api.js';
import { initLanguage, getLanguage, t } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';

const grid = document.getElementById('category-grid');
const state = document.getElementById('category-state');

let categories = [];

function showState(text, { isError = false } = {}) {
  state.hidden = false;
  state.className = isError ? 'state alert alert-danger' : 'state';
  state.textContent = text;
  grid.replaceChildren();
}

// One card per category; each opens the parts page filtered by it
function renderCategories() {
  if (categories.length === 0) {
    showState(t('states.empty'));
    return;
  }

  state.hidden = true;
  const lang = getLanguage();
  grid.replaceChildren(...categories.map((category) => {
    const link = document.createElement('a');
    link.className = 'card category-card';
    link.href = `/pages/parts.html?category=${encodeURIComponent(category.slug)}`;
    // The picture is decorative: the name under it says the same thing
    const picture = document.createElement('img');
    picture.src = `/images/categories/${category.slug}.svg`;
    picture.alt = '';
    picture.loading = 'lazy';
    const name = document.createElement('span');
    name.textContent = lang === 'ar' ? category.name_ar : category.name_en;
    link.append(picture, name);
    return link;
  }));
}

async function loadCategories() {
  showState(t('states.loading'));
  try {
    categories = await api.getCategories();
    renderCategories();
  } catch {
    showState(t('states.error'), { isError: true });
  }
}

initTheme();
await initLanguage();
initNavbar();
document.title = t('site.name');
loadCategories();

// The category names and the page title follow the language
document.addEventListener('languagechange', () => {
  document.title = t('site.name');
  if (categories.length > 0) renderCategories();
});
