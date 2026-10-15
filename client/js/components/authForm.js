// Shared by the sign-up and sign-in pages: the show/hide password button, field errors,
// and where to go after signing in.

import * as api from '/js/api.js';
import { t } from '/js/i18n.js';

const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

// Every .password-field holds a password input and a button that shows or hides it
export function setupPasswordToggles(root = document) {
  root.querySelectorAll('.password-field').forEach((wrap) => {
    const input = wrap.querySelector('input');
    const button = wrap.querySelector('button');

    const render = () => {
      const shown = input.type === 'text';
      button.innerHTML = shown ? EYE_OFF : EYE;
      button.setAttribute('aria-label', t(shown ? 'auth.hidePassword' : 'auth.showPassword'));
      button.setAttribute('aria-pressed', String(shown));
    };

    button.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      render();
      input.focus();
    });
    document.addEventListener('languagechange', render);
    render();
  });
}

// ---------- Errors ----------
// A message is kept as its translation key, so it can be shown again in the other language

function errorSlot(form, name) {
  return form.querySelector(`[data-error-for="${name}"]`);
}

export function showFieldError(form, name, key) {
  form.elements[name].setAttribute('aria-invalid', 'true');
  const slot = errorSlot(form, name);
  slot.dataset.key = key;
  slot.textContent = t(key);
}

export function showFormMessage(form, key, params = {}) {
  const box = form.querySelector('.auth-message');
  box.dataset.key = key;
  box.dataset.params = JSON.stringify(params);
  box.textContent = t(key, params);
  box.hidden = false;
}

export function clearErrors(form) {
  form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
  form.querySelectorAll('[data-error-for]').forEach((slot) => {
    delete slot.dataset.key;
    slot.textContent = '';
  });
  const box = form.querySelector('.auth-message');
  delete box.dataset.key;
  box.textContent = '';
  box.hidden = true;
}

// A field's error goes away as soon as the user edits it
export function clearErrorOnEdit(form) {
  form.addEventListener('input', (event) => {
    const name = event.target.name;
    if (!name) return;
    event.target.removeAttribute('aria-invalid');
    const slot = errorSlot(form, name);
    if (slot) {
      delete slot.dataset.key;
      slot.textContent = '';
    }
  });
}

export function retranslateErrors(form) {
  form.querySelectorAll('[data-error-for][data-key]').forEach((slot) => {
    slot.textContent = t(slot.dataset.key);
  });
  const box = form.querySelector('.auth-message');
  if (box.dataset.key) box.textContent = t(box.dataset.key, JSON.parse(box.dataset.params || '{}'));
}

// While the form is being sent, the button cannot be pressed twice
export function setBusy(form, busy, idleKey) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  button.textContent = t(busy ? 'auth.sending' : idleKey);
}

// After signing in: back to the page in ?next= (only a page on our own site), or home
export function nextPage() {
  const next = new URLSearchParams(location.search).get('next');
  const isOwnPage = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
  return isOwnPage ? next : '/';
}

// The link to the other form (sign in <-> sign up) keeps ?next=
export function keepNextOnLink(link) {
  const next = new URLSearchParams(location.search).get('next');
  if (next) link.href = `${link.pathname}?next=${encodeURIComponent(next)}`;
}

// Someone already signed in sees who they are and a sign-out button instead of the form
export async function showNoticeIfSignedIn(form) {
  let user = null;
  try {
    user = await api.getMe();
  } catch {
    return; // if the check fails, the form stays usable
  }
  if (!user) return;

  const render = () => {
    document.getElementById('signed-in-text').textContent = t('auth.signedInAs', { username: user.username });
  };
  render();
  document.addEventListener('languagechange', render);

  form.hidden = true;
  document.getElementById('auth-switch').hidden = true;
  document.getElementById('signed-in').hidden = false;
  document.getElementById('sign-out').addEventListener('click', async () => {
    try {
      await api.signOut();
    } finally {
      location.reload();
    }
  });
}
