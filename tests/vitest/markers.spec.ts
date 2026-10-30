import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  boundsAround,
  declutterMarkers,
  DEFAULT_LIMIT,
  inBounds,
  MARKER_BOX,
  selectMarkers,
  SHOW_MORE_STEP,
  type Bounds,
  type MapCard,
  type MarkerResult,
} from '../../src/lib/markers';

// ---- helpers ----------------------------------------------------------------

/** Small seeded generator, so a failing scenario can be reproduced. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THREADS = ['mar', 'comida-e-vinho', 'poder-e-revolta', 'gente-como-nos', 'natureza'];
const EPOCHS = ['a', 'b', 'c'];
const PORTUGAL: Bounds = { south: 36.9, north: 42.2, west: -9.6, east: -6.1 };

function randomCards(rand: () => number, n: number): MapCard[] {
  const hubs = [
    { lat: 38.71, lon: -9.14 }, // Lisbon, many cards close together
    { lat: 41.15, lon: -8.61 },
    { lat: 37.1, lon: -8.67 },
    { lat: 40.2, lon: -8.41 },
  ];
  return Array.from({ length: n }, (_, i) => {
    const hub = hubs[Math.floor(rand() * hubs.length)]!;
    // Some cards share exactly the same coordinates on purpose.
    const sameSpot = rand() < 0.25;
    const spread = rand() < 0.3 ? 1.5 : 0.05;
    const threads = [THREADS[Math.floor(rand() * 5)]!];
    if (rand() < 0.4) {
      const second = THREADS[Math.floor(rand() * 5)]!;
      if (second !== threads[0]) threads.push(second);
    }
    return {
      id: `c${String(i).padStart(3, '0')}`,
      lat: sameSpot ? hub.lat : hub.lat + (rand() - 0.5) * spread,
      lon: sameSpot ? hub.lon : hub.lon + (rand() - 0.5) * spread,
      importance: ([1, 2, 3] as const)[Math.floor(rand() * 3)]!,
      threads,
      epoch: EPOCHS[Math.floor(rand() * 3)]!,
    };
  });
}

function randomBounds(rand: () => number): Bounds {
  // From the whole country down to a street.
  const scale = Math.pow(rand(), 3);
  const h = 0.002 + scale * (PORTUGAL.north - PORTUGAL.south);
  const w = 0.002 + scale * (PORTUGAL.east - PORTUGAL.west);
  const south = PORTUGAL.south + rand() * (PORTUGAL.north - PORTUGAL.south - h);
  const west = PORTUGAL.west + rand() * (PORTUGAL.east - PORTUGAL.west - w);
  return { south, north: south + h, west, east: west + w };
}

const centerOf = (b: Bounds) => ({ lat: (b.south + b.north) / 2, lon: (b.west + b.east) / 2 });
const drawn = (r: MarkerResult) => r.markers.length + r.clusters.length;
const covered = (r: MarkerResult) => [...r.markers.map((m) => m.id), ...r.clusters.flatMap((c) => c.ids)];

function scenarios(count: number, seed: number) {
  const rand = rng(seed);
  return Array.from({ length: count }, () => {
    const cards = randomCards(rand, Math.floor(rand() * 160));
    const bounds = randomBounds(rand);
    return {
      cards,
      bounds,
      center: rand() < 0.5 ? centerOf(bounds) : { lat: 38.7, lon: -9.1 },
      activeThread: rand() < 0.5 ? THREADS[Math.floor(rand() * 5)]! : null,
      activeEpoch: rand() < 0.4 ? EPOCHS[Math.floor(rand() * 3)]! : null,
      more: Math.floor(rand() * 4),
    };
  });
}

// ---- the limit --------------------------------------------------------------

describe('limit', () => {
  it('never draws more than the limit, at any zoom, thread, epoch or number of presses', () => {
    for (const s of scenarios(3000, 1)) {
      const r = selectMarkers(s);
      expect(drawn(r)).toBeLessThanOrEqual(DEFAULT_LIMIT + SHOW_MORE_STEP * s.more);
    }
  });

  it('is at most 7 whenever "Show more" has not been pressed', () => {
    for (const s of scenarios(3000, 2)) {
      expect(drawn(selectMarkers({ ...s, more: 0 }))).toBeLessThanOrEqual(DEFAULT_LIMIT);
    }
  });

  it('holds for other limits too', () => {
    for (const limit of [1, 2, 3, 5, 6]) {
      for (const s of scenarios(300, 3 + limit)) {
        expect(drawn(selectMarkers({ ...s, limit }))).toBeLessThanOrEqual(limit + SHOW_MORE_STEP * s.more);
      }
    }
  });

  it('uses all slots when there are more cards than slots', () => {
    for (const s of scenarios(1500, 4)) {
      const r = selectMarkers(s);
      const limit = DEFAULT_LIMIT + SHOW_MORE_STEP * s.more;
      if (r.inArea.length > limit) expect(drawn(r)).toBe(limit);
      else expect(drawn(r)).toBe(r.inArea.length);
    }
  });
});

// ---- covering and clusters ---------------------------------------------------

describe('markers and clusters', () => {
  it('cover every card of the area exactly once (the "In the area" list equals what the map shows)', () => {
    for (const s of scenarios(2000, 5)) {
      const r = selectMarkers(s);
      const ids = covered(r);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual([...r.inArea].sort());
    }
  });

  it('give each cluster at least two cards, a matching count and a position inside the area', () => {
    for (const s of scenarios(2000, 6)) {
      const r = selectMarkers(s);
      for (const c of r.clusters) {
        expect(c.count).toBe(c.ids.length);
        expect(c.count).toBeGreaterThanOrEqual(2);
        expect(inBounds(c, s.bounds)).toBe(true);
      }
      expect(r.canShowMore).toBe(r.clusters.length > 0);
    }
  });

  it('draw single markers only for cards inside the area', () => {
    for (const s of scenarios(500, 7)) {
      for (const m of selectMarkers(s).markers) expect(inBounds(m, s.bounds)).toBe(true);
    }
  });

  it('give an empty result for an empty area', () => {
    const cards = randomCards(rng(8), 50);
    const nowhere: Bounds = { south: 0, north: 1, west: 0, east: 1 };
    const r = selectMarkers({ cards, bounds: nowhere, center: centerOf(nowhere) });
    expect(r).toEqual({ markers: [], clusters: [], inArea: [], canShowMore: false });
    expect(selectMarkers({ cards: [], bounds: PORTUGAL, center: centerOf(PORTUGAL) }).inArea).toEqual([]);
  });

  it('show everything as single markers when it fits', () => {
    const cards = randomCards(rng(9), 5).map((c) => ({ ...c, lat: 38.7, lon: -9.1 }));
    const r = selectMarkers({ cards, bounds: PORTUGAL, center: centerOf(PORTUGAL) });
    expect(r.markers).toHaveLength(5);
    expect(r.clusters).toHaveLength(0);
  });

  it('are the same whatever the order of the input', () => {
    for (const s of scenarios(200, 10)) {
      const shuffled = [...s.cards].sort(() => 0.5 - rng(s.cards.length + 1)());
      expect(selectMarkers({ ...s, cards: shuffled })).toEqual(selectMarkers(s));
    }
  });
});

// ---- priority ----------------------------------------------------------------

describe('priority', () => {
  it('shows frame cards before stories: a story alone on the map means no frame card is hidden', () => {
    for (const s of scenarios(2000, 11)) {
      const r = selectMarkers(s);
      const byId = new Map(s.cards.map((c) => [c.id, c]));
      const storyShown = r.markers.some((m) => byId.get(m.id)!.importance !== 3);
      if (!storyShown) continue;
      const frameInClusters = r.clusters.flatMap((c) => c.ids).some((id) => byId.get(id)!.importance === 3);
      expect(frameInClusters).toBe(false);
    }
  });

  it('marks frame cards as "frame" and others as "story"', () => {
    for (const s of scenarios(300, 12)) {
      const byId = new Map(s.cards.map((c) => [c.id, c]));
      for (const m of selectMarkers(s).markers) {
        expect(m.kind).toBe(byId.get(m.id)!.importance === 3 ? 'frame' : 'story');
      }
    }
  });

  it('with an active thread (filter mode) shows only cards of that thread, primary or second', () => {
    for (const s of scenarios(1500, 13)) {
      if (!s.activeThread) continue;
      const byId = new Map(s.cards.map((c) => [c.id, c]));
      for (const id of selectMarkers(s).inArea) expect(byId.get(id)!.threads).toContain(s.activeThread);
    }
  });

  it('in prioritize mode puts the thread cards ahead of the others, after the frame cards', () => {
    for (const s of scenarios(1500, 14)) {
      if (!s.activeThread) continue;
      const r = selectMarkers({ ...s, threadMode: 'prioritize' });
      const byId = new Map(s.cards.map((c) => [c.id, c]));
      const order = r.inArea.map((id) => byId.get(id)!);
      const tier = (c: MapCard) => (c.importance === 3 ? 0 : c.threads.includes(s.activeThread!) ? 1 : 2);
      const tiers = order.map(tier);
      expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    }
  });

  it('keeps a pinned card as a single marker, within the limit', () => {
    for (const s of scenarios(1500, 20)) {
      const base = selectMarkers(s);
      const target = base.inArea[base.inArea.length - 1];
      if (!target) continue;
      const r = selectMarkers({ ...s, pinned: target });
      expect(r.markers.some((m) => m.id === target)).toBe(true);
      expect(drawn(r)).toBeLessThanOrEqual(DEFAULT_LIMIT + SHOW_MORE_STEP * s.more);
      expect([...covered(r)].sort()).toEqual([...r.inArea].sort());
    }
  });

  it('ignores a pinned card that is outside the area or hidden by the filters', () => {
    const cards: MapCard[] = [
      { id: 'in', lat: 38.7, lon: -9.1, importance: 3, threads: ['mar'] },
      { id: 'out', lat: 41, lon: -8, importance: 1, threads: ['mar'] },
      { id: 'other', lat: 38.71, lon: -9.1, importance: 1, threads: ['natureza'] },
    ];
    const bounds: Bounds = { south: 38, north: 39, west: -10, east: -9 };
    const r = selectMarkers({ cards, bounds, center: { lat: 38.5, lon: -9.5 }, activeThread: 'mar', pinned: 'out' });
    expect(r.inArea).toEqual(['in']);
    expect(selectMarkers({ cards, bounds, center: { lat: 38.5, lon: -9.5 }, activeThread: 'mar', pinned: 'other' }).inArea).toEqual(['in']);
  });

  it('orders the rest by distance to the centre', () => {
    const cards: MapCard[] = [
      { id: 'far', lat: 41, lon: -8, importance: 1, threads: ['mar'] },
      { id: 'near', lat: 38.72, lon: -9.14, importance: 1, threads: ['mar'] },
      { id: 'mid', lat: 39.5, lon: -8.8, importance: 1, threads: ['mar'] },
    ];
    const r = selectMarkers({ cards, bounds: PORTUGAL, center: { lat: 38.7, lon: -9.1 } });
    expect(r.inArea).toEqual(['near', 'mid', 'far']);
  });
});

// ---- show more and zoom --------------------------------------------------------

describe('"Show more" and zooming in', () => {
  it('raises the limit by 5 for the same area and only adds markers', () => {
    for (const s of scenarios(1500, 15)) {
      const a = selectMarkers({ ...s, more: 0 });
      const b = selectMarkers({ ...s, more: 1 });
      const ids = new Set(b.markers.map((m) => m.id));
      for (const m of a.markers) expect(ids.has(m.id)).toBe(true);
      expect(b.inArea).toEqual(a.inArea);
      if (a.inArea.length > DEFAULT_LIMIT) expect(drawn(b)).toBe(Math.min(a.inArea.length, DEFAULT_LIMIT + SHOW_MORE_STEP));
    }
  });

  it('uses the numbers of the task: 7 at first, 12 after one press, 17 after two', () => {
    const cards: MapCard[] = Array.from({ length: 30 }, (_, i) => ({
      id: `q${String(i).padStart(2, '0')}`,
      lat: 38.7 + i * 0.001,
      lon: -9.1,
      importance: 1,
      threads: ['mar'],
    }));
    // The step is checked from a small limit of 7 (the default is 30, so the button stays hidden at the present number of stories).
    const base = { cards, bounds: PORTUGAL, center: { lat: 38.7, lon: -9.1 }, limit: 7 };
    expect(DEFAULT_LIMIT).toBe(30);
    expect(SHOW_MORE_STEP).toBe(5);
    expect(drawn(selectMarkers(base))).toBe(7);
    expect(drawn(selectMarkers({ ...base, more: 1 }))).toBe(12);
    expect(drawn(selectMarkers({ ...base, more: 2 }))).toBe(17);
  });

  it('eventually shows everything as single markers after enough presses', () => {
    for (const s of scenarios(300, 16)) {
      const n = selectMarkers({ ...s, more: 0 }).inArea.length;
      const r = selectMarkers({ ...s, more: Math.ceil(n / SHOW_MORE_STEP) });
      expect(r.clusters).toHaveLength(0);
      expect(r.markers).toHaveLength(n);
    }
  });

  it('opens clusters when zooming in: a zoomed-in area never has more cards than the area around it', () => {
    for (const s of scenarios(500, 17)) {
      const wide = selectMarkers(s);
      for (const c of wide.clusters) {
        const lats = c.ids.map((id) => s.cards.find((x) => x.id === id)!);
        const box: Bounds = {
          south: Math.min(...lats.map((x) => x.lat)),
          north: Math.max(...lats.map((x) => x.lat)),
          west: Math.min(...lats.map((x) => x.lon)),
          east: Math.max(...lats.map((x) => x.lon)),
        };
        const inside = selectMarkers({ ...s, bounds: box, center: centerOf(box), more: 0 });
        for (const id of c.ids) expect(inside.inArea).toContain(id);
        expect(drawn(inside)).toBeLessThanOrEqual(DEFAULT_LIMIT);
      }
    }
  });
});

// ---- reachability ------------------------------------------------------------

/** A card is reachable when a small area around it, plus enough presses of "Show more", shows it alone. */
function reachable(card: MapCard, cards: readonly MapCard[], filters: { activeThread: string | null; activeEpoch: string | null }) {
  const bounds = boundsAround(card);
  for (let more = 0; more <= Math.ceil(cards.length / SHOW_MORE_STEP) + 1; more += 1) {
    const r = selectMarkers({ cards, bounds, center: centerOf(bounds), more, ...filters });
    if (r.markers.some((m) => m.id === card.id)) return { ok: true, more };
  }
  return { ok: false, more: -1 };
}

