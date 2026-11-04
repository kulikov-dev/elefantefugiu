import { describe, expect, it } from 'vitest';
import { isVisibleInMode } from '../../src/lib/family';
import { anniversaryPins, isCalendarDay, pinsFor } from '../../src/lib/start-pins';
import { PERIOD_DAYS, periodOf, setKey, startSet, withFallback, type Pin, type StartStory } from '../../src/lib/start-set';

// A made-up pool: `n` stories over `epochs` epochs. The input is part of the test, not the content of the site.
const pool = (n: number, epochs: number): StartStory[] => Array.from({ length: n }, (_, i) => ({ id: `s${String(i).padStart(2, '0')}`, epoch: `e${i % epochs}`, sensitive: false }));
const NONE = new Set<string>();
const ids = (cards: ReturnType<typeof startSet>) => cards.map((c) => (c.target.type === 'story' ? c.target.id : c.target.href));
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const label = (text: string) => ({ pt: text, en: text, ru: text });
const pin = (over: Partial<Pin> & { id: string }): Pin => ({ kind: 'anniversary', from: '2030-05-10', to: '2030-05-10', priority: 0, label: label(over.id), target: { type: 'story', id: 's01' }, ...over });

describe('startSet: rotation', () => {
  const stories = pool(30, 6);

  it('gives the same three cards all day, whatever the order of the input', () => {
    const a = startSet({ today: '2030-05-10', stories, read: NONE, pins: [] });
    const b = startSet({ today: '2030-05-10', stories: [...stories].reverse(), read: NONE, pins: [] });
    expect(a).toHaveLength(3);
    expect(ids(a)).toEqual(ids(b));
    expect(a.every((c) => c.source === 'rotation' && c.label === undefined)).toBe(true);
  });

  it('keeps the set for 3 days and changes it on the next', () => {
    const first = '2030-05-10';
    const start = Array.from({ length: 12 }, (_, i) => addDays(first, i)).find((d) => periodOf(d) !== periodOf(addDays(d, -1)))!;
    const keys = Array.from({ length: PERIOD_DAYS }, (_, i) => ids(startSet({ today: addDays(start, i), stories, read: NONE, pins: [] })).join());
    expect(new Set(keys).size).toBe(1);
    expect(ids(startSet({ today: addDays(start, PERIOD_DAYS), stories, read: NONE, pins: [] })).join()).not.toBe(keys[0]);
  });

  it('takes every card from another epoch while there are epochs', () => {
    for (let p = 0; p < 40; p++) {
      const cards = startSet({ today: addDays('2030-01-01', p * PERIOD_DAYS), stories, read: NONE, pins: [] });
      const epochs = ids(cards).map((id) => stories.find((s) => s.id === id)!.epoch);
      expect(new Set(epochs).size).toBe(3);
    }
  });

  it('repeats an epoch only when there are fewer epochs than cards', () => {
    const cards = startSet({ today: '2030-05-10', stories: pool(10, 2), read: NONE, pins: [] });
    expect(cards).toHaveLength(3);
    expect(new Set(ids(cards).map((id) => id)).size).toBe(3);
  });

  it('does not give the same three cards in neighbouring periods (60 periods in a row)', () => {
    let previous = '';
    for (let p = 0; p < 60; p++) {
      const key = [...ids(startSet({ today: addDays('2030-01-01', p * PERIOD_DAYS), stories, read: NONE, pins: [] }))].sort().join();
      expect(key).not.toBe(previous);
      previous = key;
    }
  });

  it('puts unread stories first: a read one drops out and the next unread one comes', () => {
    const base = ids(startSet({ today: '2030-05-10', stories, read: NONE, pins: [] }));
    const after = ids(startSet({ today: '2030-05-10', stories, read: new Set([base[0]!]), pins: [] }));
    expect(after).toHaveLength(3);
    expect(after).not.toContain(base[0]);
    expect(after.filter((id) => base.includes(id))).toHaveLength(2);
  });

  it('adds read stories only when the unread ones run out, with nothing marking it', () => {
    const small = pool(4, 4);
    const read = new Set(['s00', 's01', 's02']);
    const cards = startSet({ today: '2030-05-10', stories: small, read, pins: [] });
    expect(ids(cards)).toHaveLength(3);
    expect(ids(cards)[0]).toBe('s03');
    expect(cards.every((c) => c.label === undefined)).toBe(true);
    expect(ids(startSet({ today: '2030-05-10', stories: small, read: new Set(small.map((s) => s.id)), pins: [] }))).toHaveLength(3);
  });

  it('never rotates a heavy story, and follows the stories the family mode shows', () => {
    const mixed: StartStory[] = pool(12, 4).map((s, i) => ({ ...s, sensitive: i % 3 === 0 }));
    for (let p = 0; p < 20; p++) {
      const cards = startSet({ today: addDays('2030-01-01', p * PERIOD_DAYS), stories: mixed, read: NONE, pins: [] });
      expect(ids(cards).every((id) => !mixed.find((s) => s.id === id)!.sensitive)).toBe(true);
    }
    const aged = pool(12, 4).map((s, i) => ({ ...s, minAge: i < 6 ? 'all' : '16' }));
    const visible = aged.filter((s) => isVisibleInMode({ minAge: s.minAge, sensitive: s.sensitive }, '12'));
    const cards = startSet({ today: '2030-05-10', stories: visible, read: NONE, pins: [] });
    expect(ids(cards).every((id) => visible.some((s) => s.id === id))).toBe(true);
  });

  it('returns fewer cards for a small pool and nothing for an empty one', () => {
    expect(startSet({ today: '2030-05-10', stories: pool(2, 2), read: NONE, pins: [] })).toHaveLength(2);
    expect(startSet({ today: '2030-05-10', stories: [], read: NONE, pins: [] })).toEqual([]);
    expect(withFallback([], ['a', 'b', 'c', 'd']).map((c) => (c.target.type === 'story' ? c.target.id : ''))).toEqual(['a', 'b', 'c']);
  });
});

