// The map itself (Leaflet). Loaded only on pages with a map, and only when the block is in view.
// Which markers are drawn is decided by src/lib/markers.ts (no marker-cluster plugin).
import * as L from 'leaflet';
// ?url: the file is emitted but NOT linked into pages; it is added below, only when the map starts.
import leafletCss from 'leaflet/dist/leaflet.css?url';
import { parseMapState, passesFilters, serializeMapState, type MapState } from '../lib/map-data';
import { isVisibleInMode } from '../lib/family';
import { boundsAround, inBounds, selectMarkers, type Bounds, type MapCard } from '../lib/markers';
import { currentFamilyMode, onFamilyChange } from './family-mode';

interface CardInfo extends MapCard {
  minAge: string;
  sensitive: boolean;
  title: string;
  meta: string;
  hook: string;
  href: string;
}

interface Config {
  mode: 'page' | 'embedded';
  cards: CardInfo[];
  threads: Record<string, { name: string; color: string }>;
  known: { threads: string[]; epochs: string[] };
  maxBounds: Bounds;
  view: Bounds;
  home: Bounds;
  tile: { url: string; attribution: string };
  strings: Record<string, string>;
}

/** Behaviour of the map (not styling; sizes and colours live in tokens.css and map.css). */
const BEHAVIOUR = {
  maxZoom: 18,
  /** Zoom for a single card from an "Open on the map" link. */
  cardZoom: 14,
  /** Zoom limit and padding in pixels when fitting the map to the cards of a filter. */
  fitMaxZoom: 12,
  fitPadding: 40,
  /** Give up on tiles after this long without a single tile. */
  tileTimeoutMs: 8000,
  /** Failed tiles before any loaded one that count as "no tiles". */
  tileErrorsBeforeGivingUp: 4,
  statusDelayMs: 400,
};

const toLatLngBounds = (b: Bounds) => L.latLngBounds([b.south, b.west], [b.north, b.east]);
const fromLatLngBounds = (b: L.LatLngBounds): Bounds => ({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
const fill = (template: string, n: number) => template.replace('{n}', String(n));

function loadLeafletCss(): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector('link[data-leaflet-css]')) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = leafletCss;
    link.dataset.leafletCss = '';
    link.addEventListener('load', () => resolve());
    link.addEventListener('error', () => resolve()); // the map still works without its own styles, only ugly
    document.head.append(link);
  });
}

