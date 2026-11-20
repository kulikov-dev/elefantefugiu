// The cabinet of rarities in the browser (docs/spec.md "Кабинет редкостей"). Works only when the cabinet is open (<html data-cabinet="open">) or the owner previews it
// (data-cabinet="preview", src/lib/cabinet-preview.ts); on every other page load it does nothing at all.
//   - a hidden word in a story (span.cw) becomes a button: a press saves the rarity (localStorage `cabinet.v1`) and opens its card;
//   - the page of the cabinet shows what is found, the tin, the pop-ups of the tiles, the garlands of the finished cabinet;
//   - seven sardines swim in the corners of seven pages;
//   - in the preview it also adds the links the closed build does not have (the card in the hub of the games, the link in the footer, the way back from a story of a rarity).
// Everything is in try/catch: without localStorage the page works as before and nothing is kept. The counter (GoatCounter, already on the site) gets
// cabinet-item-<id>, cabinet-sardine-<n> and cabinet-complete, nothing else.
import './../styles/cabinet.css';
import { EPOCH_SEGMENT, RANK_SEGMENT, ROUTES, withBase, type Lang } from '../i18n/routes';
import { CABINET_KEY, SARDINES, parseStore, withItem, withSardine, type CabinetStore } from '../lib/cabinet';
import { buntingSvg, sardineSvg, tinSvg } from '../lib/cabinet-art';
import type { ItemData } from '../lib/cabinet-data';
import { isVisibleInMode } from '../lib/family';
import { SARDINE_PLACES } from '../lib/cabinet-places';
import { currentFamilyMode, onFamilyChange } from './family-mode';

const html = document.documentElement;
const mode = html.dataset.cabinet;
const preview = mode === 'preview';
const lang = (['pt', 'en', 'ru'].includes(html.lang) ? html.lang : 'pt') as Lang;

interface Payload {
  strings: Record<string, string>;
  items: Record<string, ItemData>;
  partyHref: string | null;
  href: string;
  hubCard?: string;
  footerLink?: string;
  games?: string;
}

const fill = (text: string, vars: Record<string, string | number>): string => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text);

// ---- Storage ----
const read = (): CabinetStore => {
  try {
    return parseStore(localStorage.getItem(CABINET_KEY));
  } catch {
    return parseStore(null);
  }
};
let store = read();
// Blocked storage: what is found stays for this page load only.
const save = (next: CabinetStore): void => {
  store = next;
  try {
    localStorage.setItem(CABINET_KEY, JSON.stringify(next));
  } catch {
    // Not kept.
  }
};
window.addEventListener('storage', (event) => {
  if (event.key !== CABINET_KEY) return;
  store = read();
  refreshPage?.();
});

// ---- Counter ----
function count(path: string, title: string): void {
  try {
    (window as unknown as { goatcounter?: { count?: (v: { path: string; title: string; event: true }) => void } }).goatcounter?.count?.({ path, title, event: true });
  } catch {
    // No counter: nothing breaks.
  }
}

// ---- The texts ----
let payloadPromise: Promise<Payload | null> | undefined;
function payload(): Promise<Payload | null> {
  const own = document.querySelector<HTMLScriptElement>('script[data-cabinet-data]');
  if (own) {
    try {
      return (payloadPromise ??= Promise.resolve(JSON.parse(own.textContent ?? '') as Payload));
    } catch {
      return Promise.resolve(null);
    }
  }
  return (payloadPromise ??= fetchPayload());
}

/** The full payload (with the card of the hub and the link of the footer): the page of the cabinet carries a short one inline. */
const fetchPayload = (): Promise<Payload | null> =>
  fetch(withBase(`${lang}/cabinet.json`))
    .then((r) => (r.ok ? (r.json() as Promise<Payload>) : null))
    .catch(() => null);

const visible = (item: ItemData): boolean => isVisibleInMode({ minAge: item.minAge, sensitive: item.sensitive }, currentFamilyMode());

