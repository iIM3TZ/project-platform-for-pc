// The builds bar on the Build page: one tab per build, "+" for a new build, and buttons to rename,
// duplicate or delete the open build. It only draws; the page decides what each action does.
//
// options: builds, currentId, dotOf(build) ('ready' | 'error' | 'empty' | 'progress'),
//          onSelect(id), onAdd(), onRename(), onDuplicate(), onDelete()

import { t } from '/js/i18n.js';
import { el } from '/js/components/dom.js';

function iconButton(symbol, label, onClick, className = '') {
  const button = el('button', { class: `build-tab-action ${className}`, type: 'button', 'aria-label': label, title: label, text: symbol });
  button.addEventListener('click', onClick);
  return button;
}

export function renderBuildsBar(container, { builds, currentId, dotOf, onSelect, onAdd, onRename, onDuplicate, onDelete }) {
  const tabs = builds.map((build) => {
    const selected = build.id === currentId;
    const tab = el('button', {
      class: `build-tab${selected ? ' is-current' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-selected': String(selected),
    },
      el('span', { class: `build-tab-dot is-${dotOf(build)}`, 'aria-hidden': 'true' }),
      el('span', { class: 'build-tab-name', text: build.name }));
    tab.addEventListener('click', () => { if (!selected) onSelect(build.id); });
    return tab;
  });

  container.replaceChildren(
    el('div', { class: 'build-tabs', role: 'tablist', 'aria-label': t('build.buildsLabel') },
      ...tabs,
      iconButton('+', t('build.newBuild'), onAdd, 'is-add')),
    el('div', { class: 'build-tab-actions' },
      iconButton('✎', t('build.rename'), onRename),
      iconButton('⧉', t('build.duplicate'), onDuplicate),
      iconButton('🗑', t('build.delete'), onDelete, 'is-danger')));
}