describe('startSet: pins', () => {
  const stories = pool(30, 6);
  const day = '2030-05-10';

  it('puts an anniversary first, with its line, and leaves two cards to the rotation', () => {
    const cards = startSet({ today: day, stories, read: NONE, pins: [pin({ id: 'a', target: { type: 'story', id: 's07' }, label: label('On this day in 1877') })] });
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ source: 'pin', kind: 'anniversary', target: { id: 's07' }, label: { en: 'On this day in 1877' } });
    expect(cards.slice(1).every((c) => c.source === 'rotation')).toBe(true);
    expect(ids(cards).filter((id) => id === 's07')).toHaveLength(1);
  });

  it('shows the pin only in its window', () => {
    const p = pin({ id: 'a', from: '2030-05-09', to: '2030-05-11' });
    for (const [today, shown] of [['2030-05-08', false], ['2030-05-09', true], ['2030-05-11', true], ['2030-05-12', false]] as const) {
      expect(startSet({ today, stories, read: NONE, pins: [p] }).some((c) => c.source === 'pin')).toBe(shown);
    }
  });

  it('puts a holiday above an anniversary', () => {
    const cards = startSet({
      today: day,
      stories,
      read: NONE,
      pins: [pin({ id: 'a', target: { type: 'story', id: 's03' } }), pin({ id: 'h', kind: 'holiday', target: { type: 'story', id: 's04' } })],
    });
    expect(ids(cards).slice(0, 2)).toEqual(['s04', 's03']);
  });

  it('merges a holiday and an anniversary of one story into one card with the line of the holiday', () => {
    const cards = startSet({
      today: day,
      stories,
      read: NONE,
      pins: [pin({ id: 'a', label: label('anniversary') }), pin({ id: 'h', kind: 'holiday', label: label('holiday') })],
    });
    expect(cards.filter((c) => c.source === 'pin')).toHaveLength(1);
    expect(cards[0]!.label?.en).toBe('holiday');
    expect(cards[0]!.kind).toBe('holiday');
    expect(ids(cards).filter((id) => id === 's01')).toHaveLength(1);
    expect(cards).toHaveLength(3);
  });

  it('keeps at most two pins and always one card from the rotation', () => {
    const pins = ['s01', 's02', 's03', 's04'].map((id, i) => pin({ id: `h${i}`, kind: 'holiday', priority: i, target: { type: 'story', id } }));
    const cards = startSet({ today: day, stories, read: NONE, pins });
    expect(cards.filter((c) => c.source === 'pin')).toHaveLength(2);
    expect(cards[2]!.source).toBe('rotation');
    expect(ids(cards).slice(0, 2)).toEqual(['s04', 's03']);
  });

  it('skips a pin whose story the mode hides, and shows a pin for a read story', () => {
    const hidden = startSet({ today: day, stories: stories.filter((s) => s.id !== 's01'), read: NONE, pins: [pin({ id: 'a' })] });
    expect(hidden.some((c) => c.source === 'pin')).toBe(false);
    expect(hidden).toHaveLength(3);
    const read = startSet({ today: day, stories, read: new Set(['s01']), pins: [pin({ id: 'a' })] });
    expect(ids(read)[0]).toBe('s01');
    expect(ids(read).filter((id) => id === 's01')).toHaveLength(1);
  });

  it('does not rotate a story that is pinned', () => {
    for (let p = 0; p < 40; p++) {
      const cards = startSet({ today: addDays(day, p * PERIOD_DAYS), stories, read: NONE, pins: [pin({ id: 'a', from: '2030-01-01', to: '2031-12-31', target: { type: 'story', id: 's05' } })] });
      expect(ids(cards).filter((id) => id === 's05')).toHaveLength(1);
      expect(cards[0]!.source).toBe('pin');
    }
  });

  it('pins a page that is not a story', () => {
    const page: Pin = pin({ id: 'h', kind: 'holiday', target: { type: 'page', href: '/pt/festa/', title: label('t'), hook: label('h') } });
    const cards = startSet({ today: day, stories, read: NONE, pins: [page] });
    expect(cards[0]).toMatchObject({ source: 'pin', target: { type: 'page', href: '/pt/festa/' } });
    expect(cards).toHaveLength(3);
  });

  it('a holiday that stands for a story takes the anniversary of that story and the rotation leaves the story out', () => {
    for (let p = 0; p < 20; p++) {
      const d = addDays(day, p * PERIOD_DAYS);
      const holiday: Pin = pin({ id: 'h', kind: 'holiday', covers: 's01', from: d, to: d, target: { type: 'page', href: '/ru/festa/x/', title: label('t'), hook: label('h') } });
      const cards = startSet({ today: d, stories, read: NONE, pins: [pin({ id: 'a', from: d, to: d, target: { type: 'story', id: 's01' } }), holiday] });
      expect(cards).toHaveLength(3);
      expect(cards[0]).toMatchObject({ source: 'pin', target: { type: 'page' } });
      expect(cards.slice(1).every((c) => c.source === 'rotation')).toBe(true);
      expect(ids(cards)).not.toContain('s01');
    }
  });

  it('keeps the anniversary of the story while the holiday is not in its window', () => {
    const holiday: Pin = pin({ id: 'h', kind: 'holiday', covers: 's01', from: addDays(day, 1), to: addDays(day, 3), target: { type: 'page', href: '/ru/festa/x/', title: label('t'), hook: label('h') } });
    const cards = startSet({ today: day, stories, read: NONE, pins: [pin({ id: 'a', target: { type: 'story', id: 's01' } }), holiday] });
    expect(ids(cards)[0]).toBe('s01');
  });

  it('a covered anniversary does not use up the one anniversary of another story', () => {
    const holiday: Pin = pin({ id: 'h', kind: 'holiday', covers: 's01', target: { type: 'page', href: '/ru/festa/x/', title: label('t'), hook: label('h') } });
    const cards = startSet({ today: day, stories, read: NONE, pins: [pin({ id: 'a1', target: { type: 'story', id: 's01' } }), pin({ id: 'a2', target: { type: 'story', id: 's02' } }), holiday] });
    expect(ids(cards).slice(0, 2)).toEqual(['/ru/festa/x/', 's02']);
  });

  it('compares sets by their cards and lines', () => {
    const a = startSet({ today: day, stories, read: NONE, pins: [pin({ id: 'a', label: label('x') })] });
    const b = startSet({ today: day, stories, read: NONE, pins: [pin({ id: 'a', label: label('y') })] });
    expect(setKey(a)).not.toBe(setKey(b));
    expect(setKey(a)).toBe(setKey(startSet({ today: day, stories, read: NONE, pins: [pin({ id: 'a', label: label('x') })] })));
  });
});