// ---- The pop-up ----
interface Action {
  label: string;
  href?: string;
  ghost?: boolean;
}
interface PopSpec {
  kicker?: string;
  title: string;
  thumb?: HTMLElement;
  text?: string;
  actions?: Action[];
}

let pop: HTMLElement | undefined;
let popOwner: HTMLElement | undefined;
let closeLabel = 'x';

function closePop(restoreFocus = true): void {
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  const owner = popOwner;
  popOwner = undefined;
  if (restoreFocus && owner?.isConnected) owner.focus();
}

function openPop(anchor: HTMLElement, spec: PopSpec): void {
  closePop(false);
  if (!pop) {
    pop = document.createElement('div');
    pop.className = 'cab-pop';
    pop.setAttribute('role', 'dialog');
    document.body.append(pop);
  }
  pop.replaceChildren();
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cab-pop__close';
  close.setAttribute('aria-label', closeLabel);
  close.textContent = '×';
  close.addEventListener('click', () => closePop());
  const head = document.createElement('div');
  head.className = 'cab-pop__head';
  if (spec.thumb) head.append(spec.thumb);
  else head.style.gridTemplateColumns = '1fr';
  const titles = document.createElement('div');
  if (spec.kicker) {
    const k = document.createElement('p');
    k.className = 'cab-pop__kicker';
    k.textContent = spec.kicker;
    titles.append(k);
  }
  const h = document.createElement('p');
  h.className = 'cab-pop__title';
  h.textContent = spec.title;
  titles.append(h);
  head.append(titles);
  pop.append(close, head);
  pop.setAttribute('aria-label', spec.title);
  if (spec.text) {
    const p = document.createElement('p');
    p.textContent = spec.text;
    pop.append(p);
  }
  let first: HTMLElement | undefined;
  if (spec.actions?.length) {
    const row = document.createElement('div');
    row.className = 'cab-pop__actions';
    for (const action of spec.actions) {
      const a = document.createElement('a');
      a.className = `cab-pop__button${action.ghost ? ' cab-pop__button--ghost' : ''}`;
      a.href = action.href ?? '#';
      a.textContent = action.label;
      row.append(a);
      first ??= a;
    }
    pop.append(row);
  }
  popOwner = anchor;
  pop.hidden = false;
  place(anchor);
  (first ?? close).focus({ preventScroll: true });
}

/** Beside the anchor: under it, or above when there is no room under it; inside the screen sideways. */
function place(anchor: HTMLElement): void {
  if (!pop) return;
  const box = anchor.getBoundingClientRect();
  const wide = html.clientWidth;
  const width = pop.offsetWidth;
  const height = pop.offsetHeight;
  const gutter = 16;
  let left = box.left + box.width / 2 - width / 2;
  left = Math.max(gutter, Math.min(left, wide - width - gutter));
  const below = window.innerHeight - box.bottom;
  const top = below >= height + 8 || below >= box.top ? box.bottom + 8 : box.top - height - 8;
  pop.style.left = `${Math.round(left + window.scrollX)}px`;
  pop.style.top = `${Math.round(top + window.scrollY)}px`;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && pop && !pop.hidden) closePop();
});
document.addEventListener('click', (event) => {
  if (!pop || pop.hidden) return;
  const target = event.target as Node;
  if (pop.contains(target) || popOwner?.contains(target)) return;
  closePop(false);
});
window.addEventListener('resize', () => {
  if (pop && !pop.hidden && popOwner) place(popOwner);
});

/** The object of a rarity (the PNG of the shelf, no frame); a rarity without a picture has none. */
function thumb(item: ItemData | undefined): HTMLElement | undefined {
  if (!item?.image) return undefined;
  const img = document.createElement('img');
  img.className = 'cab-thumb';
  img.src = item.image;
  img.alt = '';
  return img;
}

