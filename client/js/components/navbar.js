// The navigation on every page: a top bar (page links, search, language and theme) and a
// side menu (account and the same page links). Call initNavbar() after initLanguage().
// The template is fixed text with no user data; the account part is built with textContent.

import * as api from '/js/api.js';
import { toggleLanguage, translatePage, t } from '/js/i18n.js';
import { toggleTheme, getTheme } from '/js/theme.js';
import { el } from '/js/components/dom.js';

const SUN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const SEARCH = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const MENU = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// The pages shown in the top bar and in the menu: [translation key, address]
const PAGE_LINKS = [
  ['nav.parts', '/pages/parts.html'],
  ['nav.build', '/pages/build.html'],
  ['nav.myList', '/pages/my-list.html'],
];

function pageLinksHtml() {
  return PAGE_LINKS
    .map(([key, href]) => `<a href="${href}" data-i18n="${key}"></a>`)
    .join('');
}

const TEMPLATE = `
  <div class="container nav-inner">
    <a class="nav-logo" href="/" data-i18n="site.name"></a>

    <nav class="nav-links" data-i18n-aria-label="nav.pagesLabel">${pageLinksHtml()}</nav>

    <form class="nav-search" role="search" action="/pages/parts.html" method="get">
      <label class="visually-hidden" for="nav-search-input" data-i18n="nav.searchLabel"></label>
      <input class="input" id="nav-search-input" type="search" name="q" autocomplete="off"
             data-i18n-placeholder="nav.searchPlaceholder">
      <button class="nav-icon-btn" type="submit" data-i18n-aria-label="nav.searchLabel">${SEARCH}</button>
    </form>

    <div class="nav-actions">
      <button class="btn btn-secondary btn-sm" type="button" id="language-toggle"
              data-i18n="language.switchTo" data-i18n-aria-label="language.switchLabel"></button>
      <button class="nav-icon-btn" type="button" id="theme-toggle"></button>
      <button class="nav-icon-btn" type="button" id="menu-open" aria-expanded="false" aria-controls="site-menu"
              data-i18n-aria-label="nav.menu">${MENU}</button>
    </div>
  </div>

  <div class="menu-backdrop" id="menu-backdrop" hidden></div>
  <aside class="menu-panel" id="site-menu" role="dialog" aria-modal="true" data-i18n-aria-label="nav.menu" hidden>
    <div class="menu-head">
      <strong data-i18n="nav.menu"></strong>
      <button class="nav-icon-btn" type="button" id="menu-close" data-i18n-aria-label="actions.close">${CLOSE}</button>
    </div>

    <section class="menu-section" id="menu-account" data-i18n-aria-label="nav.account"></section>

    <nav class="menu-section menu-links" data-i18n-aria-label="nav.pagesLabel">
      <a href="/" data-i18n="nav.home"></a>
      ${pageLinksHtml()}
    </nav>
  </aside>
`;

function markCurrentPage(header) {
  header.querySelectorAll('a[href]').forEach((link) => {
    if (link.classList.contains('nav-logo')) return;
    if (new URL(link.href).pathname === location.pathname) link.setAttribute('aria-current', 'page');
  });
}

// The theme button shows the mode it switches to
function renderThemeButton(button) {
  const dark = getTheme() === 'dark';
  const label = t(dark ? 'theme.toLight' : 'theme.toDark');
  button.innerHTML = dark ? SUN : MOON;
  button.setAttribute('aria-label', label);
  button.title = label;
}

// ---------- Account ----------

// The sign-in link brings the user back to this page afterwards (not from the sign-in pages themselves)
function signInHref(page) {
  const here = location.pathname + location.search;
  const onAuthPage = ['/pages/signin.html', '/pages/signup.html'].includes(location.pathname);
  return onAuthPage ? page : `${page}?next=${encodeURIComponent(here)}`;
}

function guestAccount() {
  return [
    el('a', { class: 'btn btn-primary', href: signInHref('/pages/signin.html'), text: t('nav.signIn') }),
    el('a', { class: 'menu-secondary-link', href: signInHref('/pages/signup.html'), text: t('nav.signUp') }),
  ];
}

// A square with the first letter of the username stands in for a profile picture (Phase 8)
function userAccount(user) {
  const isAdmin = user.role === 'admin';
  const signOut = el('button', { class: 'btn btn-secondary', type: 'button', text: t('nav.signOut') });
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    try {
      await api.signOut();
    } finally {
      location.reload();
    }
  });

  return [
    el('div', { class: 'menu-user' },
      el('span', { class: 'menu-avatar', 'aria-hidden': 'true', text: user.username.charAt(0).toUpperCase() }),
      el('span', { class: 'menu-username', text: user.username }),
      isAdmin && el('span', { class: 'badge badge-primary', text: t('nav.adminBadge') })),
    // Only a link: the admin page and its API are protected on the server (requireAdmin)
    isAdmin && el('nav', { class: 'menu-links', 'aria-label': t('nav.account') },
      el('a', { href: '/pages/admin.html', text: t('nav.admin') })),
    signOut,
  ];
}

function renderAccount(section, user) {
  section.replaceChildren(...(user ? userAccount(user) : guestAccount()));
  section.querySelectorAll('a[href]').forEach((link) => {
    if (new URL(link.href).pathname === location.pathname) link.setAttribute('aria-current', 'page');
  });
}

// Who is signed in. Until the answer comes (or if it fails) the menu shows the guest links.
async function loadAccount(section) {
  let user = null;
  renderAccount(section, null);
  try {
    user = await api.getMe();
  } catch {
    // The guest links stay
  }
  renderAccount(section, user);
  document.addEventListener('languagechange', () => renderAccount(section, user));
}

// ---------- Menu ----------

function setupMenu(header) {
  const openButton = header.querySelector('#menu-open');
  const closeButton = header.querySelector('#menu-close');
  const panel = header.querySelector('#site-menu');
  const backdrop = header.querySelector('#menu-backdrop');

  function setOpen(open) {
    panel.hidden = !open;
    backdrop.hidden = !open;
    openButton.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('menu-is-open', open);
    // Focus goes into the panel when it opens and back to the button when it closes
    (open ? closeButton : openButton).focus();
  }

  openButton.addEventListener('click', () => setOpen(true));
  closeButton.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
}

export function initNavbar() {
  const header = document.getElementById('site-header');
  header.className = 'site-header';
  header.innerHTML = TEMPLATE;

  const themeButton = header.querySelector('#theme-toggle');
  translatePage(header);
  markCurrentPage(header);
  renderThemeButton(themeButton);
  setupMenu(header);
  loadAccount(header.querySelector('#menu-account'));

  header.querySelector('#language-toggle').addEventListener('click', toggleLanguage);
  themeButton.addEventListener('click', toggleTheme);
  document.addEventListener('themechange', () => renderThemeButton(themeButton));
  document.addEventListener('languagechange', () => renderThemeButton(themeButton));
}
