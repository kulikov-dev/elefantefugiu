// Map geometry and address state. Pure functions, no Leaflet, no Astro.
import type { Bounds } from './markers';

/** Initial view: the whole mainland. */
export const MAINLAND_VIEW: Bounds = { south: 36.8, west: -9.7, north: 42.3, east: -6.0 };

/** The first view of the small map on the home page: the mainland, by its borders (not by the points of the stories). */
export const HOME_MAP_VIEW: Bounds = { south: 36.9, west: -9.6, north: 42.2, east: -6.2 };

/** Where Portuguese places can be (same areas as check:data). Used to keep every card inside the allowed map area. */
const REGIONS: Bounds[] = [
  { south: 36.8, north: 42.2, west: -9.6, east: -6.1 }, // mainland
  { south: 32.3, north: 33.2, west: -17.4, east: -16.2 }, // Madeira
  { south: 36.8, north: 39.9, west: -31.4, east: -24.9 }, // Azores
];

/** Is this point in Portugal (the mainland, Madeira or the Azores)? A story whose place is not is "overseas" for the map. */
export const isInPortugal = (lat: number, lon: number): boolean => REGIONS.some((r) => lat >= r.south && lat <= r.north && lon >= r.west && lon <= r.east);

/** Extra room around the allowed area, in degrees, so the edge cards are not pinned to the border. */
export const MAX_BOUNDS_MARGIN = 1;

/**
 * The area the map may show (maxBounds): the mainland with a margin, widened to include Madeira or the Azores
 * only when a card lies there, so the map is not mostly ocean while the data has no island cards.
 */
export function mapMaxBounds(cards: readonly { lat: number; lon: number }[]): Bounds {
  const inside = (r: Bounds, c: { lat: number; lon: number }) =>
    c.lat >= r.south && c.lat <= r.north && c.lon >= r.west && c.lon <= r.east;
  const used = REGIONS.filter((r, i) => i === 0 || cards.some((c) => inside(r, c)));
  return {
    south: Math.min(...used.map((r) => r.south)) - MAX_BOUNDS_MARGIN,
    north: Math.max(...used.map((r) => r.north)) + MAX_BOUNDS_MARGIN,
    west: Math.min(...used.map((r) => r.west)) - MAX_BOUNDS_MARGIN,
    east: Math.max(...used.map((r) => r.east)) + MAX_BOUNDS_MARGIN,
  };
}

/**
 * Initial view for a map that shows only some cards (an epoch page): the box around them with some room,
 * never smaller than `minSpan` degrees so a single card or a tight group is not shown at street level.
 * Without cards it falls back to the whole mainland.
 */
export function cardsView(cards: readonly { lat: number; lon: number }[], padRatio = 0.15, minSpan = 0.5): Bounds {
  if (cards.length === 0) return MAINLAND_VIEW;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const c of cards) {
    south = Math.min(south, c.lat);
    north = Math.max(north, c.lat);
    west = Math.min(west, c.lon);
    east = Math.max(east, c.lon);
  }
  const grow = (lo: number, hi: number): [number, number] => {
    const pad = Math.max((hi - lo) * padRatio, 0);
    const span = hi - lo + 2 * pad;
    const extra = Math.max(minSpan - span, 0) / 2;
    return [lo - pad - extra, hi + pad + extra];
  };
  const [s, n] = grow(south, north);
  const [w, e] = grow(west, east);
  return { south: s, west: w, north: n, east: e };
}

/**
 * First view of the map page and of an epoch map: the box around the markers on the mainland, so the frame is centred on Portugal
 * (the box of the whole mainland, centred on the middle of it, left half the frame to Spain). The islands and places abroad do not
 * count: they have their own buttons. Without such markers the whole mainland.
 */
export function portugalView(cards: readonly { lat: number; lon: number }[]): Bounds {
  const [mainland] = REGIONS as [Bounds, ...Bounds[]];
  return cardsView(cards.filter((c) => c.lat >= mainland.south && c.lat <= mainland.north && c.lon >= mainland.west && c.lon <= mainland.east));
}

// ---- address state: ?fio=mar&epoca=avis-e-descobrimentos&id=evento-exemplo-02 ----------------------------------

export interface MapState {
  /** Thread id (same in pt and en) or null for all. */
  fio: string | null;
  /** Epoch id or null for all. */
  epoca: string | null;
  /** Card whose preview is open (and which the map centres on at load) or null. */
  id: string | null;
}

export interface MapKnown {
  threads: readonly string[];
  epochs: readonly string[];
  cards: readonly { id: string; epoch?: string; threads: readonly string[] }[];
}

/** Does a card pass the thread and epoch filters? */
export function passesFilters(card: { epoch?: string; threads: readonly string[] }, state: Pick<MapState, 'fio' | 'epoca'>): boolean {
  return (state.fio === null || card.threads.includes(state.fio)) && (state.epoca === null || card.epoch === state.epoca);
}

/**
 * Reads the state from a query string. Unknown values are ignored. A known card in `id` wins over the filters:
 * if the filters would hide it they are cleared, so a link "open on the map" always shows its card.
 */
export function parseMapState(search: string, known: MapKnown): MapState {
  const params = new URLSearchParams(search);
  const pick = (name: string, list: readonly string[]) => {
    const value = params.get(name);
    return value !== null && list.includes(value) ? value : null;
  };
  let state: MapState = { fio: pick('fio', known.threads), epoca: pick('epoca', known.epochs), id: null };
  const wanted = params.get('id');
  const card = wanted === null ? undefined : known.cards.find((c) => c.id === wanted);
  if (card) {
    if (!passesFilters(card, state)) state = { fio: null, epoca: null, id: null };
    state.id = card.id;
  }
  return state;
}

/** Query string for a state: "" for the default, otherwise "?fio=...&epoca=...&id=..." in a fixed order. */
export function serializeMapState(state: MapState): string {
  const params = new URLSearchParams();
  if (state.fio) params.set('fio', state.fio);
  if (state.epoca) params.set('epoca', state.epoca);
  if (state.id) params.set('id', state.id);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Address of the map page for a card ("Open on the map"): `base` is the map page path with trailing slash. */
export function mapLinkFor(base: string, cardId: string): string {
  return `${base}${serializeMapState({ fio: null, epoca: null, id: cardId })}`;
}
