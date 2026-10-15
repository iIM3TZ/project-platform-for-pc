import * as api from '/js/api.js';
import { initLanguage, t } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';
import {
  setupPasswordToggles, showFieldError, showFormMessage, clearErrors, clearErrorOnEdit,
  retranslateErrors, setBusy, nextPage, keepNextOnLink, showNoticeIfSignedIn,
} from '/js/components/authForm.js';

const form = document.getElementById('auth-form');

// The same rules as the server (server/src/services/authValidation.js), checked here first
// so the user sees the problem without waiting
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkForm({ username, email, password }) {
  const errors = {};
  if (!USERNAME_PATTERN.test(username)) errors.username = 'auth.usernameRule';
  if (!EMAIL_PATTERN.test(email)) errors.email = 'auth.emailInvalid';
  if (password.length < 8) errors.password = 'auth.passwordShort';
  else if (new TextEncoder().encode(password).length > 72) errors.password = 'auth.passwordLong';
  return errors;
}

// The server's answer, in words for the user
function showServerError(err) {
  if (err.status === 409) {
    if (err.fields.email) showFieldError(form, 'email', 'auth.emailTaken');
    else showFieldError(form, 'username', 'auth.usernameTaken');
    return;
  }
  if (err.status === 400) {
    const keys = { username: 'auth.usernameRule', email: 'auth.emailInvalid', password: 'auth.passwordShort' };
    Object.keys(err.fields).forEach((field) => keys[field] && showFieldError(form, field, keys[field]));
    return;
  }
  showFormMessage(form, 'states.error');
}

async function submit(event) {
  event.preventDefault();
  clearErrors(form);

  const values = {
    username: form.elements.username.value.trim(),
    email: form.elements.email.value.trim(),
    password: form.elements.password.value,
  };
  const errors = checkForm(values);
  if (Object.keys(errors).length > 0) {
    Object.entries(errors).forEach(([field, key]) => showFieldError(form, field, key));
    form.elements[Object.keys(errors)[0]].focus();
    return;
  }

  setBusy(form, true, 'auth.signUpButton');
  try {
    await api.signUp(values); // the account is created and signed in
    location.href = nextPage();
  } catch (err) {
    showServerError(err);
    setBusy(form, false, 'auth.signUpButton');
  }
}

initTheme();
await initLanguage();
initNavbar();
document.title = `${t('auth.signUpTitle')} | ${t('site.name')}`;

setupPasswordToggles(form);
clearErrorOnEdit(form);
keepNextOnLink(document.getElementById('switch-link'));
form.addEventListener('submit', submit);
document.addEventListener('languagechange', () => {
  document.title = `${t('auth.signUpTitle')} | ${t('site.name')}`;
  retranslateErrors(form);
});
showNoticeIfSignedIn(form);
