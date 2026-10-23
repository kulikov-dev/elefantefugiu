// "Surprise me" page: picks a random story from the list embedded in the page and goes there, never the same one twice in a row.
// The list holds every story that is never a heavy topic, each with its age label; the pick follows the family mode
// (isSurpriseAllowed): in "off" any age, in "all" and "12" only what the mode shows. The last story is remembered in
// localStorage (inside try/catch: it can be blocked). location.replace: the Back button of the story leads to the page before this one.
// Without this script the page shows the same list as plain links.
import { isSurpriseAllowed } from '../lib/family';
import { pickSurprise, SURPRISE_KEY } from '../lib/home';
import { currentFamilyMode } from './family-mode';

const data = document.getElementById('surprise-data');
let list: { id: string; href: string; minAge: string; sensitive: boolean }[] = [];
try {
  list = JSON.parse(data?.textContent ?? '[]');
} catch {
  list = [];
}

const mode = currentFamilyMode();
const allowed = list.filter((item) => isSurpriseAllowed(item, mode));
let last: string | null = null;
try {
  last = localStorage.getItem(SURPRISE_KEY);
} catch {
  // Storage blocked: the story may repeat, nothing else is lost.
}
const id = pickSurprise(allowed.map((item) => item.id), last);
const item = allowed.find((x) => x.id === id);

if (item) {
  try {
    localStorage.setItem(SURPRISE_KEY, item.id);
  } catch {
    // See above.
  }
  location.replace(item.href);
} else {
  // Nothing to offer in this mode: say so instead of leaving the reader on a page that seems stuck.
  document.querySelector<HTMLElement>('[data-surprise-none]')?.removeAttribute('hidden');
  document.querySelector<HTMLElement>('[data-surprise-picking]')?.setAttribute('hidden', '');
}