describe('reachability', () => {
  it('every card that passes the filters is reachable by zooming in or pressing "Show more"', () => {
    for (const s of scenarios(120, 18)) {
      const filters = { activeThread: s.activeThread, activeEpoch: s.activeEpoch };
      const candidates = s.cards.filter(
        (c) => (!s.activeThread || c.threads.includes(s.activeThread)) && (!s.activeEpoch || c.epoch === s.activeEpoch),
      );
      for (const c of candidates) expect(reachable(c, s.cards, filters).ok).toBe(true);
    }
  });

  it('a card alone in its area needs no "Show more"', () => {
    const cards = randomCards(rng(19), 60).map((c, i) => ({ ...c, lat: 38 + i * 0.01, lon: -9 + i * 0.01 }));
    for (const c of cards) expect(reachable(c, cards, { activeThread: null, activeEpoch: null })).toEqual({ ok: true, more: 0 });
  });

  it('forty cards on one spot are reached by "Show more" in steps of five', () => {
    const cards: MapCard[] = Array.from({ length: 40 }, (_, i) => ({
      id: `p${String(i).padStart(2, '0')}`,
      lat: 38.7,
      lon: -9.1,
      importance: 1,
      threads: ['mar'],
    }));
    const last = cards[39]!;
    const r = reachable(last, cards, { activeThread: null, activeEpoch: null });
    expect(r.ok).toBe(true);
    expect(r.more).toBe(Math.ceil((40 - DEFAULT_LIMIT) / SHOW_MORE_STEP));
  });
});