export async function mount(root: HTMLElement, onUnavailable: () => void): Promise<void> {
  await loadLeafletCss();
  const cfg: Config = JSON.parse(root.querySelector('[data-map-config]')!.textContent!);
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const canvas = $('[data-map-canvas]');
  const preview = $('[data-map-preview]');
  const listItems = $('[data-list-items]');
  const listEmpty = $('[data-list-empty]');
  const listCount = $('[data-list-count]');
  const listTitle = $('[data-map-list] h2');
  const moreButton = $<HTMLButtonElement>('[data-more]');
  const homeButton = $<HTMLButtonElement>('[data-map-home]');
  const sheetToggle = $<HTMLButtonElement>('[data-sheet-toggle]');
  const sheet = $('[data-map-list]');
  const status = $('[data-map-status]');
  const pageMode = cfg.mode === 'page';
  const byId = new Map(cfg.cards.map((c) => [c.id, c]));
  // Family mode: cards the mode hides take no part in anything below (markers, the limit of 7, "In this area", filters).
  // The list is recomputed when the mode changes.
  let cards = cfg.cards.filter((c) => isVisibleInMode(c, currentFamilyMode()));

  // Map page: the address holds thread, epoch and card. Embedded (epoch page): only the thread, written by the page's own filter.
  const embeddedSearch = new URLSearchParams(location.search);
  embeddedSearch.delete('id');
  embeddedSearch.delete('epoca');
  let state: MapState = pageMode
    ? parseMapState(location.search, { ...cfg.known, cards })
    : parseMapState(`?${embeddedSearch}`, { ...cfg.known, cards });
  let more = 0;
  let lastAreaKey = '';
  let lastListKey = '';
  let failed = false;
  let statusTimer: number | undefined;

  // ---- map and tiles ----------------------------------------------------------------------------------------

  const maxBounds = toLatLngBounds(cfg.maxBounds);
  // Readers who ask for less motion get no zoom, fade or marker animations.
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = L.map(canvas, {
    zoomControl: false,
    maxBounds,
    maxBoundsViscosity: 1,
    maxZoom: BEHAVIOUR.maxZoom,
    zoomSnap: 1,
    zoomAnimation: animate,
    fadeAnimation: animate,
    markerZoomAnimation: animate,
  });
  L.control.zoom({ zoomInTitle: cfg.strings.zoom_in, zoomOutTitle: cfg.strings.zoom_out }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

  const tiles = L.tileLayer(cfg.tile.url, { attribution: cfg.tile.attribution, maxZoom: BEHAVIOUR.maxZoom });
  let tilesLoaded = 0;
  let tilesFailed = 0;
  const giveUp = () => {
    if (failed || tilesLoaded > 0) return;
    failed = true;
    map.remove();
    onUnavailable();
  };
  tiles.on('tileload', () => {
    tilesLoaded += 1;
  });
  tiles.on('tileerror', () => {
    tilesFailed += 1;
    if (tilesLoaded === 0 && tilesFailed >= BEHAVIOUR.tileErrorsBeforeGivingUp) giveUp();
  });
  window.setTimeout(giveUp, BEHAVIOUR.tileTimeoutMs);
  tiles.addTo(map);

  // ---- markers -----------------------------------------------------------------------------------------------

  const layers = new Map<string, L.Marker>();

  const makeIcon = (cls: string, text = '') =>
    L.divIcon({
      className: `mk ${cls}`,
      iconSize: null as unknown as L.PointExpression,
      html: `<span class="mk__shape" aria-hidden="true">${text}</span><span class="visually-hidden"></span>`,
    });

  const addLayer = (key: string, lat: number, lon: number, cls: string, label: string, text: string, onActivate: () => void) => {
    const marker = L.marker([lat, lon], { icon: makeIcon(cls, text), keyboard: true, title: '' });
    marker.on('click', onActivate);
    marker.addTo(map);
    const el = marker.getElement()!;
    el.querySelector('.visually-hidden')!.textContent = label;
    el.dataset.key = key;
    // Leaflet turns Enter into a click only for popups; markers also answer Enter and Space (role="button").
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    });
    layers.set(key, marker);
  };

  const refreshMarkers = () => {
    if (failed) return;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    const c = map.getCenter();
    const result = selectMarkers({
      cards,
      bounds: fromLatLngBounds(map.getBounds()),
      center: { lat: c.lat, lon: c.lng },
      activeThread: state.fio,
      activeEpoch: state.epoca,
      more,
      pinned: state.id,
    });

    const wanted = new Set<string>();
    for (const m of result.markers) {
      wanted.add(m.id);
      if (!layers.has(m.id)) {
        const card = byId.get(m.id)!;
        const kind = m.kind === 'frame' ? cfg.strings.frame : cfg.strings.story;
        addLayer(m.id, m.lat, m.lon, `mk--${m.kind}`, `${card.title}, ${kind}`, '', () => select(m.id, true));
      }
    }
    for (const cl of result.clusters) {
      wanted.add(cl.id);
      if (!layers.has(cl.id)) {
        const label = fill(cl.count === 1 ? cfg.strings.cluster_one : cfg.strings.cluster_other, cl.count);
        addLayer(cl.id, cl.lat, cl.lon, 'mk--cluster', label, String(cl.count), () => openCluster(cl.ids));
      }
    }

    const hadFocus = root.contains(document.activeElement) && document.activeElement?.classList.contains('mk');
    const focusedKey = hadFocus ? (document.activeElement as HTMLElement).dataset.key : undefined;
    for (const [key, marker] of layers) {
      if (!wanted.has(key)) {
        marker.remove();
        layers.delete(key);
      } else {
        marker.getElement()?.classList.toggle('mk--selected', key === state.id);
      }
    }
    // A removed marker would drop keyboard focus to the page; keep it on the map instead.
    if (focusedKey && !layers.has(focusedKey)) canvas.focus();

    // The list and its announcement belong to the map page; on an epoch page the feed is the list.
    if (pageMode) {
      renderList(result.inArea);
      announce(result.inArea.length);
    }
    moreButton.hidden = !result.canShowMore;
    if (!result.canShowMore && document.activeElement === moreButton) (pageMode ? listTitle : canvas).focus();
  };

  // ---- list "In this area" -----------------------------------------------------------------------------------

  const renderList = (ids: string[]) => {
    const key = ids.join('|') + '#' + (state.id ?? '');
    if (key === lastListKey) return;
    lastListKey = key;
    listItems.replaceChildren(
      ...ids.map((id) => {
        const card = byId.get(id)!;
        const li = document.createElement('li');
        li.className = `map__item map__item--${card.importance === 3 ? 'frame' : 'story'}`;
        li.dataset.id = id;
        li.classList.toggle('map__item--selected', id === state.id);
        const mark = document.createElement('span');
        mark.className = 'map__item-mark';
        mark.setAttribute('aria-hidden', 'true');
        const a = document.createElement('a');
        a.href = card.href;
        const title = document.createElement('span');
        title.className = 'map__item-title';
        title.textContent = card.title;
        const meta = document.createElement('span');
        meta.className = 'map__item-meta';
        meta.textContent = card.meta;
        a.append(title, meta);
        li.append(mark, a);
        return li;
      }),
    );
    listEmpty.hidden = ids.length > 0;
    listCount.textContent = String(ids.length);
  };

  const announce = (n: number) => {
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = fill(n === 1 ? cfg.strings.in_area_one : cfg.strings.in_area_other, n);
    }, BEHAVIOUR.statusDelayMs);
  };

  // ---- preview -----------------------------------------------------------------------------------------------

  const openPreview = (card: CardInfo, moveFocus: boolean) => {
    $('[data-preview-meta]').textContent = card.meta;
    $('[data-preview-title]').textContent = card.title;
    $('[data-preview-hook]').textContent = card.hook;
    $<HTMLAnchorElement>('[data-preview-open]').href = card.href;
    const threadList = $('[data-preview-threads]');
    threadList.replaceChildren(
      ...card.threads
        .filter((id) => cfg.threads[id])
        .map((id) => {
          const li = document.createElement('li');
          li.className = 'map__thread';
          li.style.setProperty('--thread-color', cfg.threads[id]!.color);
          li.textContent = cfg.threads[id]!.name;
          return li;
        }),
    );
    preview.hidden = false;
    // Phone: make room, the sheet would cover the preview.
    root.dataset.sheet = 'closed';
    sheetToggle.setAttribute('aria-expanded', 'false');
    sheetToggle.textContent = cfg.strings.list_open;
    if (moveFocus) preview.focus();
  };

  function select(id: string | null, fromUser: boolean) {
    state = { ...state, id };
    if (id) openPreview(byId.get(id)!, fromUser);
    else preview.hidden = true;
    writeUrl();
    lastListKey = '';
    refreshMarkers();
    root.dispatchEvent(new CustomEvent('map:select', { bubbles: true, detail: { id } }));
  }

  const closePreview = () => {
    const id = state.id;
    select(null, false);
    const marker = id ? layers.get(id)?.getElement() : undefined;
    (marker ?? canvas).focus();
  };
  $('[data-preview-close]').addEventListener('click', closePreview);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !preview.hidden) closePreview();
  });

  // ---- clusters, show more, sheet ---------------------------------------------------------------------------

  function openCluster(ids: string[]) {
    const members = ids.map((id) => byId.get(id)!);
    const box = L.latLngBounds(members.map((m) => [m.lat, m.lon] as L.LatLngTuple));
    const padding = L.point(BEHAVIOUR.fitPadding, BEHAVIOUR.fitPadding);
    const target = Math.min(map.getBoundsZoom(box, false, padding), BEHAVIOUR.maxZoom);
    if (target <= map.getZoom()) {
      // Zooming cannot separate them (same spot, or already at the closest zoom): show the next portion instead.
      more += 1;
      refreshMarkers();
    } else {
      map.fitBounds(box, { padding: [BEHAVIOUR.fitPadding, BEHAVIOUR.fitPadding], maxZoom: BEHAVIOUR.maxZoom });
    }
  }

  moreButton.addEventListener('click', () => {
    more += 1;
    refreshMarkers();
  });

  // "All of Portugal": resets the view only; filters and the open preview stay as they are.
  homeButton.addEventListener('click', () => {
    more = 0;
    map.fitBounds(toLatLngBounds(cfg.home), { animate });
  });

  sheetToggle.addEventListener('click', () => {
    const open = root.dataset.sheet !== 'open';
    root.dataset.sheet = open ? 'open' : 'closed';
    sheetToggle.setAttribute('aria-expanded', String(open));
    sheetToggle.textContent = open ? cfg.strings.list_close : cfg.strings.list_open;
  });

  // ---- address and history ------------------------------------------------------------------------------------

  function writeUrl(extra: Record<string, unknown> = {}) {
    if (!pageMode) return;
    try {
      history.replaceState({ ...(history.state ?? {}), ...extra }, '', location.pathname + serializeMapState(state) + location.hash);
    } catch {
      // Some contexts forbid it; the map still works.
    }
  }

  const saveView = () => {
    const c = map.getCenter();
    writeUrl({ mapView: { lat: c.lat, lon: c.lng, zoom: map.getZoom() } });
  };

  // ---- filters -------------------------------------------------------------------------------------------------

  const fitToFilter = () => {
    const list = cards.filter((c) => passesFilters(c, state));
    if (list.length === 0) map.fitBounds(toLatLngBounds(cfg.view), { animate: false });
    else if (list.length === 1) map.setView([list[0]!.lat, list[0]!.lon], BEHAVIOUR.fitMaxZoom);
    else
      map.fitBounds(L.latLngBounds(list.map((c) => [c.lat, c.lon] as L.LatLngTuple)), {
        padding: [BEHAVIOUR.fitPadding, BEHAVIOUR.fitPadding],
        maxZoom: BEHAVIOUR.fitMaxZoom,
      });
  };

  const applyFilter = (next: Partial<Pick<MapState, 'fio' | 'epoca'>>) => {
    state = { ...state, ...next };
    if (state.id && !passesFilters(byId.get(state.id)!, state)) {
      state.id = null;
      preview.hidden = true;
    }
    more = 0;
    lastListKey = '';
    syncChips();
    writeUrl();
    fitToFilter();
    refreshMarkers();
  };

  const fioChips = [...document.querySelectorAll<HTMLButtonElement>('[data-map-filters] button[data-fio], .map-filters button[data-fio]')];
  const epocaChips = [...document.querySelectorAll<HTMLButtonElement>('.map-filters button[data-epoca]')];
  function syncChips() {
    for (const b of fioChips) b.setAttribute('aria-pressed', String((b.dataset.fio || null) === state.fio));
    for (const b of epocaChips) b.setAttribute('aria-pressed', String((b.dataset.epoca || null) === state.epoca));
  }
  for (const b of fioChips) b.addEventListener('click', () => applyFilter({ fio: b.dataset.fio && b.dataset.fio !== state.fio ? b.dataset.fio : null }));
  for (const b of epocaChips) b.addEventListener('click', () => applyFilter({ epoca: b.dataset.epoca && b.dataset.epoca !== state.epoca ? b.dataset.epoca : null }));

  // A parent page (the epoch page) can drive the filter and the selection with events.
  document.addEventListener('map:filter', (e) => {
    const detail = (e as CustomEvent<{ fio?: string | null; epoca?: string | null }>).detail ?? {};
    applyFilter({ fio: detail.fio ?? null, epoca: detail.epoca ?? state.epoca });
  });
  document.addEventListener('map:focus', (e) => {
    const id = (e as CustomEvent<{ id: string | null }>).detail?.id ?? null;
    state = { ...state, id };
    if (id && cards.some((c) => c.id === id)) {
      const card = byId.get(id)!;
      if (!inBounds(card, fromLatLngBounds(map.getBounds()))) map.panTo([card.lat, card.lon]);
      // Map page: the preview opens. Epoch page: the marker is only highlighted, the feed already shows the card.
      if (pageMode) openPreview(card, false);
      else preview.hidden = true;
    } else preview.hidden = true;
    lastListKey = '';
    refreshMarkers();
  });

  // The reader changed the family mode: the map keeps its view and filters, but the set of cards changes.
  onFamilyChange((mode) => {
    cards = cfg.cards.filter((c) => isVisibleInMode(c, mode));
    more = 0;
    lastListKey = '';
    if (state.id && !cards.some((c) => c.id === state.id)) {
      // The open card is now hidden: close its preview.
      state = { ...state, id: null };
      preview.hidden = true;
      writeUrl();
      root.dispatchEvent(new CustomEvent('map:select', { bubbles: true, detail: { id: null } }));
    }
    refreshMarkers();
  });

  // Phone: tell the CSS how tall the sheet is, so the attribution stays visible above it, closed or open.
  new ResizeObserver(() => root.style.setProperty('--map-sheet-height', `${sheet.offsetHeight}px`)).observe(sheet);

  // ---- start ----------------------------------------------------------------------------------------------------

  const setMinZoom = () => map.setMinZoom(map.getBoundsZoom(maxBounds, false));

  const firstView = () => {
    setMinZoom();
    const saved = (history.state as { mapView?: { lat: number; lon: number; zoom: number } } | null)?.mapView;
    const target = state.id ? byId.get(state.id) : undefined;
    if (pageMode && saved) map.setView([saved.lat, saved.lon], saved.zoom, { animate: false });
    else if (target) map.setView([target.lat, target.lon], BEHAVIOUR.cardZoom, { animate: false });
    else if (state.fio || state.epoca) fitToFilter();
    else map.fitBounds(toLatLngBounds(cfg.view), { animate: false });
    if (target) openPreview(target, false);
    syncChips();
    root.dataset.state = 'ready';
    refreshMarkers();
    // The page around the map (epoch page) can now send it a selection.
    root.dispatchEvent(new CustomEvent('map:ready', { bubbles: true }));
  };

  map.on('moveend', () => {
    const key = JSON.stringify(fromLatLngBounds(map.getBounds()));
    if (key !== lastAreaKey) {
      lastAreaKey = key;
      more = 0; // "Show more" is for the area it was pressed in
    }
    refreshMarkers();
    if (pageMode) saveView();
  });

  // The canvas may have no size yet (an inactive tab): start when it first gets one, keep it right on resize.
  let started = false;
  const observer = new ResizeObserver(() => {
    if (failed || canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
    map.invalidateSize();
    if (!started) {
      started = true;
      firstView();
    } else setMinZoom();
  });
  observer.observe(canvas);
}

export { boundsAround };