// ---- The hidden words ----
async function wireWords(spans: HTMLElement[]): Promise<void> {
  const data = await payload();
  if (!data) return;
  closeLabel = data.strings.close ?? closeLabel;
  for (const span of spans) {
    const id = span.dataset.cw ?? '';
    const item = data.items[id];
    if (!item || !visible(item)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cw';
    button.dataset.cw = id;
    button.setAttribute('aria-label', fill(data.strings.word_label ?? '{name}', { name: item.name }));
    button.setAttribute('aria-haspopup', 'dialog');
    button.textContent = span.textContent;
    span.replaceWith(button);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const already = store.items.includes(id);
      if (!already) {
        save(withItem(store, id, Date.now()));
        count(`cabinet-item-${id}`, item.name);
        maybeComplete(data);
      }
      openPop(button, {
        kicker: already ? data.strings.already : undefined,
        title: already ? item.name : fill(data.strings.found_title ?? '{name}', { name: item.name }),
        thumb: thumb(item),
        text: item.summary,
        actions: [{ label: data.strings.open_story ?? '', href: item.href }, { label: data.strings.to_cabinet ?? '', href: data.href, ghost: true }],
      });
    });
  }
}

/** The event of the finished cabinet: every rarity of the mode and all the sardines, once. */
function maybeComplete(data: Payload): void {
  if (store.foundAt.complete !== undefined) return;
  const items = Object.entries(data.items).filter(([, item]) => visible(item));
  if (store.sardines.length < SARDINES || items.some(([id]) => !store.items.includes(id))) return;
  save({ ...store, foundAt: { ...store.foundAt, complete: Date.now() } });
  count('cabinet-complete', 'cabinet');
}

