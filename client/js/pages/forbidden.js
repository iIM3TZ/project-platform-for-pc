import { initLanguage, t } from '/js/i18n.js';
import { initTheme } from '/js/theme.js';
import { initNavbar } from '/js/components/navbar.js';

initTheme();
await initLanguage();
initNavbar();
document.title = `${t('forbidden.title')} | ${t('site.name')}`;
document.addEventListener('languagechange', () => {
  document.title = `${t('forbidden.title')} | ${t('site.name')}`;
});
