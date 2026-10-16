// Family mode toggle. The mode is a value on <html data-family> ("off", "all", "12"); the CSS does the hiding.
// The choice is kept in localStorage ("family"), every read and write inside try/catch: with the storage blocked
// the toggle still works on this page, it is just not remembered.
import { FAMILY_KEY, normalizeFamilyMode, type FamilyMode } from '../lib/family';
import { currentFamilyMode } from './family-mode';

const html = document.documentElement;
const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-family-toggle] input[type="radio"]')];
const status = document.querySelector<HTMLElement>('[data-family-status]');

const readStored = (): FamilyMode => {
  try {
    return normalizeFamilyMode(localStorage.getItem(FAMILY_KEY));
  } catch {
    return 'off';
  }
};

const writeStored = (mode: FamilyMode) => {
  try {
    localStorage.setItem(FAMILY_KEY, mode);
  } catch {
    // Storage blocked: the mode lasts until the page is left.
  }
};

const syncInputs = (mode: FamilyMode) => {
  for (const input of inputs) input.checked = input.value === mode;
};

function announce(mode: FamilyMode) {
  if (!status) return;
  const label = inputs.find((i) => i.value === mode)?.parentElement?.textContent?.trim() ?? mode;
  status.textContent = (status.dataset.template ?? '{mode}').replace('{mode}', label);
}

function apply(mode: FamilyMode, options: { persist: boolean; announce: boolean }) {
  const changed = mode !== currentFamilyMode();
  html.dataset.family = mode;
  syncInputs(mode);
  if (options.persist) writeStored(mode);
  if (options.announce) announce(mode);
  if (changed) document.dispatchEvent(new CustomEvent('family:change', { detail: { mode } }));
}

syncInputs(currentFamilyMode());

for (const input of inputs) {
  input.addEventListener('change', () => {
    if (input.checked) apply(normalizeFamilyMode(input.value), { persist: true, announce: true });
  });
}

// Any button with data-family-set="off" (for example "Show all modes" in an empty list) sets that mode.
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-family-set]') : null;
  if (button) apply(normalizeFamilyMode(button.dataset.familySet), { persist: true, announce: true });
});

// Another tab changed the mode, or the page came back from the back/forward cache.
window.addEventListener('storage', (event) => {
  if (event.key === FAMILY_KEY) apply(normalizeFamilyMode(event.newValue), { persist: false, announce: false });
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) apply(readStored(), { persist: false, announce: false });
});
