// A click on a link to the "Surprise me" page takes the reader straight to a random story (location.assign), without stopping on that page.
// The list comes from a small file of the language (/pt/surprise.json, src/pages/[lang]/surprise.json.ts), read on the click; the file is
// asked for again only if the first try failed. The pick is the next card of a deck without repeats (src/lib/surprise-bag.ts: unread stories
// first, never the one the reader has open, the family mode respected through isSurpriseAllowed). If anything fails (no file, no stories, blocked storage) the link
// works as an ordinary link to the page, which does the same and says what is wrong. Clicks with a modifier key or a middle button are left alone.
import { isSurpriseAllowed } from '../lib/family';
import { pagePath, withBase, type Lang } from '../i18n/routes';
import { currentFamilyMode } from './family-mode';
import { nextSurprise } from './surprise-bag';

interface Item {
  id: string;
  href: string;
  minAge: string;
  sensitive: boolean;
}

const lang = (['pt', 'en', 'ru'].includes(document.documentElement.lang) ? document.documentElement.lang : 'en') as Lang;
const pagePathname = new URL(pagePath(lang, 'surprise'), location.href).pathname;
let busy = false;

async function choose(): Promise<string | null> {
  const response = await fetch(withBase(`/${lang}/surprise.json`));
  if (!response.ok) return null;
  const list = (await response.json()) as Item[];
  const mode = currentFamilyMode();
  const allowed = list.filter((item) => isSurpriseAllowed(item, mode));
  const current = list.find((item) => item.href === location.pathname)?.id ?? null;
  const id = nextSurprise(allowed.map((item) => item.id), current).id;
  const item = allowed.find((x) => x.id === id);
  if (!item) return null;
  return item.href;
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
  if (!link || link.target || new URL(link.href, location.href).pathname !== pagePathname) return;
  event.preventDefault();
  if (busy) return;
  busy = true;
  choose()
    .then((href) => location.assign(href ?? link.href))
    .catch(() => location.assign(link.href))
    .finally(() => {
      busy = false;
    });
});
