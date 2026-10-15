// Epoch page: the map next to the feed. This file knows nothing about Leaflet; the map code loads on its own
// (src/scripts/map-loader.ts) and talks to the page with events:
//   map:select (from the map)   a marker was chosen          -> highlight and show the feed record
//   map:focus  (to the map)     a feed record was chosen     -> highlight its marker
//   map:filter (to the map)     sent by epoch-filter.ts when the thread changes
//   map:ready, map:unavailable  (from the map)
// Without JavaScript none of this runs and the page is the plain feed.

const page = document.querySelector<HTMLElement>('[data-epoch]');
const feed = document.querySelector<HTMLElement>('ol.feed');
const aside = document.querySelector<HTMLElement>('[data-epoch-aside]');
const mapRoot = document.querySelector<HTMLElement>('[data-map]');

if (page && feed && aside && mapRoot) {
  const paneButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-pane-btn]')];
  const wide = window.matchMedia('(min-width: 60rem)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeId: string | null = null;

  const recordOf = (id: string): HTMLElement | null => document.getElementById(`c-${id}`);
  const idOf = (record: Element): string => record.id.replace(/^c-/, '');

  /** Marks one feed record (or none) as the chosen one. */
  const mark = (id: string | null) => {
    activeId = id;
    for (const item of feed.children) {
      const record = item.querySelector('article.ecard');
      if (record && id !== null && idOf(record) === id) item.setAttribute('data-active', '');
      else item.removeAttribute('data-active');
    }
  };

  const scrollToRecord = (id: string) => {
    const record = recordOf(id);
    if (!record || record.closest('li')?.hidden) return;
    record.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  };

  const setPane = (pane: 'feed' | 'map') => {
    page.dataset.pane = pane;
    for (const b of paneButtons) b.setAttribute('aria-pressed', String(b.dataset.paneBtn === pane));
    // Coming back to the feed: show the record that was chosen on the map meanwhile.
    if (pane === 'feed' && activeId) scrollToRecord(activeId);
  };
  for (const b of paneButtons) b.addEventListener('click', () => setPane(b.dataset.paneBtn === 'map' ? 'map' : 'feed'));

  // map -> feed
  mapRoot.addEventListener('map:select', (e) => {
    const id = (e as CustomEvent<{ id: string | null }>).detail?.id ?? null;
    mark(id);
    // On a phone the feed is hidden while the map is shown; it scrolls when the reader switches back.
    if (id && wide.matches) scrollToRecord(id);
  });

  // feed -> map (a click or the keyboard reaching a record)
  const chooseRecord = (target: EventTarget | null) => {
    const record = target instanceof Element ? target.closest('article.ecard') : null;
    if (!record) return;
    const id = idOf(record);
    if (id === activeId) return;
    mark(id);
    document.dispatchEvent(new CustomEvent('map:focus', { detail: { id } }));
  };
  feed.addEventListener('click', (e) => chooseRecord(e.target));
  feed.addEventListener('focusin', (e) => chooseRecord(e.target));

  // A link with #c-<id> opens that card; its marker is chosen as soon as the map is ready.
  mapRoot.addEventListener('map:ready', () => {
    const fromHash = location.hash.match(/^#c-(.+)$/);
    const id = fromHash ? decodeURIComponent(fromHash[1]!) : activeId;
    if (id && recordOf(id)) {
      mark(id);
      document.dispatchEvent(new CustomEvent('map:focus', { detail: { id } }));
    }
  });

  // No map (tiles did not load): the feed is all there is.
  document.addEventListener('map:unavailable', () => {
    page.dataset.map = 'unavailable';
    aside.hidden = true;
    for (const el of document.querySelectorAll<HTMLElement>('.panes')) el.hidden = true;
    setPane('feed');
  });
}
