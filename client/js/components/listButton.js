// "Add to My list": adds parts and says so in a short message at the bottom of the screen,
// with a link to My list. Used by the part page, the part picker and the Build page.

import { t } from '/js/i18n.js';
import { el } from '/js/components/dom.js';
import { addToMyList } from '/js/listStore.js';

let hideTimer = null;

// A short message ("Added to My list") that goes away by itself. Inside an open <dialog> it is
// put in the dialog, so it shows above it.
export function showToast(text, link = null) {
  document.querySelector('.toast')?.remove();
  const toast = el('div', { class: 'toast', role: 'status' },
    el('span', { text }),
    link && el('a', { href: link.href, text: link.text }));
  (document.querySelector('dialog[open]') ?? document.body).append(toast);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.remove(), 4000);
}

// Adds the parts and tells the user. items: [{ product_id, offer_id, quantity? }]
export async function addWithNotice(items) {
  try {
    await addToMyList(items);
    showToast(t('myList.added'), { href: '/pages/my-list.html', text: t('myList.open') });
  } catch {
    showToast(t('myList.addError'));
  }
}

// A button that adds what getItems() returns
export function addToListButton(getItems, className = 'btn btn-secondary btn-sm') {
  const button = el('button', { class: className, type: 'button', text: t('actions.addToMyList') });
  button.addEventListener('click', async () => {
    button.disabled = true;
    await addWithNotice(getItems());
    button.disabled = false;
  });
  return button;
}
