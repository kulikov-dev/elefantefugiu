// The map itself (Leaflet). Loaded only on pages with a map, and only when the block is in view.
// Which markers are drawn is decided by src/lib/markers.ts (no marker-cluster plugin).
import { pickPlural } from '../lib/plural-pick';
import * as L from 'leaflet';
// ?url: the file is emitted but NOT linked into pages; it is added below, only when the map starts.
import leafletCss from 'leaflet/dist/leaflet.css?url';
import { parseMapState, passesFilters, serializeMapState, type MapState } from '../lib/map-data';
import { directionsHref } from '../lib/directions';
import { distanceParts } from '../lib/distance';
import { distanceKm } from '../lib/events';
import { isVisibleInMode } from '../lib/family';
import { boundsAround, inBounds, selectMarkers, type Bounds, type MapCard } from '../lib/markers';
import { currentFamilyMode, onFamilyChange } from './family-mode';

interface CardInfo extends MapCard {
  bridgeName: string;
  bridgeAddress: string;
  minAge: string;
  sensitive: boolean;
  title: string;
  meta: string;
  hook: string;
  href: string;
  /** Where the story happened, when outside Portugal (marked in the "whole world" view). */
  overseas?: { lat: number; lon: number; name: string };
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
  /** BCP 47 tag for plural rules (Russian counts with four forms). */
  pluralLocale: string;
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
  /** "Near me": the zoom the map goes to, how long to wait for a position, how old a remembered position may be. */
  locateZoom: 13,
  locateTimeoutMs: 12000,
  locateMaxAgeMs: 60000,
  /** "Whole world": the lowest zoom and how long a message stays. */
  worldMinZoom: 2,
  worldMaxZoom: 5,
  messageMs: 9000,
};

