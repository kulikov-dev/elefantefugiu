import { describe, expect, it } from 'vitest';
import type { EventData } from '../../src/lib/events';
import { isPublished } from '../../src/lib/events';
import {
  TT_MIN_STORIES,
  TT_PLACE_MIN,
  epochRuns,
  panAboveCard,
  parseSession,
  placeChips,
  placeSlug,
  playlist,
  spreadPoints,
  startEventPath,
  stepIndex,
  ttInfoOf,
  ttYear,
  unreadOf,
  yearSpan,
  type TtInfo,
} from '../../src/lib/timetravel';

const place = (pt: string, en = pt) => ({ name: { pt, en, ru: pt }, lat: 38.7, lon: -9.1 });
const event = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    year: 1500,
    place: place('Lisboa, Paço'),
    bridge: { name: 'x', address: 'y', lat: 38.7, lon: -9.1 },
    sensitive: false,
    ...over,
  }) as unknown as EventData;

const box = { south: 38, north: 39, west: -10, east: -9 };
const card = (id: string, over: Record<string, unknown> = {}) => ({ id, lat: 38.5, lon: -9.5, epoch: 'a', threads: ['mar'], ...over });
const info = (from: number, over: Partial<TtInfo> = {}): TtInfo => ({ from, to: from, year: String(from), ...over });

describe('playlist', () => {
  const order = { a: 1, b: 2 };

  it('keeps the stories of the window in the order of the epoch feed: epoch, start year, end year, id', () => {
    const cards = [card('z', { epoch: 'b' }), card('c'), card('a'), card('b')];
    const inf = { z: info(1000), c: info(1500), a: info(1500, { to: 1510 }), b: info(1500) };
    const ids = playlist({ cards, info: inf, bounds: box, fio: null, epochOrder: order }).map((c) => c.id);
    // epoch a first (even though z is older), then 1500 by id (b, c) and the longer one (a) after them
    expect(ids).toEqual(['b', 'c', 'a', 'z']);
  });

  it('leaves out the points outside the window and the stories without data', () => {
    const cards = [card('in'), card('out', { lat: 41 }), card('nodata')];
    const ids = playlist({ cards, info: { in: info(1), out: info(2) }, bounds: box, fio: null, epochOrder: order }).map((c) => c.id);
    expect(ids).toEqual(['in']);
  });

  it('leaves out a story abroad and a point outside Portugal', () => {
    const cards = [card('in'), card('abroad', { overseas: { lat: 47, lon: -1.5, name: 'Nantes' } }), card('far', { lat: 47, lon: -1.5 })];
    const inf = { in: info(1), abroad: info(2), far: info(3) };
    const wide = { south: 30, north: 50, west: -20, east: 0 };
    expect(playlist({ cards, info: inf, bounds: wide, fio: null, epochOrder: order }).map((c) => c.id)).toEqual(['in']);
  });

  it('takes the islands along when asked, though the window does not hold them', () => {
    const cards = [card('in'), card('madeira', { lat: 32.65, lon: -16.9 })];
    const inf = { in: info(1), madeira: info(2) };
    expect(playlist({ cards, info: inf, bounds: box, fio: null, epochOrder: order }).map((c) => c.id)).toEqual(['in']);
    expect(playlist({ cards, info: inf, bounds: box, fio: null, epochOrder: order, islands: true }).map((c) => c.id)).toEqual(['in', 'madeira']);
  });

  it('applies the thread filter and the place', () => {
    const cards = [card('a1', { threads: ['mar'] }), card('a2', { threads: ['fe'] })];
    const inf = { a1: info(1, { place: 'lisboa' }), a2: info(2, { place: 'porto' }) };
    expect(playlist({ cards, info: inf, bounds: box, fio: 'fe', epochOrder: order }).map((c) => c.id)).toEqual(['a2']);
    expect(playlist({ cards, info: inf, bounds: box, fio: null, epochOrder: order, place: 'lisboa' }).map((c) => c.id)).toEqual(['a1']);
  });

  it('needs at least three stories to play', () => {
    expect(TT_MIN_STORIES).toBe(3);
  });
});