// ---- The page of the cabinet ----
let refreshPage: (() => void) | undefined;
function wirePage(root: HTMLElement, data: Payload): void {
  const s = data.strings;
  closeLabel = s.close ?? closeLabel;
  const tiles = [...root.querySelectorAll<HTMLElement>('[data-item]')];
  const labels = new Map([...root.querySelectorAll<HTMLElement>('[data-label]')].map((el) => [el.dataset.label ?? '', el]));
  const found = root.querySelector<HTMLElement>('[data-found-line]');
  const tin = root.querySelector<HTMLElement>('[data-tin]');
  const tinArt = root.querySelector<HTMLElement>('[data-tin-art]');
  const tinCount = root.querySelector<HTMLElement>('[data-tin-count]');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const note = root.querySelector<HTMLElement>('[data-preview-note]');
  const party = root.querySelector<HTMLElement>('[data-party]');
  const bunting = party?.querySelector<SVGSVGElement>('svg[data-bunting]');
  /** The bunting is drawn at the real width of the card, so the flags are never stretched. */
  const hang = (): void => {
    if (!party || !bunting || party.clientWidth === 0) return;
    const w = party.clientWidth;
    const h = bunting.clientHeight;
    bunting.setAttribute('viewBox', `0 0 ${w} ${h}`);
    bunting.innerHTML = buntingSvg(w);
  };
  if (party) new ResizeObserver(hang).observe(party);
  if (note && preview) note.hidden = false;

  const refresh = (): void => {
    const shown = tiles.filter((tile) => {
      const item = data.items[tile.dataset.item ?? ''];
      return item !== undefined && visible(item);
    });
    let total = 0;
    let have = 0;
    for (const tile of tiles) {
      const id = tile.dataset.item ?? '';
      const item = data.items[id];
      const on = shown.includes(tile);
      tile.hidden = !on;
      labels.get(id)!.hidden = !on;
      if (!item || !on) continue;
      const isFound = store.items.includes(id);
      total += 1;
      if (isFound) have += 1;
      tile.toggleAttribute('data-found', isFound);
      tile.setAttribute('aria-label', isFound ? fill(s.known_label ?? '{name}', { name: item.name }) : (s.unknown_label ?? ''));
      const label = labels.get(id)!;
      label.textContent = isFound ? item.name : (s.unknown ?? '?');
      label.toggleAttribute('data-unknown', !isFound);
    }
    for (const shelf of root.querySelectorAll<HTMLElement>('[data-shelf]')) {
      const mine = tiles.filter((tile) => shelf.contains(tile) && !tile.hidden);
      shelf.hidden = mine.length === 0;
      shelf.style.setProperty('--n', String(Math.max(1, mine.length)));
      const counter = shelf.querySelector<HTMLElement>('[data-shelf-count]');
      if (counter) counter.textContent = fill(s.shelf_count ?? '', { n: mine.filter((tile) => tile.hasAttribute('data-found')).length, m: mine.length });
    }
    if (found) found.textContent = fill(s.found ?? '', { n: have, m: total });
    if (empty) empty.hidden = total > 0;
    const caught = store.sardines.length;
    if (tinArt) tinArt.innerHTML = tinSvg(caught, 'tin');
    if (tinCount) tinCount.textContent = caught === SARDINES ? (s.tin_full ?? '') : fill(s.tin_count ?? '', { n: caught });
    tin?.setAttribute('aria-label', fill(s.tin_label ?? '', { n: caught }));
    root.toggleAttribute('data-complete', caught === SARDINES);
    hang();
  };
  refreshPage = refresh;
  refresh();

  for (const tile of tiles) {
    tile.addEventListener('click', () => {
      const id = tile.dataset.item ?? '';
      const item = data.items[id];
      if (!item) return;
      if (store.items.includes(id)) {
        openPop(tile, { kicker: `${item.epoch}`, title: item.name, thumb: thumb(item), text: item.summary, actions: [{ label: s.open_story ?? '', href: item.href }] });
      } else {
        openPop(tile, { kicker: `${item.epoch} · ${s.not_found}`, title: s.hint_title ?? '', text: item.hint });
      }
    });
  }
  if (tin) {
    const tip = (): void => {
      const full = store.sardines.length === SARDINES;
      openPop(tin, { title: full ? (s.tin_full ?? '') : (s.tin_label ?? '').replace(/,.*$/, ''), text: full ? s.tin_tip_full : s.tin_tip });
      // The hint beside the tin takes no focus away from it.
      tin.focus({ preventScroll: true });
    };
    tin.addEventListener('mouseenter', tip);
    tin.addEventListener('focus', () => {
      if (!pop || pop.hidden) tip();
    });
    tin.addEventListener('mouseleave', () => closePop(false));
    tin.addEventListener('click', tip);
  }
  onFamilyChange(refresh);
}

// ---- The sardines ----
const pathParts = (): string[] => location.pathname.replace(withBase(), '').split('/').filter(Boolean);

/** The place of the sardine of this page, or nothing when this page has none. `into` is the container; `watch` is a block that is hidden now and holds the sardine once it is shown (the result of the myths). */
function sardineHome(): { n: number; start: boolean; into?: HTMLElement; watch?: HTMLElement } | undefined {
  const parts = pathParts();
  const [, segment, third] = parts;
  const main = document.querySelector<HTMLElement>('#main > .container');
  for (const place of SARDINE_PLACES) {
    let into: HTMLElement | null | undefined;
    if (place.page === 'notfound') into = document.querySelector('[data-notfound-lang]') ? main : undefined;
    else if (place.page === 'epoch') into = segment === EPOCH_SEGMENT[lang] && third && html.dataset.epoch === place.epoch && parts.length === 3 ? main : undefined;
    else if (place.page === 'myths-result') {
      // The page of a range (/zvanie/) is the page of the game with the result not shown: the sardine is at the foot of the page. On the page of the game it is in the result block, once it is shown.
      if (segment !== ROUTES.myths[lang]) continue;
      if (third === RANK_SEGMENT[lang]) into = main;
      else {
        const watch = document.querySelector<HTMLElement>('[data-final]');
        if (watch) return { n: place.n, start: place.start ?? false, ...(watch.hidden ? { watch } : { into: watch }) };
      }
    }
    else into = segment === ROUTES[place.page][lang] && parts.length === 2 ? main : undefined;
    if (into) return { n: place.n, start: place.start ?? false, into };
  }
  return undefined;
}

