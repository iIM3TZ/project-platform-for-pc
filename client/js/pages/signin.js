import * as api from '/js/api.js';
import { initLanguage, t } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import {
  setupPasswordToggles, showFieldError, showFormMessage, clearErrors, clearErrorOnEdit,
  retranslateErrors, setBusy, nextPage, keepNextOnLink, showNoticeIfSignedIn,
} from '/js/components/authForm.js';

const form = document.getElementById('auth-form');

async function submit(event) {
  event.preventDefault();
  clearErrors(form);

  // login is a username or an email
  const values = { login: form.elements.login.value.trim(), password: form.elements.password.value };
  const missing = Object.keys(values).filter((field) => !values[field]);
  if (missing.length > 0) {
    missing.forEach((field) => showFieldError(form, field, 'auth.required'));
    form.elements[missing[0]].focus();
    return;
  }

  setBusy(form, true, 'auth.signInButton');
  try {
    await api.signIn(values);
    location.href = nextPage();
  } catch (err) {
    // One message for a wrong username, email or password: the page never says which
    showFormMessage(form, err.status === 401 ? 'auth.wrongLogin' : 'states.error');
    setBusy(form, false, 'auth.signInButton');
  }
}

initTheme();
await initLanguage();
initNavbar();
document.title = `${t('auth.signInTitle')} | ${t('site.name')}`;

setupPasswordToggles(form);
clearErrorOnEdit(form);
keepNextOnLink(document.getElementById('switch-link'));
form.addEventListener('submit', submit);
document.addEventListener('languagechange', () => {
  document.title = `${t('auth.signInTitle')} | ${t('site.name')}`;
  retranslateErrors(form);
});
showNoticeIfSignedIn(form);
