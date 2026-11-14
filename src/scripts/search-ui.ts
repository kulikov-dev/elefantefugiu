// The search (docs/spec.md "Поиск"): a field, the results under it. Read on the first press of the magnifier (src/scripts/search-open.ts) or by the page of
// the search (search-page.ts). The index is Pagefind's (dist/pagefind/, made after the build); the strings, the places and the eras come from /<lang>/search.json.
// The interface is our own: over the page as a bar in the header (from 48 rem) or a full-screen sheet (a phone), or inline on the page of the search.
// The text of a query goes nowhere: GoatCounter is told that a search happened and that the map was opened from it, nothing more.
// The style is a string put into the page on the first opening: an ordinary import would be a <link> in the head of every page.
import searchCss from '../styles/search.css?inline';
import { withBase, type Lang } from '../i18n/routes';
import { pickPlural } from '../lib/plural-pick';
import { SEARCH_DELAY_MS, SEARCH_EVENT, SEARCH_FETCH, SEARCH_MAP_EVENT, SEARCH_MIN_CHARS, highlight, mapPlaceLink, placeFirst, placeForQuery, visibleHits, type SearchHit } from '../lib/search';
import type { SearchData } from '../lib/search-data';
import type { Counter } from '../lib/like';
import { currentFamilyMode } from './family-mode';

interface PagefindResult {
  id: string;
  data: () => Promise<{ url: string; meta: Partial<Record<keyof SearchHit, string>> }>;
}
interface Pagefind {
  search: (term: string | null, options?: { filters?: Record<string, string> }) => Promise<{ results: PagefindResult[] }>;
}

const lang = (['pt', 'en', 'ru'].includes(document.documentElement.lang) ? document.documentElement.lang : 'en') as Lang;
const LOCALES: Record<Lang, string> = { pt: 'pt-PT', en: 'en-US', ru: 'ru-RU' };
/** The width from which the header has room for the field (the tab bar of a phone is gone from here too). */
const BAR_QUERY = '(min-width: 48rem)';

let styled = false;
const addStyle = () => {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = searchCss;
  document.head.append(style);
};

let loaded: Promise<{ data: SearchData; pagefind: Pagefind }> | undefined;
/** The index and the data are read once, on the first opening. */
function load() {
  loaded ??= Promise.all([
    fetch(withBase(`${lang}/search.json`)).then((r) => (r.ok ? (r.json() as Promise<SearchData>) : Promise.reject(new Error(String(r.status))))),
    import(/* @vite-ignore */ withBase('pagefind/pagefind.js')) as Promise<Pagefind>,
  ]).then(([data, pagefind]) => ({ data, pagefind }));
  loaded.catch(() => {
    loaded = undefined; // asked for again at the next opening
  });
  return loaded;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const ICON = (path: string) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  svg.append(p);
  return svg;
};

/** Text with the words of the query marked. */
function markedText(text: string, query: string): Node[] {
  return highlight(text, query).map((piece) => {
    if (!piece.mark) return document.createTextNode(piece.text);
    return el('mark', undefined, piece.text);
  });
}

const count = (path: string) => {
  try {
    (window as unknown as { goatcounter?: Counter }).goatcounter?.count?.({ path, title: path, event: true });
  } catch {
    // The counter is only told; nothing depends on it.
  }
};

export interface SearchHandle {
  root: HTMLElement;
  input: HTMLInputElement;
  close: () => void;
}

type Layout = 'bar' | 'sheet' | 'page';