async function wireSardine(): Promise<void> {
  const home = sardineHome();
  if (!home || store.sardines.includes(home.n)) return;
  const data = await payload();
  if (!data) return;
  if (home.into) return mountSardine(home.n, home.start, home.into, data);
  const watch = home.watch;
  if (!watch) return;
  const seen = new MutationObserver(() => {
    if (watch.hidden) return;
    seen.disconnect();
    if (!store.sardines.includes(home.n)) mountSardine(home.n, home.start, watch, data);
  });
  seen.observe(watch, { attributes: true, attributeFilter: ['hidden'] });
}

function mountSardine(n: number, start: boolean, into: HTMLElement, data: Payload): void {
  const home = { n, start, into };
  const s = data.strings;
  closeLabel = s.close ?? closeLabel;
  const strip = document.createElement('div');
  strip.className = `cab-corner${home.start ? ' cab-corner--start' : ''}`;
  const fish = document.createElement('button');
  fish.type = 'button';
  fish.className = `cab-sardine${home.start ? ' cab-sardine--flip' : ''}`;
  fish.setAttribute('aria-label', s.sardine_label ?? '');
  fish.innerHTML = sardineSvg(`sardine-${home.n}`);
  strip.append(fish);
  home.into.append(strip);
  fish.addEventListener('click', () => {
    if (store.sardines.includes(home.n)) return;
    save(withSardine(store, home.n, Date.now()));
    count(`cabinet-sardine-${home.n}`, `sardine ${home.n}`);
    maybeComplete(data);
    const caught = store.sardines.length;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const show = (): void => {
      // The pop-up stands where the sardine was.
      const spot = document.createElement('span');
      spot.className = 'cab-sardine cab-sardine--gone';
      strip.replaceChildren(spot);
      openPop(spot, { title: fill(s.sardine_title ?? '', { n: caught }), actions: [{ label: s.to_cabinet ?? '', href: data.href }] });
    };
    // After the click has passed the document (a press outside closes a card, and this one is not outside).
    if (reduced) return void setTimeout(show, 0);
    fish.style.setProperty('--cab-swim', `${Math.max(120, strip.clientWidth)}px`);
    fish.classList.add('cab-sardine--swim');
    setTimeout(show, 900);
  });
}

// ---- The preview: the links the closed build does not have ----
async function wirePreview(): Promise<void> {
  const data = await fetchPayload();
  if (!data) return;
  const list = document.querySelector('.games__list');
  if (list && data.hubCard && !list.querySelector('[data-cabinet-card]')) list.insertAdjacentHTML('beforeend', data.hubCard);
  // The footer link goes right after "Games" and nowhere else; with no place found, nothing is inserted.
  if (data.footerLink && data.games && !document.querySelector('.site-footer [data-cabinet-link]')) {
    document.querySelector(`.site-footer__links a[href="${data.games}"]`)?.closest('li')?.insertAdjacentHTML('afterend', data.footerLink);
  }
  const back = document.querySelector<HTMLElement>('[data-cab-back]');
  if (back && !back.querySelector('a')) {
    const a = document.createElement('a');
    a.href = data.href;
    a.textContent = data.strings.back ?? '';
    back.append(a);
  }
}

// ---- Start ----
if (mode === 'open' || preview) {
  const root = document.querySelector<HTMLElement>('[data-cabinet-page]');
  const spans = [...document.querySelectorAll<HTMLElement>('span.cw[data-cw]')];
  if (root) void payload().then((data) => data && wirePage(root, data));
  if (spans.length > 0) void wireWords(spans);
  void wireSardine();
  if (preview) void wirePreview();
}
