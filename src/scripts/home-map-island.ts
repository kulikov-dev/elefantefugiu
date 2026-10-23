// The small map of the home page (Leaflet): every story as a dot, the zoom buttons, nothing else. A dot leads to its story.
// The wheel does not zoom (the page keeps scrolling) and a finger does not drag it (a phone must be able to scroll past it);
// the buttons and a double tap / click zoom. Family mode hides the dots of stories the mode hides.
import * as L from 'leaflet';
// ?url: the file is emitted but NOT linked into pages; it is added below, only when the map starts.
import leafletCss from 'leaflet/dist/leaflet.css?url';
import { isVisibleInMode } from '../lib/family';
import type { Bounds } from '../lib/markers';
import { currentFamilyMode, onFamilyChange } from './family-mode';

interface Card {
  id: string;
  lat: number;
  lon: number;
  title: string;
  href: string;
  minAge: string;
  sensitive: boolean;
}

interface Config {
  cards: Card[];
  maxBounds: Bounds;
  home: Bounds;
  tile: { url: string; attribution: string };
  strings: { zoom_in: string; zoom_out: string };
}

const BEHAVIOUR = { maxZoom: 14, fitMaxZoom: 9, fitPadding: 28, dotRadius: 9, tileErrorsBeforeGivingUp: 4, tileTimeoutMs: 8000 };

function loadLeafletCss(): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector('link[data-leaflet-css]')) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = leafletCss;
    link.dataset.leafletCss = '';
    link.addEventListener('load', () => resolve());
    link.addEventListener('error', () => resolve());
    document.head.append(link);
  });
}

export async function mount(root: HTMLElement): Promise<void> {
  await loadLeafletCss();
  const cfg: Config = JSON.parse(root.querySelector('[data-home-map-config]')!.textContent!);
  const canvas = root.querySelector<HTMLElement>('[data-home-map-canvas]')!;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = (b: Bounds) => L.latLngBounds([b.south, b.west], [b.north, b.east]);

  const map = L.map(canvas, {
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: !touch,
    maxBounds: box(cfg.maxBounds),
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
  let loaded = 0;
  let failed = 0;
  let gaveUp = false;
  const giveUp = () => {
    if (gaveUp || loaded > 0) return;
    gaveUp = true;
    map.remove();
    root.dataset.state = 'unavailable';
  };
  tiles.on('tileload', () => {
    loaded += 1;
  });
  tiles.on('tileerror', () => {
    failed += 1;
    if (loaded === 0 && failed >= BEHAVIOUR.tileErrorsBeforeGivingUp) giveUp();
  });
  window.setTimeout(giveUp, BEHAVIOUR.tileTimeoutMs);
  tiles.addTo(map);

  const dots = L.layerGroup().addTo(map);
  const draw = (fit: boolean) => {
    dots.clearLayers();
    const shown = cfg.cards.filter((c) => isVisibleInMode(c, currentFamilyMode()));
    for (const card of shown) {
      L.circleMarker([card.lat, card.lon], { radius: BEHAVIOUR.dotRadius, className: 'home-map__dot' })
        .bindTooltip(card.title)
        .on('click', () => location.assign(card.href))
        .addTo(dots);
    }
    if (fit) {
      const points = (shown.length > 0 ? shown : cfg.cards).map((c) => [c.lat, c.lon] as [number, number]);
      map.fitBounds(L.latLngBounds(points), { padding: [BEHAVIOUR.fitPadding, BEHAVIOUR.fitPadding], maxZoom: BEHAVIOUR.fitMaxZoom, animate: false });
    }
  };
  draw(true);
  onFamilyChange(() => draw(false));
  root.dataset.state = 'ready';
}
