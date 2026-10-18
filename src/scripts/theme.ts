// Theme choice: the header button (system, light, dark, round) and the radio group in the footer.
// The theme is a value on <html data-theme>; tokens.css turns it into color-scheme. Stored in localStorage ("theme").
import { nextTheme, normalizeTheme, THEME_COLORS, THEME_KEY, type Theme } from '../lib/theme';
import { readPref, writePref } from './pref';

const html = document.documentElement;
const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-theme-choice] input[type="radio"]')];
const status = document.querySelector<HTMLElement>('[data-theme-status]');

const current = (): Theme => normalizeTheme(html.dataset.theme);
const labelOf = (theme: Theme) => document.querySelector<HTMLElement>(`[data-theme-name="${theme}"]`)?.textContent?.trim() ?? theme;

/** The browser UI colour: the chosen theme, or the device's own (the two media-bound tags) for "system". */
function paintBrowserUi(theme: Theme) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLORS[theme === 'system' ? scheme : theme];
  }
}

function render(theme: Theme, announce: boolean) {
  for (const input of inputs) input.checked = input.value === theme;
  if (button) button.setAttribute('aria-label', (button.dataset.template ?? '{value}').replace('{value}', labelOf(theme)));
  if (announce && status) status.textContent = (status.dataset.template ?? '{value}').replace('{value}', labelOf(theme));
}

function apply(theme: Theme, options: { persist: boolean; announce: boolean }) {
  html.dataset.theme = theme;
  paintBrowserUi(theme);
  render(theme, options.announce);
  if (options.persist) writePref(THEME_KEY, theme);
}

render(current(), false);

button?.addEventListener('click', () => apply(nextTheme(current()), { persist: true, announce: true }));
for (const input of inputs) {
  input.addEventListener('change', () => {
    if (input.checked) apply(normalizeTheme(input.value), { persist: true, announce: true });
  });
}

// Another tab changed the theme, or the page came back from the back/forward cache.
window.addEventListener('storage', (event) => {
  if (event.key === THEME_KEY) apply(normalizeTheme(event.newValue), { persist: false, announce: false });
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) apply(normalizeTheme(readPref(THEME_KEY)), { persist: false, announce: false });
});