/** Icons of the map tools (a 24 px grid, stroke drawn with currentColor). */
const ICONS = {
  locate: '<circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  home: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/>',
  world: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="2"/>',
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
  const overseasButton = $<HTMLButtonElement>('[data-overseas]');
  const message = $('[data-map-message]');
  const legendHere = document.querySelector<HTMLElement>('[data-legend-here]');
  const sheetToggle = $<HTMLButtonElement>('[data-sheet-toggle]');
  const sheet = $('[data-map-list]');
  const status = $('[data-map-status]');
  const pageMode = cfg.mode === 'page';
  const byId = new Map(cfg.cards.map((c) => [c.id, c]));
  // Family mode: cards the mode hides take no part in anything below (markers, the marker limit, "In this area", filters).
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
  /** "Whole world" view: the map may show everything, the places of stories abroad are marked. */
  let world = false;
  /** The reader's position after "Near me". Kept in memory only: never sent anywhere, never stored. */
  let me: { lat: number; lon: number } | null = null;
  let meMarker: L.Marker | null = null;
  let messageTimer: number | undefined;
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
      html: `<span class="mk__shape" aria-hidden="true">${text ? `<span class="mk__num">${text}</span>` : ''}</span><span class="mk__caption" aria-hidden="true"></span><span class="visually-hidden"></span>`,
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
        const label = fill(pickPlural(cfg.strings, 'cluster', cl.count, cfg.pluralLocale), cl.count);
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
        const el = marker.getElement();
        const selected = key === state.id;
        el?.classList.toggle('mk--selected', selected);
        // The bridge's name is written next to the selected marker only (clusters have none).
        const caption = el?.querySelector('.mk__caption');
        if (caption) caption.textContent = selected ? (byId.get(key)?.bridgeName ?? '') : '';
      }
    }
    // A removed marker would drop keyboard focus to the page; keep it on the map instead.
    if (focusedKey && !layers.has(focusedKey)) canvas.focus();

    drawPlaces();
    updateOverseas();
    // The list and its announcement belong to the map page; on an epoch page the feed is the list.
    if (pageMode) {
      renderList(result.inArea);
      announce(result.inArea.length);
    }
    moreButton.hidden = !result.canShowMore;
    if (!result.canShowMore && document.activeElement === moreButton) (pageMode ? listTitle : canvas).focus();
  };

  // ---- list "In this area" -----------------------------------------------------------------------------------

  const numberFormat = new Intl.NumberFormat(cfg.pluralLocale, { maximumFractionDigits: 1 });
  /** "in 350 m", "in 2.1 km" (src/lib/distance.ts decides what is said; the phrases come from the strings of the page). */
  const distanceText = (km: number): string => {
    const d = distanceParts(km);
    if (d.kind === 'here') return cfg.strings.dist_here!;
    return (d.kind === 'm' ? cfg.strings.dist_m! : cfg.strings.dist_km!).replace('{n}', numberFormat.format(d.n));
  };
  const kmFromMe = (id: string): number => {
    const c = byId.get(id)!;
    return me ? distanceKm(me, c) : 0;
  };

  const renderList = (areaIds: string[]) => {
    // After "Near me" the list is ordered by distance from the reader, nearest first.
    const ids = me ? [...areaIds].sort((a, b) => kmFromMe(a) - kmFromMe(b)) : areaIds;
    const key = ids.join('|') + '#' + (state.id ?? '') + (me ? `@${me.lat},${me.lon}` : '');
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
        const hook = document.createElement('span');
        hook.className = 'map__item-hook';
        hook.textContent = card.hook;
        const meta = document.createElement('span');
        meta.className = 'map__item-meta';
        meta.textContent = me ? `${card.meta} · ${distanceText(kmFromMe(id))}` : card.meta;
        a.append(title, hook, meta);
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
      status.textContent = fill(pickPlural(cfg.strings, 'in_area', n, cfg.pluralLocale), n);
    }, BEHAVIOUR.statusDelayMs);
  };

  // ---- preview -----------------------------------------------------------------------------------------------

  const openPreview = (card: CardInfo, moveFocus: boolean) => {
    $('[data-preview-bridge-name]').textContent = card.bridgeName;
    $('[data-preview-bridge-address]').textContent = card.bridgeAddress;
    $('[data-preview-title]').textContent = card.title;
    $('[data-preview-hook]').textContent = card.hook;
    $<HTMLAnchorElement>('[data-preview-open]').href = card.href;
    // "How to get there": OpenStreetMap for everyone, a geo: link on Android only (src/lib/directions.ts).
    $<HTMLAnchorElement>('[data-preview-directions]').href = directionsHref(card.lat, card.lon, card.bridgeName, navigator.userAgent);
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

  // ---- places abroad, the "whole world" view ---------------------------------------------------------------------

  const placeLayers = new Map<string, L.Marker>();
  const overseasCards = () => cards.filter((c) => c.overseas && passesFilters(c, state));

  /** The place where a story happened, for a story abroad: a hollow diamond, only in the "whole world" view. */
  const drawPlaces = () => {
    const wanted = new Set(world ? overseasCards().map((c) => c.id) : []);
    for (const [id, marker] of placeLayers) {
      if (!wanted.has(id)) {
        marker.remove();
        placeLayers.delete(id);
      }
    }
    for (const id of wanted) {
      if (placeLayers.has(id)) continue;
      const card = byId.get(id)!;
      const o = card.overseas!;
      const marker = L.marker([o.lat, o.lon], { icon: makeIcon('mk--place', ''), keyboard: true, title: '' });
      marker.on('click', () => select(id, true));
      marker.addTo(map);
      const el = marker.getElement()!;
      el.querySelector('.visually-hidden')!.textContent = `${card.title}, ${o.name}`;
      el.querySelector('.mk__caption')!.textContent = o.name;
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select(id, true);
        }
      });
      placeLayers.set(id, marker);
    }
  };

  /** The plate at the edge of the map: how many stories of the current filter lie abroad. Only in the Portugal view. */
  const updateOverseas = () => {
    const n = world ? 0 : overseasCards().length;
    overseasButton.hidden = n === 0;
    if (n > 0) overseasButton.textContent = fill(pickPlural(cfg.strings, 'overseas', n, cfg.pluralLocale), n);
  };

  const worldBounds = (): L.LatLngBounds => {
    const points = overseasCards().map((c) => [c.overseas!.lat, c.overseas!.lon] as L.LatLngTuple);
    const box = toLatLngBounds(cfg.home);
    return points.length > 0 ? box.extend(L.latLngBounds(points)) : L.latLngBounds([-55, -170], [75, 170]);
  };

  const setWorld = (on: boolean) => {
    world = on;
    more = 0;
    if (on) {
      map.setMaxBounds(L.latLngBounds([-85, -180], [85, 180]));
      map.setMinZoom(BEHAVIOUR.worldMinZoom);
      map.fitBounds(worldBounds(), { padding: [BEHAVIOUR.fitPadding, BEHAVIOUR.fitPadding], maxZoom: BEHAVIOUR.worldMaxZoom, animate });
    } else {
      map.setMaxBounds(maxBounds);
      setMinZoom();
      map.fitBounds(toLatLngBounds(cfg.home), { animate });
    }
    refreshMarkers();
  };

  overseasButton.addEventListener('click', () => setWorld(true));

  // ---- "Near me" -------------------------------------------------------------------------------------------------

  const say = (text: string) => {
    window.clearTimeout(messageTimer);
    message.textContent = text;
    message.hidden = text === '';
    if (text) messageTimer = window.setTimeout(() => say(''), BEHAVIOUR.messageMs);
  };

  const setMe = (pos: { lat: number; lon: number } | null) => {
    me = pos;
    meMarker?.remove();
    meMarker = null;
    if (legendHere) legendHere.hidden = !pos;
    if (pos && inBounds(pos, fromLatLngBounds(maxBounds_()))) {
      meMarker = L.marker([pos.lat, pos.lon], {
        icon: L.divIcon({ className: 'mk mk--me', iconSize: null as unknown as L.PointExpression, html: `<span class="mk__shape" aria-hidden="true"></span><span class="visually-hidden">${cfg.strings.here}</span>` }),
        keyboard: false,
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(map);
    }
    lastListKey = '';
  };
  const maxBounds_ = () => (world ? L.latLngBounds([-85, -180], [85, 180]) : maxBounds);

  /** Asks the browser for the position once. Nothing is sent or stored: the position lives in this page only. */
  const locate = (button: HTMLElement) => {
    if (me) {
      // A second press switches it off: the list goes back to the order of the map.
      setMe(null);
      button.setAttribute('aria-pressed', 'false');
      say('');
      refreshMarkers();
      return;
    }
    if (!('geolocation' in navigator)) {
      say(cfg.strings.geo_unsupported!);
      return;
    }
    say(cfg.strings.locating!);
    button.setAttribute('aria-busy', 'true');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        button.removeAttribute('aria-busy');
        const pos = { lat: position.coords.latitude, lon: position.coords.longitude };
        const near = inBounds(pos, fromLatLngBounds(maxBounds));
        setMe(pos);
        button.setAttribute('aria-pressed', 'true');
        if (near) {
          if (world) setWorld(false);
          map.setView([pos.lat, pos.lon], BEHAVIOUR.locateZoom, { animate });
          say('');
        } else say(cfg.strings.geo_far!);
        refreshMarkers();
      },
      (error) => {
        button.removeAttribute('aria-busy');
        say(error.code === 1 ? cfg.strings.geo_denied! : cfg.strings.geo_unavailable!);
      },
      { enableHighAccuracy: false, timeout: BEHAVIOUR.locateTimeoutMs, maximumAge: BEHAVIOUR.locateMaxAgeMs },
    );
  };

  // ---- the tools under the zoom buttons ---------------------------------------------------------------------------

  const toolButton = (icon: keyof typeof ICONS, title: string, onClick: (button: HTMLAnchorElement) => void, pressed = false): HTMLAnchorElement => {
    const a = L.DomUtil.create('a', 'map__tool') as HTMLAnchorElement;
    a.href = '#';
    a.title = title;
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', title);
    if (pressed) a.setAttribute('aria-pressed', 'false');
    a.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">${ICONS[icon]}</svg>`;
    L.DomEvent.on(a, 'click', (e) => {
      L.DomEvent.preventDefault(e);
      L.DomEvent.stopPropagation(e);
      onClick(a);
    });
    // Space also presses a button (a link answers Enter only).
    a.addEventListener('keydown', (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        onClick(a);
      }
    });
    return a;
  };

  const Tools = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const bar = L.DomUtil.create('div', 'leaflet-bar leaflet-control map__tools');
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', cfg.strings.tools_label!);
      L.DomEvent.disableClickPropagation(bar);
      if (pageMode) bar.append(toolButton('locate', cfg.strings.locate!, locate, true));
      bar.append(
        toolButton('home', cfg.strings.home!, () => {
          if (world) setWorld(false);
          else {
            more = 0;
            map.fitBounds(toLatLngBounds(cfg.home), { animate });
          }
        }),
        toolButton('world', cfg.strings.world!, () => setWorld(true)),
      );
      return bar;
    },
  });
  new Tools().addTo(map);

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
  const epocaChips = [...document.querySelectorAll<HTMLButtonElement>('button[data-epoca]')];
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

  const setMinZoom = () => map.setMinZoom(world ? BEHAVIOUR.worldMinZoom : map.getBoundsZoom(maxBounds, false));

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
    root.removeAttribute('aria-busy');
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