// ---- the real test data -------------------------------------------------------

function realCards(): MapCard[] {
  const dir = join(process.cwd(), 'src/content/events');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(join(dir, f), 'utf8')))
    .filter((e) => e.status === 'ready')
    .map((e) => ({
      id: e.id as string,
      lat: e.bridge.lat as number,
      lon: e.bridge.lon as number,
      importance: e.importance as 1 | 2 | 3,
      threads: e.threads as string[],
      epoch: e.epoch as string,
    }));
}

describe('real events', () => {
  const cards = realCards();
  const country: Bounds = { south: 36.8, north: 42.3, west: -9.7, east: -6.0 };
  const threads = [...new Set(cards.flatMap((c) => c.threads))];
  const epochs = [...new Set(cards.map((c) => c.epoch!))];

  it('loads the content', () => {
    expect(cards.length).toBeGreaterThan(10);
  });

  it('shows at most 7 for every thread and epoch, from the whole country down to a street', () => {
    const zooms = [1, 0.5, 0.2, 0.05, 0.01, 0.002];
    for (const activeThread of [null, ...threads]) {
      for (const activeEpoch of [null, ...epochs]) {
        for (const z of zooms) {
          for (const focus of cards) {
            const b: Bounds = {
              south: focus.lat - z * 3,
              north: focus.lat + z * 3,
              west: focus.lon - z * 2,
              east: focus.lon + z * 2,
            };
            const r = selectMarkers({ cards, bounds: b, center: focus, activeThread, activeEpoch });
            expect(drawn(r)).toBeLessThanOrEqual(DEFAULT_LIMIT);
          }
        }
      }
    }
  });

  it('whole country: up to the limit, frame cards first', () => {
    const r = selectMarkers({ cards, bounds: country, center: { lat: 39.5, lon: -8 } });
    // Frame cards come first; with fewer than the limit of them the rest is filled with stories.
    const frames = cards.filter((c) => c.importance === 3).length;
    expect(drawn(r)).toBe(Math.min(DEFAULT_LIMIT, cards.length));
    expect(r.markers.filter((m) => m.kind === 'frame')).toHaveLength(Math.min(DEFAULT_LIMIT, frames));
    // The islands (Madeira, Azores) are outside the frame of the mainland: they have their own buttons.
    const onMainland = cards.filter((c) => c.lat >= country.south && c.lat <= country.north && c.lon >= country.west && c.lon <= country.east);
    expect(r.inArea).toHaveLength(onMainland.length);
  });

  it('every real card is reachable', () => {
    for (const c of cards) expect(reachable(c, cards, { activeThread: null, activeEpoch: null }).ok).toBe(true);
  });
});

