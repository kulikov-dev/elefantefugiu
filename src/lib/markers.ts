// Which map markers are visible (docs/design.md section 4.3). Pure functions: no Leaflet, no DOM, no Astro.
//
// Rules:
// - At most `limit` things are drawn at once (default 30, DEFAULT_LIMIT), counting single markers AND clusters together.
// - Priority: the pinned card (if any), then frame cards (importance 3), then cards of the active thread (primary or second),
//   then the rest by distance to the map centre. Ties break by id, so the result is stable.
// - Cards that do not fit are grouped into clusters ("+12"), each with at least two cards.
// - "Show more" (`more` = number of presses) raises the limit by 5 per press for the current area.
//   The caller resets `more` to 0 when the visible area changes.
// - Zooming in shrinks the area, so fewer cards compete for the slots and clusters open up.

export interface MapCard {
  id: string;
  lat: number;
  lon: number;
  importance: 1 | 2 | 3;
  /** Thread ids, the first is the primary thread. */
  threads: readonly string[];
  /** Epoch id; needed only when `activeEpoch` is used. */
  epoch?: string;
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface MarkerInput {
  cards: readonly MapCard[];
  bounds: Bounds;
  center: LatLon;
  activeThread?: string | null;
  activeEpoch?: string | null;
  /** 'filter' (default): with an active thread only its cards are candidates (docs/spec.md 5.2, 5.4).
   *  'prioritize': the thread only moves its cards ahead of the others. */
  threadMode?: 'filter' | 'prioritize';
  limit?: number;
  /** How many times "Show more" was pressed for the current area. */
  more?: number;
  /** Upper bound for clusters at once; never more than half of the limit. Default 3. */
  maxClusters?: number;
  /** A card that must stay a single marker while it is in the area and passes the filters
   *  (the card whose preview is open, or the target of an "Open on the map" link). It takes one of the slots. */
  pinned?: string | null;
}

export interface SingleMarker {
  id: string;
  lat: number;
  lon: number;
  /** Frame markers are drawn larger than story marks. */
  kind: 'frame' | 'story';
}

export interface Cluster {
  /** Stable id built from the member ids, for keys and tests. */
  id: string;
  count: number;
  lat: number;
  lon: number;
  /** Members: opening the cluster zooms to their bounds. */
  ids: string[];
}

export interface MarkerResult {
  markers: SingleMarker[];
  clusters: Cluster[];
  /** Every card in the area that passes the filters, in priority order (the "In the area" list). */
  inArea: string[];
  /** True when "Show more" would change something (there are clusters). */
  canShowMore: boolean;
}

/** How many markers (singles and clusters together) are drawn at once before "Show more". Above the number of stories on the site, so the button stays hidden until the catalogue outgrows it. */
export const DEFAULT_LIMIT = 30;
export const SHOW_MORE_STEP = 5;
export const DEFAULT_MAX_CLUSTERS = 3;

export function inBounds(card: LatLon, b: Bounds): boolean {
  return card.lat >= b.south && card.lat <= b.north && card.lon >= b.west && card.lon <= b.east;
}

/** Squared distance on a flat map, longitude scaled by latitude; enough for ordering and grouping. */
function dist2(a: LatLon, b: LatLon): number {
  const dLat = a.lat - b.lat;
  const dLon = (a.lon - b.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return dLat * dLat + dLon * dLon;
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Splits cards into exactly `k` spatial groups (farthest-point seeds, a few k-means rounds). Deterministic. */
function group(cards: readonly MapCard[], k: number): MapCard[][] {
  if (k <= 1) return [[...cards]];
  const mean = (list: readonly MapCard[]): LatLon => ({
    lat: list.reduce((s, c) => s + c.lat, 0) / list.length,
    lon: list.reduce((s, c) => s + c.lon, 0) / list.length,
  });
  const sorted = [...cards].sort(byId);
  const seeds: LatLon[] = [];
  const farthest = (from: LatLon[]): MapCard => {
    let best = sorted[0]!;
    let bestD = -1;
    for (const c of sorted) {
      const d = Math.min(...from.map((s) => dist2(c, s)));
      if (d > bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  };
  seeds.push(farthest([mean(sorted)]));
  while (seeds.length < k) seeds.push(farthest(seeds));

  let groups: MapCard[][] = [];
  for (let round = 0; round < 6; round += 1) {
    groups = seeds.map(() => []);
    for (const c of sorted) {
      let best = 0;
      let bestD = Infinity;
      seeds.forEach((s, i) => {
        const d = dist2(c, s);
        if (d < bestD) {
          best = i;
          bestD = d;
        }
      });
      groups[best]!.push(c);
    }
    groups.forEach((g, i) => {
      if (g.length) seeds[i] = mean(g);
    });
  }
  return groups;
}

export function selectMarkers(input: MarkerInput): MarkerResult {
  const {
    cards,
    bounds,
    center,
    activeThread = null,
    activeEpoch = null,
    threadMode = 'filter',
    more = 0,
    pinned = null,
  } = input;
  const base = Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT));
  const limit = base + SHOW_MORE_STEP * Math.max(0, Math.floor(more));
  const maxClusters = Math.max(1, Math.min(input.maxClusters ?? DEFAULT_MAX_CLUSTERS, Math.floor(limit / 2)));

  const candidates = cards.filter(
    (c) =>
      inBounds(c, bounds) &&
      (activeEpoch === null || c.epoch === activeEpoch) &&
      (activeThread === null || threadMode === 'prioritize' || c.threads.includes(activeThread)),
  );

  const rank = (c: MapCard): [number, number, number, number] => [
    c.id === pinned ? 0 : 1,
    c.importance === 3 ? 0 : 1,
    activeThread !== null && c.threads.includes(activeThread) ? 0 : 1,
    dist2(c, center),
  ];
  const ordered = candidates
    .map((c) => ({ c, r: rank(c) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.r[2] - b.r[2] || a.r[3] - b.r[3] || byId(a.c, b.c))
    .map((x) => x.c);

  const toMarker = (c: MapCard): SingleMarker => ({
    id: c.id,
    lat: c.lat,
    lon: c.lon,
    kind: c.importance === 3 ? 'frame' : 'story',
  });
  const inArea = ordered.map((c) => c.id);

  if (ordered.length <= limit) {
    return { markers: ordered.map(toMarker), clusters: [], inArea, canShowMore: false };
  }

  // More cards than slots: k single markers plus c clusters, k + c = limit, each cluster has 2 or more cards.
  // Try the most clusters first; one cluster always works (the rest has at least 2 cards).
  for (let c = maxClusters; c >= 1; c -= 1) {
    const k = limit - c;
    const rest = ordered.slice(k);
    if (rest.length < 2 * c) continue;
    const groups = group(rest, c);
    if (groups.some((g) => g.length < 2)) continue;
    const clusters: Cluster[] = groups
      .map((g) => {
        const ids = g.map((x) => x.id).sort();
        return {
          id: `cluster:${ids.join('+')}`,
          count: g.length,
          lat: g.reduce((s, x) => s + x.lat, 0) / g.length,
          lon: g.reduce((s, x) => s + x.lon, 0) / g.length,
          ids,
        };
      })
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    return { markers: ordered.slice(0, k).map(toMarker), clusters, inArea, canShowMore: true };
  }
  // Unreachable: c = 1 is always feasible. Kept so a future change cannot silently break the limit.
  throw new Error('selectMarkers: no valid layout');
}

/** Smallest box around a card, for "zoom until it stands alone" in tests and in the map code. */
export function boundsAround(p: LatLon, padding = 0.0005): Bounds {
  return { south: p.lat - padding, north: p.lat + padding, west: p.lon - padding, east: p.lon + padding };
}