describe('anniversaryPins', () => {
  const st = (over: Partial<StartStory> & { id: string }): StartStory => ({ epoch: 'e', sensitive: false, ...over });

  it('makes a one-day pin with the line of each language', () => {
    const [p] = anniversaryPins([st({ id: 'a', year: 1877, day: '11-04' })], 2030);
    expect(p).toMatchObject({ kind: 'anniversary', from: '2030-11-04', to: '2030-11-04', target: { type: 'story', id: 'a' } });
    expect(p!.label).toEqual({ pt: 'Neste dia, em 1877', en: 'On this day in 1877', ru: 'В этот день в 1877 году' });
  });

  it('skips stories without a day, before the common era, of a heavy topic, and 29 February in a common year', () => {
    const list = [st({ id: 'none', year: 1900 }), st({ id: 'bc', year: -139, day: '06-01' }), st({ id: 'heavy', year: 1755, day: '11-01', sensitive: true }), st({ id: 'leap', year: 1600, day: '02-29' })];
    expect(anniversaryPins(list, 2030)).toEqual([]);
    expect(anniversaryPins(list, 2032).map((p) => p.id)).toEqual(['anniversary:leap']);
    expect(isCalendarDay(2030, '02-29')).toBe(false);
    expect(isCalendarDay(2032, '02-29')).toBe(true);
  });

  it('puts the anniversary of the day first through pinsFor', () => {
    const stories = [...pool(20, 5), st({ id: 'bridge', epoch: 'e1', year: 1877, day: '11-04' })];
    const cards = startSet({ today: '2030-11-04', stories, read: NONE, pins: pinsFor(stories, 2030) });
    expect(cards[0]).toMatchObject({ source: 'pin', target: { id: 'bridge' } });
    expect(startSet({ today: '2030-11-05', stories, read: NONE, pins: pinsFor(stories, 2030) }).some((c) => c.source === 'pin')).toBe(false);
  });

  it('gives one anniversary a day: the candidates by id, the index is the year modulo their number', () => {
    const same = [st({ id: 'b', year: 1511, day: '07-25' }), st({ id: 'a', year: 1581, day: '07-25' }), st({ id: 'c', year: 1500, day: '07-26' })];
    const pick = (year: number) => anniversaryPins(same, year).filter((p) => p.from.endsWith('07-25')).map((p) => p.target);
    expect(pick(2030)).toEqual([{ type: 'story', id: 'a' }]);
    expect(pick(2031)).toEqual([{ type: 'story', id: 'b' }]);
    expect(pick(2032)).toEqual(pick(2030));
    expect(anniversaryPins(same, 2030)).toHaveLength(2);
  });

  it('shows at most one anniversary even when two pins of the kind are passed, and leaves the second pin to a holiday', () => {
    const stories = pool(20, 5);
    const day = '2030-05-10';
    const a = (id: string, target: string) => pin({ id, from: day, to: day, target: { type: 'story', id: target } });
    const two = startSet({ today: day, stories, read: NONE, pins: [a('a1', 's01'), a('a2', 's02')] });
    expect(two.filter((c) => c.source === 'pin')).toHaveLength(1);
    const withHoliday = startSet({ today: day, stories, read: NONE, pins: [a('a1', 's01'), a('a2', 's02'), pin({ id: 'h', kind: 'holiday', from: day, to: day, target: { type: 'story', id: 's03' } })] });
    expect(withHoliday.filter((c) => c.source === 'pin').map((c) => c.kind)).toEqual(['holiday', 'anniversary']);
  });
});