/** Builds the search, puts it where the layout says and returns it. */
function build(layout: Layout, onClose?: () => void): SearchHandle {
  addStyle();
  const root = el('div', 'search');
  root.dataset.search = '';
  root.dataset.layout = layout;
  root.dataset.state = 'idle';
  if (layout === 'page') root.setAttribute('role', 'search');
  else root.setAttribute('role', 'dialog');
  if (layout === 'sheet') root.setAttribute('aria-modal', 'true');

  const form = el('form', 'search__bar');
  form.setAttribute('role', 'search');
  form.addEventListener('submit', (event) => event.preventDefault());
  const field = el('div', 'search__field');
  field.append(ICON('M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM16 16l5 5'));
  const input = el('input', 'search__input');
  input.type = 'search';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.enterKeyHint = 'search';
  input.setAttribute('autocapitalize', 'off');
  field.append(input);
  form.append(field);
  const close = el('button', 'search__close');
  close.type = 'button';
  close.append(ICON('M6 6l12 12M18 6L6 18'));
  if (layout !== 'page') form.append(close);

  const results = el('div', 'search__results');
  const status = el('p', 'search__status');
  status.setAttribute('role', 'status');
  const mapLink = el('a', 'search__map');
  mapLink.hidden = true;
  const list = el('ul', 'search__list');
  const empty = el('div', 'search__empty');
  empty.hidden = true;
  results.append(status, mapLink, list, empty);
  root.append(form, results);

  let strings: Record<string, string> = {};
  let data: SearchData | undefined;
  let timer: number | undefined;
  let serial = 0;
  let counted = false;

  const setState = (state: string) => {
    root.dataset.state = state;
    results.hidden = state === 'idle';
  };
  results.hidden = true;

  const clear = () => {
    status.textContent = '';
    status.classList.remove('search__status--shown');
    mapLink.hidden = true;
    list.replaceChildren();
    empty.hidden = true;
    empty.replaceChildren();
  };
  const say = (text: string, visible: boolean) => {
    status.textContent = text;
    status.classList.toggle('search__status--shown', visible);
  };

  const render = (query: string, hits: SearchHit[]) => {
    clear();
    if (!data) return;
    const mode = currentFamilyMode();
    const place = placeForQuery(query, data.places, mode);
    if (hits.length === 0) {
      setState('empty');
      const lead = el('p', 'search__empty-text', strings.empty);
      const links = el('ul', 'search__empty-list');
      links.setAttribute('aria-label', strings.empty_list ?? '');
      for (const epoch of data.epochs) {
        const item = el('li');
        const link = el('a');
        link.href = epoch.href;
        const mark = el('span', 'search__mark');
        mark.style.setProperty('--tone', `var(--tone-${epoch.id})`);
        mark.setAttribute('aria-hidden', 'true');
        link.append(mark, epoch.name);
        item.append(link);
        links.append(item);
      }
      const surprise = el('li');
      const surpriseLink = el('a', 'search__surprise', data.surprise.name);
      surpriseLink.href = data.surprise.href;
      surprise.append(surpriseLink);
      links.append(surprise);
      empty.append(lead, links);
      empty.hidden = false;
      say(strings.empty ?? '', false);
      return;
    }
    setState('results');
    say(pickPlural(strings, 'results', hits.length, LOCALES[lang]).replace('{n}', String(hits.length)), false);
    if (place) {
      mapLink.href = mapPlaceLink(data.mapHref, place.key);
      mapLink.textContent = pickPlural(strings, 'map', place.n[mode], LOCALES[lang]).replace('{n}', String(place.n[mode])).replace('{place}', place.name);
      mapLink.hidden = false;
    }
    for (const hit of hits) {
      const item = el('li', 'search__item');
      item.style.setProperty('--tone', `var(--tone-${hit.epoch})`);
      const mark = el('span', 'search__mark');
      mark.setAttribute('aria-hidden', 'true');
      const link = el('a');
      link.href = hit.url; // Pagefind writes it from the place the index is served from: the base path is in it already
      const title = el('span', 'search__title');
      title.append(...markedText(hit.title, query));
      const hook = el('span', 'search__hook');
      hook.append(...markedText(hit.hook, query));
      const meta = el('span', 'search__meta');
      meta.append(...markedText([hit.year, hit.place].filter(Boolean).join(' · '), query));
      link.append(title, hook, meta);
      item.append(mark, link);
      list.append(item);
    }
  };

  const run = async (query: string) => {
    const mine = ++serial;
    setState('loading');
    say(strings.loading ?? '', true);
    try {
      const { data: loadedData, pagefind } = await load();
      data = loadedData;
      strings = loadedData.strings;
      if (mine !== serial) return;
      if (!counted) {
        counted = true;
        count(SEARCH_EVENT);
      }
      const mode = currentFamilyMode();
      const place = placeForQuery(query, data.places, mode);
      const [ranked, inPlace] = await Promise.all([
        pagefind.search(query),
        place ? pagefind.search(null, { filters: { pkey: place.key } }) : Promise.resolve({ results: [] as PagefindResult[] }),
      ]);
      const ordered = place ? placeFirst(ranked.results, inPlace.results) : ranked.results;
      const loadedHits = await Promise.all(
        ordered.slice(0, SEARCH_FETCH).map(async (r) => {
          const d = await r.data();
          return { url: d.url, title: d.meta.title ?? '', excerpt: '', hook: d.meta.hook ?? '', year: d.meta.year ?? '', place: d.meta.place ?? '', epoch: d.meta.epoch ?? '', pkey: d.meta.pkey ?? '', age: d.meta.age ?? 'all', sens: d.meta.sens ?? 'false' } satisfies SearchHit;
        }),
      );
      if (mine !== serial) return;
      render(query, visibleHits(loadedHits, mode));
    } catch {
      if (mine !== serial) return;
      clear();
      setState('error');
      say(strings.error ?? '', true);
    }
  };

  const update = () => {
    window.clearTimeout(timer);
    const query = input.value.trim();
    if (query.length < SEARCH_MIN_CHARS) {
      serial += 1;
      clear();
      setState(query ? 'hint' : 'idle');
      if (query) say(strings.hint ?? '', true);
      return;
    }
    timer = window.setTimeout(() => void run(query), SEARCH_DELAY_MS);
  };
  input.addEventListener('input', update);

  // The first press may come before the strings do: the field is made from the page's own language as soon as they arrive.
  void load()
    .then(({ data: d }) => {
      data = d;
      strings = d.strings;
      input.placeholder = strings.placeholder ?? '';
      input.setAttribute('aria-label', strings.label ?? '');
      close.setAttribute('aria-label', strings.close ?? '');
      root.setAttribute('aria-label', strings.dialog ?? '');
      if (input.value.trim().length >= SEARCH_MIN_CHARS) update();
    })
    .catch(() => {
      if (input.value.trim().length >= SEARCH_MIN_CHARS) update();
    });

  // The map line leads away: the event is told before the page changes (and never the words).
  mapLink.addEventListener('click', () => count(SEARCH_MAP_EVENT));

  // The arrows walk the results (the field is before the first one); Enter in the field opens the first story.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
    const links = [...results.querySelectorAll<HTMLAnchorElement>('.search__map:not([hidden]), .search__item a')];
    if (event.key === 'Enter') {
      if (event.target === input) {
        const first = results.querySelector<HTMLAnchorElement>('.search__item a');
        if (first) {
          event.preventDefault();
          first.click();
        }
      }
      return;
    }
    if (links.length === 0) return;
    event.preventDefault();
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === 'ArrowDown' ? at + 1 : at - 1;
    if (next < 0) input.focus();
    else (links[Math.min(next, links.length - 1)] ?? input).focus();
  });

  close.addEventListener('click', () => onClose?.());

  return { root, input, close: () => onClose?.() };
}