describe('placeChips', () => {
  it('lists the places with at least the minimum of stories, counted from the data, the biggest first', () => {
    const events = [
      ...Array.from({ length: TT_PLACE_MIN }, (_, i) => event(`l${i}`, { place: place('Lisboa, Paço (hoje)', 'Lisbon') })),
      ...Array.from({ length: TT_PLACE_MIN + 2 }, (_, i) => event(`p${i}`, { place: place('Porto', 'Oporto') })),
      ...Array.from({ length: TT_PLACE_MIN - 1 }, (_, i) => event(`f${i}`, { place: place('Funchal') })),
    ];
    const chips = placeChips(events, 'en');
    expect(chips.map((c) => [c.key, c.name, c.count])).toEqual([
      ['porto', 'Oporto', TT_PLACE_MIN + 2],
      ['lisboa', 'Lisbon', TT_PLACE_MIN],
    ]);
  });

  it('adds a place when one more story with it is published', () => {
    const base = Array.from({ length: TT_PLACE_MIN - 1 }, (_, i) => event(`f${i}`, { place: place('Funchal') }));
    expect(placeChips(base, 'pt')).toEqual([]);
    expect(placeChips([...base, event('f-new', { place: place('Funchal') })], 'pt').map((c) => c.key)).toEqual(['funchal']);
  });

  it('a story queued for a future day is not published, so it does not count', () => {
    const queued = event('q', { status: 'ready', published: '2999-01-01' });
    expect(isPublished(queued as never)).toBe(false);
  });

  it('a key has no accents or spaces', () => {
    expect(placeSlug('São Miguel')).toBe('sao-miguel');
  });
});

describe('ttInfoOf', () => {
  it('writes the year as the site does', () => {
    const i = ttInfoOf(event('x', { year: 1515 }), 'en');
    expect(i).toEqual({ from: 1515, to: 1515, year: '1515', place: 'lisboa' });
  });
});

describe('small rules', () => {
  it('epochRuns joins the neighbours of one epoch', () => {
    expect(epochRuns(['a', 'a', 'b', 'a'])).toEqual([
      { epoch: 'a', count: 2 },
      { epoch: 'b', count: 1 },
      { epoch: 'a', count: 1 },
    ]);
  });

  it('stepIndex stays inside the list', () => {
    expect(stepIndex(0, -1, 5)).toBe(0);
    expect(stepIndex(4, 1, 5)).toBe(4);
    expect(stepIndex(2, 1, 5)).toBe(3);
  });

  it('yearSpan is one year when both are the same', () => {
    expect(yearSpan('I', '1910', 'from {from} to {to}')).toBe('from I to 1910');
    expect(yearSpan('1500', '1500', 'from {from} to {to}')).toBe('1500');
  });

  it('unreadOf keeps the order of the list', () => {
    expect(unreadOf([{ id: 'a' }, { id: 'b' }, { id: 'c' }], ['b']).map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('panAboveCard pans only when the point is under the card (with the margin)', () => {
    expect(panAboveCard(100, 300, 30)).toBe(0);
    expect(panAboveCard(290, 300, 30)).toBe(20);
  });

  it('the events carry the place, only two names exist', () => {
    expect(startEventPath('lisboa')).toBe('timetravel-start-lisboa');
    expect(startEventPath('view')).toBe('timetravel-start-view');
  });

  it('parseSession accepts our own value only', () => {
    expect(parseSession('{"id":"x","src":"lisboa"}')).toEqual({ id: 'x', src: 'lisboa' });
    expect(parseSession('{"id":1}')).toBeNull();
    expect(parseSession('nonsense')).toBeNull();
    expect(parseSession(null)).toBeNull();
  });
});

describe('spreadPoints', () => {
  it('moves markers on one spot apart, around their middle, and leaves the others', () => {
    const out = spreadPoints([
      { id: 'a', x: 100, y: 100 },
      { id: 'b', x: 101, y: 100 },
      { id: 'far', x: 300, y: 300 },
    ]);
    expect([...out.keys()].sort()).toEqual(['a', 'b']);
    const a = { x: 100 + out.get('a')!.dx, y: 100 + out.get('a')!.dy };
    const b = { x: 101 + out.get('b')!.dx, y: 100 + out.get('b')!.dy };
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(14 - 0.001);
  });

  it('does nothing when no two are on one spot', () => {
    expect(spreadPoints([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }]).size).toBe(0);
  });

  it('does not chain: a row of markers, each near the next, stays as it is, and a ring is never wide', () => {
    const row = Array.from({ length: 40 }, (_, i) => ({ id: `r${String(i).padStart(2, '0')}`, x: i * 8, y: 0 }));
    expect(spreadPoints(row).size).toBe(0);
    const heap = Array.from({ length: 30 }, (_, i) => ({ id: `h${i}`, x: 50, y: 50 }));
    for (const s of spreadPoints(heap).values()) expect(Math.hypot(s.dx, s.dy)).toBeLessThanOrEqual(28 + 0.001);
  });
});

describe('ttYear', () => {
  const lang = 'en' as const;
  it('takes the short year of the data, else the first year with its era, never a bare 1', () => {
    expect(ttYear({ year: { from: 1, to: 100 }, year_scale: { en: '1st c.', pt: 'séc. I', ru: 'I век' } } as never, lang)).toBe('1st c.');
    expect(ttYear({ year: 1515 } as never, lang)).toBe('1515');
    expect(ttYear({ year: 8 } as never, lang)).not.toBe('8');
    expect(ttYear({ year: -140 } as never, lang)).toMatch(/140/);
    expect(ttYear({ year: 1 } as never, lang)).not.toBe('1');
  });
});
