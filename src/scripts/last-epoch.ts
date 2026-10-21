// "Continue" (docs/spec.md 5.1). On a page of an epoch (<html data-epoch>) the epoch id is remembered in localStorage
// (key lastEpoch); on the home page the hidden "Continue" button shows and leads to that epoch. Storage may be blocked:
// then nothing is remembered and the button stays hidden.
import { LAST_EPOCH_KEY, pickLastEpoch } from '../lib/home';

const epoch = document.documentElement.dataset.epoch;
if (epoch) {
  try {
    localStorage.setItem(LAST_EPOCH_KEY, epoch);
  } catch {
    // Blocked storage: nothing to remember.
  }
}

const button = document.querySelector<HTMLAnchorElement>('[data-continue]');
if (button) {
  let hrefs: Record<string, { href: string; name: string }> = {};
  try {
    hrefs = JSON.parse(button.dataset.targets ?? '{}');
  } catch {
    hrefs = {};
  }
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LAST_EPOCH_KEY);
  } catch {
    saved = null;
  }
  const id = pickLastEpoch(saved, Object.keys(hrefs));
  if (id) {
    const target = hrefs[id]!;
    button.href = target.href;
    button.textContent = (button.dataset.template ?? '{name}').replace('{name}', target.name);
    button.hidden = false;
  }
}