let open: { handle: SearchHandle; shut: () => void } | undefined;

// The loader (search-open.ts) asks for the search with this event, fired on the magnifier that was pressed.
document.addEventListener('search:open', (event) => {
  if (event.target instanceof HTMLElement) openSearch(event.target);
});

/** Opens the search over the page: a bar in the header from 48 rem, a full-screen sheet below it. */
function openSearch(trigger: HTMLElement): void {
  const page = document.querySelector<HTMLInputElement>('[data-search-page] .search__input');
  if (page) {
    page.focus();
    return;
  }
  if (open) {
    open.handle.input.focus();
    return;
  }
  const bar = window.matchMedia(BAR_QUERY).matches;
  const layout: Layout = bar ? 'bar' : 'sheet';
  const inert: HTMLElement[] = [];
  let shut = (_refocus = true) => {};
  const handle = build(layout, () => shut());
  const host = bar ? (trigger.closest<HTMLElement>('.site-header__inner') ?? document.body) : document.body;
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      shut();
    }
  };
  const onPointer = (event: PointerEvent) => {
    const target = event.target as Node;
    if (!handle.root.contains(target) && !trigger.contains(target)) shut(false);
  };
  const onResize = () => {
    if (window.matchMedia(BAR_QUERY).matches !== bar) shut(false);
  };
  const media = window.matchMedia(BAR_QUERY);
  shut = (refocus = true) => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onPointer, true);
    media.removeEventListener('change', onResize);
    handle.root.remove();
    for (const node of inert) node.inert = false;
    trigger.setAttribute('aria-expanded', 'false');
    open = undefined;
    if (refocus) trigger.focus();
  };
  // In the header the field stands before the tools (language, theme, age), where the menu was.
  if (bar) host.insertBefore(handle.root, host.querySelector('.site-header__tools'));
  else host.append(handle.root);
  if (!bar) {
    // The sheet takes the whole screen: what is under it takes no part in the reading or the tabbing.
    for (const node of document.body.children) {
      if (node !== handle.root && node instanceof HTMLElement && (node.matches('.lang-block, main') || node.id === 'main')) {
        node.inert = true;
        inert.push(node);
      }
    }
  }
  trigger.setAttribute('aria-expanded', 'true');
  document.addEventListener('keydown', onKey);
  if (bar) document.addEventListener('pointerdown', onPointer, true);
  media.addEventListener('change', onResize);
  open = { handle, shut };
  handle.input.focus({ preventScroll: true });
}

// The page of the search (search-page.ts) asks for the field with this event, fired on the place that holds it.
document.addEventListener('search:mount', (event) => {
  if (event.target instanceof HTMLElement) mountSearchPage(event.target);
});

// Nothing is exported: a module that is read with import() and has exports brings a helper with it, and the helper lives in the chunk of the map.
export {};

/** The page of the search: the field stands in the page, the magnifier of the header takes the focus to it. */
function mountSearchPage(host: HTMLElement): void {
  const handle = build('page');
  host.replaceChildren(handle.root);
  host.hidden = false;
  handle.input.focus({ preventScroll: true });
}
