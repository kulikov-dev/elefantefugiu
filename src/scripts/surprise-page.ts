// "Surprise me" page: picks a story from the list embedded in the page and goes there (nextSurprise, a deck without repeats: unread stories first,
// never the one the reader comes from; when all are read, the page says so with a line).
// The list holds every story that is never a heavy topic, each with its age label; the pick follows the family mode
// (isSurpriseAllowed): in "off" any age, in "all" and "12" only what the mode shows. The deck is kept in
// localStorage (inside try/catch: it can be blocked). location.replace: the Back button of the story leads to the page before this one.
// Without this script the page shows the same list as plain links.
import { isSurpriseAllowed } from '../lib/family';
import { currentFamilyMode } from './family-mode';
import { nextSurprise } from './surprise-bag';

const data = document.getElementById('surprise-data');
let list: { id: string; href: string; title: string; minAge: string; sensitive: boolean }[] = [];
try {
  list = JSON.parse(data?.textContent ?? '[]');
} catch {
  list = [];
}

const mode = currentFamilyMode();
const allowed = list.filter((item) => isSurpriseAllowed(item, mode));
// The story the reader comes from (the page before this one, on this site), so "Surprise me" does not send them back to it.
let current: string | null = null;
try {
  const from = new URL(document.referrer);
  if (from.origin === location.origin) current = list.find((x) => x.href === from.pathname)?.id ?? null;
} catch {
  // No referrer (or not an address): no current story.
}
const { id, allRead } = nextSurprise(allowed.map((item) => item.id), current);
const item = allowed.find((x) => x.id === id);

if (item) {
  if (allRead) {
    // Every story of the mode is read: say so and offer one the reader read long ago (a link, the page stays).
    const note = document.querySelector<HTMLElement>('[data-surprise-allread]');
    const link = note?.querySelector<HTMLAnchorElement>('a');
    if (note && link) {
      link.href = item.href;
      link.textContent = item.title;
      note.removeAttribute('hidden');
      document.querySelector<HTMLElement>('[data-surprise-picking]')?.setAttribute('hidden', '');
      link.focus();
    } else location.replace(item.href);
  } else location.replace(item.href);
} else {
  // Nothing to offer in this mode: say so instead of leaving the reader on a page that seems stuck.
  document.querySelector<HTMLElement>('[data-surprise-none]')?.removeAttribute('hidden');
  document.querySelector<HTMLElement>('[data-surprise-picking]')?.setAttribute('hidden', '');
}
