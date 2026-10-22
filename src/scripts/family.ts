// Family mode menu. The mode is a value on <html data-family> ("off", "all", "12"); the CSS does the hiding.
// The choice is kept in localStorage ("family", see pref.ts): with the storage blocked the menu still works on this page, it is just not remembered.
import { FAMILY_KEY, normalizeFamilyMode, type FamilyMode } from '../lib/family';
import { currentFamilyMode } from './family-mode';
import { readPref, writePref } from './pref';

const html = document.documentElement;
const menu = document.querySelector<HTMLDetailsElement>('[data-family-menu]');
const button = menu?.querySelector<HTMLElement>('summary') ?? null;
const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-family-toggle] input[type="radio"]')];
const status = document.querySelector<HTMLElement>('[data-family-status]');

const readStored = (): FamilyMode => normalizeFamilyMode(readPref(FAMILY_KEY));
const labelKey = (mode: FamilyMode) => (mode === 'off' ? 'labelOff' : mode === 'all' ? 'labelAll' : 'labelTwelve');
const statusKey = (mode: FamilyMode) => (mode === 'off' ? 'statusOff' : mode === 'all' ? 'statusAll' : 'statusTwelve');

/** The radios and the name of the button (for screen readers) follow the mode. */
const syncControls = (mode: FamilyMode) => {
  for (const input of inputs) input.checked = input.value === mode;
  const label = button?.dataset[labelKey(mode)];
  if (button && label) button.setAttribute('aria-label', label);
};

function announce(mode: FamilyMode) {
  if (status) status.textContent = status.dataset[statusKey(mode)] ?? '';
}

function apply(mode: FamilyMode, options: { persist: boolean; announce: boolean }) {
  const changed = mode !== currentFamilyMode();
  html.dataset.family = mode;
  syncControls(mode);
  if (options.persist) writePref(FAMILY_KEY, mode);
  if (options.announce) announce(mode);
  if (changed) document.dispatchEvent(new CustomEvent('family:change', { detail: { mode } }));
}

syncControls(currentFamilyMode());

for (const input of inputs) {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    apply(normalizeFamilyMode(input.value), { persist: true, announce: true });
    // An answer was given: the menu closes and focus returns to the button.
    if (menu?.open) {
      menu.open = false;
      button?.focus();
    }
  });
}

// The menu closes on Escape (focus returns to the button), on a click elsewhere and when focus leaves it.
if (menu) {
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      button?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (menu.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  });
  menu.addEventListener('focusout', (event) => {
    if (menu.open && event.relatedTarget instanceof Node && !menu.contains(event.relatedTarget)) menu.open = false;
  });
}

// Any button with data-family-set="off" (for example "Show all" in the hidden-stories line or in an empty list) sets that mode.
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-family-set]') : null;
  if (target) apply(normalizeFamilyMode(target.dataset.familySet), { persist: true, announce: true });
});

// Another tab changed the mode, or the page came back from the back/forward cache.
window.addEventListener('storage', (event) => {
  if (event.key === FAMILY_KEY) apply(normalizeFamilyMode(event.newValue), { persist: false, announce: false });
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) apply(readStored(), { persist: false, announce: false });
});