// ---- the marker is placed by the bridge, not by the place (stage 5c) ----
import { toMapCards } from '../../src/lib/map-cards';
import type { EventData } from '../../src/lib/events';

describe('markers use the bridge coordinates', () => {
  const ev = (id: string, place: [number, number], bridge: [number, number]) =>
    ({
      id,
      slug: { pt: id, en: id },
      title: { pt: id, en: id },
      epoch: 'a',
      year: 1500,
      place: { name: { pt: 'p', en: 'p', ru: 'p' }, lat: place[0], lon: place[1] },
      bridge: { name: 'b', address: 'a', lat: bridge[0], lon: bridge[1], url: 'https://x.y', note: { pt: 'n', en: 'n' } },
      threads: ['mar'],
      importance: 2,
      min_age: 'all',
      sensitive: false,
      hook: { pt: 'h', en: 'h' },
    }) as unknown as EventData;
  const country = { south: 36.8, north: 42.3, west: -9.7, east: -6.0 };
  const pick = (events: EventData[]) =>
    selectMarkers({ cards: toMapCards(events, 'pt', () => '/x/'), bounds: country, center: { lat: 39.5, lon: -8 }, activeThread: null, activeEpoch: null, more: 0, pinned: null });

  it('an event whose place is in Goa shows at its bridge in Lisbon', () => {
    const r = pick([ev('goa', [15.5009, 73.9116], [38.6999, -9.204]), ev('porto', [41.15, -8.61], [41.1516, -8.609])]);
    const goa = r.markers.find((m) => m.id === 'goa');
    expect(goa && [goa.lat, goa.lon]).toEqual([38.6999, -9.204]);
  });

  it('an event whose place is abroad still counts inside the country bounds, because the bridge is', () => {
    const r = pick([ev('goa', [15.5009, 73.9116], [38.6999, -9.204])]);
    expect(r.markers.map((m) => m.id)).toEqual(['goa']);
  });

  it('the bridge, not the place, decides which cards are close together (clusters)', () => {
    // Two places far apart, two bridges in the same square: they cluster; swapped, they would not.
    const r = pick([ev('a', [41.0, -8.6], [38.7, -9.14]), ev('b', [37.0, -8.9], [38.7005, -9.1405])]);
    const all = [...r.markers.map((m) => m.id), ...r.clusters.flatMap((c) => c.ids)].sort();
    expect(all).toEqual(['a', 'b']);
    expect(r.markers.length + r.clusters.length).toBeLessThanOrEqual(2);
  });

  it('keeps the limit of seven whatever the places are', () => {
    const many = Array.from({ length: 30 }, (_, i) => ev(`e${i}`, [-30 + i, 100 + i], [37 + (i % 6) * 0.9, -9 + (i % 5) * 0.55]));
    const r = pick(many);
    expect(r.markers.length + r.clusters.length).toBeLessThanOrEqual(DEFAULT_LIMIT);
  });
});

// ---- markers that would overlap on the screen -----------------------------------

describe('declutterMarkers', () => {
  // The "screen" of these tests is the plane itself: lon is x and lat is y, in px.
  const project = (p: { lat: number; lon: number }) => ({ x: p.lon, y: p.lat });
  const single = (id: string, x: number, y: number, kind: 'frame' | 'story' = 'story') => ({ id, lat: y, lon: x, kind });
  const result = (markers: ReturnType<typeof single>[], clusters: MarkerResult['clusters'] = []): MarkerResult => ({ markers, clusters, inArea: markers.map((m) => m.id), canShowMore: false });

  it('leaves markers alone when their boxes do not touch', () => {
    const r = declutterMarkers(result([single('a', 0, 0), single('b', MARKER_BOX.story, 0), single('c', 100, 100)]), project);
    expect(r.markers.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(r.clusters).toEqual([]);
  });

  it('joins two markers whose centres are closer than the mean of their boxes into a cluster of two', () => {
    const r = declutterMarkers(result([single('a', 0, 0), single('b', MARKER_BOX.story - 1, 0), single('far', 200, 0)]), project);
    expect(r.markers.map((m) => m.id)).toEqual(['far']);
    expect(r.clusters).toHaveLength(1);
    expect(r.clusters[0]).toMatchObject({ id: 'cluster:a+b', count: 2, ids: ['a', 'b'] });
  });

  it('uses the bigger box of a frame marker: a frame and a story 25 px apart overlap, 27 px apart do not', () => {
    expect(declutterMarkers(result([single('f', 0, 0, 'frame'), single('s', 25, 0)]), project).clusters).toHaveLength(1);
    expect(declutterMarkers(result([single('f', 0, 0, 'frame'), single('s', 27, 0)]), project).clusters).toHaveLength(0);
  });

  it('joins a chain: A touches B and B touches C, so the three are one cluster at the middle of the three', () => {
    const r = declutterMarkers(result([single('a', 0, 0), single('b', 20, 0), single('c', 40, 0)]), project);
    expect(r.markers).toEqual([]);
    expect(r.clusters).toHaveLength(1);
    expect(r.clusters[0]).toMatchObject({ count: 3, ids: ['a', 'b', 'c'], lat: 0, lon: 20 });
  });

  it('adds up the counts when a single joins a cluster, and keeps every card once', () => {
    const cluster = { id: 'cluster:x+y', count: 2, lat: 0, lon: 0, ids: ['x', 'y'] };
    const r = declutterMarkers(result([single('a', 10, 0)], [cluster]), project);
    expect(r.clusters).toHaveLength(1);
    expect(r.clusters[0]).toMatchObject({ count: 3, ids: ['a', 'x', 'y'] });
  });

  it('keeps the card named in `keep` (the selected one) single, whatever is around it', () => {
    const r = declutterMarkers(result([single('sel', 0, 0), single('b', 5, 0)]), project, { keep: 'sel' });
    expect(r.markers.map((m) => m.id)).toEqual(['b', 'sel']);
    expect(r.clusters).toEqual([]);
  });

  it('changes nothing else: the area list and "Show more" stay as the selection made them', () => {
    const input = { ...result([single('a', 0, 0), single('b', 1, 0)]), canShowMore: true };
    const r = declutterMarkers(input, project);
    expect(r.inArea).toEqual(input.inArea);
    expect(r.canShowMore).toBe(true);
  });

  it('on the real cards: after joining no two markers overlap, and every card is covered once, at every zoom of a Lisbon view', () => {
    const cards = realCards();
    const lisbon = { lat: 38.71, lon: -9.14 };
    for (const px of [800, 4000, 20000, 100000]) {
      // px per degree of longitude; latitude a bit more (Mercator), enough for a test of overlap
      const proj = (p: { lat: number; lon: number }) => ({ x: (p.lon - lisbon.lon) * px, y: -(p.lat - lisbon.lat) * px * 1.27 });
      const area: Bounds = { south: 38.5, north: 38.95, west: -9.5, east: -8.8 };
      const sel = selectMarkers({ cards, bounds: area, center: lisbon });
      const r = declutterMarkers(sel, proj);
      const items = [...r.markers.map((m) => ({ ids: [m.id], p: proj(m), box: MARKER_BOX[m.kind] })), ...r.clusters.map((c) => ({ ids: c.ids, p: proj(c), box: MARKER_BOX.cluster }))];
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const d = Math.hypot(items[i]!.p.x - items[j]!.p.x, items[i]!.p.y - items[j]!.p.y);
          expect(d, `${px} px/deg: ${items[i]!.ids} and ${items[j]!.ids}`).toBeGreaterThanOrEqual((items[i]!.box + items[j]!.box) / 2);
        }
      }
      expect(covered(r).sort()).toEqual(covered(sel).sort());
    }
  });
});
