import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildToday } from '../../src/lib/publication.mjs';
import type { EventData } from '../../src/lib/events';
import { FAMILY_MODES, isSurpriseAllowed } from '../../src/lib/family';
import { MAX_GAP, MAX_RUN, MIN_GAP, ROUGH_GAP, ROUND_SIZE, allowedIn, between, canPair, earlier, gapBetween, hasTwoYears, isRoughDate, makeRound, orderBand, seeded, type OrderStory } from '../../src/lib/order';
import { orderEntry, orderEvents, orderExclusion } from '../../src/lib/order-build';
import { ROUTES, pagePath } from '../../src/i18n/routes';

const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const today = buildToday();
const tomorrow = addDays(today, 1);

/** A story of a small made-up world (the published, the queued, the draft). Written as the data files are: three languages. */
const story = (id: string, extra: Record<string, unknown> = {}): EventData =>
  ({
    id,
    slug: { pt: `s-${id}`, en: `s-${id}`, ru: `s-${id}` },
    title: { pt: id, en: id, ru: id },
    epoch: 'e1',
    year: 1500,
    status: 'ready',
    published: addDays(today, -3),
    sensitive: false,
    min_age: 'all',
    ...extra,
  }) as unknown as EventData;

describe('the stories of the game are made of the data, without a list or a flag', () => {
  it('a story added to the data (nothing else changed) is in the list; a queued, a draft, a heavy and a prologue story are not; a story with two years in its label is, with the first year', () => {
    const world = [
      story('added'),
      story('queued', { published: tomorrow }),
      story('draft', { status: 'draft' }),
      story('heavy', { sensitive: true }),
      story('deep', { year: -150_000_000 }),
      story('two', { year: 1500, year_label: { pt: '1906 e 2020', en: '1906 and 2020', ru: '1906 и 2020' } }),
    ];
    expect(orderEvents(world).map((e) => e.id)).toEqual(['added', 'two']);
    expect(orderExclusion(world[3]!)).toBe('sensitive');
    expect(orderExclusion(world[4]!)).toBe('prologue');
    expect(orderExclusion(world[5]!)).toBeUndefined();
    const two = orderEntry(world[5]!, 'pt');
    expect(two.date).toBe('1500');
    expect(orderEntry(world[5]!, 'ru').date).toBe('1500');
  });

  it('the story added to the world gets into the pairs with a story of its time', () => {
    const world = [story('old', { year: 1400 }), story('new', { year: 1500 })];
    const list = orderEvents(world).map((e) => orderEntry(e, 'pt'));
    const round = makeRound(list, seeded(1));
    expect(round).toHaveLength(1);
    expect(round[0]!.a.id === 'old' || round[0]!.b.id === 'old').toBe(true);
  });

  it('writes a story down: the sort year, the date as shown, the address, the age label', () => {
    const e = story('x', { year: { from: 1700, to: 1750 }, min_age: '12', epoch: 'e2' });
    const entry = orderEntry(e, 'pt');
    expect(entry).toMatchObject({ id: 'x', year: 1725, from: 1700, to: 1750, date: '1700–1750', epoch: 'e2', minAge: '12', rough: true });
    expect(entry.href).toBe('/pt/historia/s-x/');
  });
});

describe('the precision of a date comes from the fields a story already has', () => {
  it('a period, "about", a century and "A or B" are rough; one year is not', () => {
    expect(isRoughDate(1850, 1850, [undefined])).toBe(false);
    expect(isRoughDate(1717, 1730, [])).toBe(true);
    expect(isRoughDate(1850, 1850, ['c. de 1850'])).toBe(true);
    expect(isRoughDate(104, 104, ['c. 104'])).toBe(true);
    expect(isRoughDate(1771, 1771, ['séc. XVIII'])).toBe(true);
    expect(isRoughDate(1771, 1771, [undefined, '18th century'])).toBe(true);
    expect(isRoughDate(1850, 1850, [undefined, undefined, 'около 1850 года'])).toBe(true);
    expect(isRoughDate(1782, 1782, ['1778 ou 1782'])).toBe(true);
    expect(isRoughDate(1782, 1782, ['1778 or 1782'])).toBe(true);
    expect(isRoughDate(1385, 1385, ['14 de agosto de 1385', 'August 14, 1385', '14 августа 1385'])).toBe(false);
    expect(isRoughDate(1922, 1922, ['30 de março – 17 de junho de 1922'])).toBe(false);
  });
  it('two years in one label are told apart', () => {
    expect(hasTwoYears(['1906 e 2020'])).toBe(true);
    expect(hasTwoYears([undefined, '1906 and 2020'])).toBe(true);
    expect(hasTwoYears([undefined, undefined, '1906 и 2020'])).toBe(true);
    expect(hasTwoYears(['séc. I (descobertas em 1771)', '1 de novembro de 1755'])).toBe(false);
  });
});

const entry = (id: string, from: number, to = from, extra: Partial<OrderStory> = {}): OrderStory => ({ id, title: id, href: `/${id}/`, year: Math.round((from + to) / 2), from, to, date: String(from), epoch: 'e', minAge: 'all', rough: from !== to, ...extra });

describe('the rules of a pair', () => {
  it('exact dates: at least 20 years apart, at most 400', () => {
    expect(canPair(entry('a', 1500), entry('b', 1519))).toBe(false);
    expect(canPair(entry('a', 1500), entry('b', 1500 + MIN_GAP))).toBe(true);
    expect(canPair(entry('a', 1500), entry('b', 1500 + MAX_GAP))).toBe(true);
    expect(canPair(entry('a', 1500), entry('b', 1500 + MAX_GAP + 1))).toBe(false);
  });
  it('a rough date: at least 150 years from the nearest edge', () => {
    const period = entry('p', 1700, 1750);
    expect(gapBetween(period, entry('b', 1700))).toBe(0);
    expect(canPair(period, entry('b', 1750 + ROUGH_GAP - 1))).toBe(false);
    expect(canPair(period, entry('b', 1750 + ROUGH_GAP))).toBe(true);
    expect(canPair(entry('c', 1850, 1850, { rough: true }), entry('d', 1700))).toBe(true);
    expect(canPair(entry('c', 1850, 1850, { rough: true }), entry('d', 1750))).toBe(false);
  });
  it('the years between: exact for exact dates, "about" and rounded to ten for a rough one', () => {
    expect(between({ a: entry('a', 1500), b: entry('b', 1523) })).toEqual({ n: 23, rough: false });
    expect(between({ a: entry('a', 1500), b: entry('b', 1812, 1812, { rough: true }) })).toEqual({ n: 310, rough: true });
    expect(between({ a: entry('a', 1500), b: entry('b', 1700, 1730) })).toEqual({ n: 220, rough: true });
  });
  it('the first of a pair is the one with the smaller sort year', () => {
    expect(earlier({ a: entry('a', 1600), b: entry('b', 1500) }).id).toBe('b');
  });
});

describe('the captions of the result', () => {
  it('10 of 10, 7-9, 4-6, 0-3', () => {
    const bands = Array.from({ length: 11 }, (_, n) => orderBand(n, 10));
    expect(bands).toEqual(['low', 'low', 'low', 'low', 'mid', 'mid', 'mid', 'high', 'high', 'high', 'top']);
    expect(orderBand(0, 0)).toBe('low');
  });
});

// The stories of the data as the game takes them (Portuguese texts: always there).
const dir = join(process.cwd(), 'src/content/events');
const events = readdirSync(dir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(join(dir, f), 'utf8')) as EventData);
const list = orderEvents(events).map((e) => orderEntry(e, 'pt'));

describe('the rounds on the data of the site', () => {
  it('the data gives stories to play with', () => {
    expect(list.length, 'need: published stories that are not heavy and not of the prologue').toBeGreaterThan(ROUND_SIZE * 2);
  });

  for (const mode of FAMILY_MODES) {
    it(`family mode "${mode}": every round keeps all the rules of a pair (seeds 1-40)`, () => {
      const pool = allowedIn(list, mode);
      for (let seed = 1; seed <= 40; seed += 1) {
        const round = makeRound(pool, seeded(seed));
        expect(round.length).toBeLessThanOrEqual(ROUND_SIZE);
        const ids = round.flatMap((p) => [p.a.id, p.b.id]);
        expect(new Set(ids).size, 'a story twice in a round').toBe(ids.length);
        let run = 0;
        let last: string | null = null;
        for (const p of round) {
          const rough = p.a.rough || p.b.rough;
          expect(gapBetween(p.a, p.b)).toBeGreaterThanOrEqual(rough ? ROUGH_GAP : MIN_GAP);
          expect(Math.abs(p.a.year - p.b.year)).toBeLessThanOrEqual(MAX_GAP);
          expect(isSurpriseAllowed({ minAge: p.a.minAge, sensitive: false }, mode)).toBe(true);
          expect(isSurpriseAllowed({ minAge: p.b.minAge, sensitive: false }, mode)).toBe(true);
          const epoch = p.a.epoch === p.b.epoch ? p.a.epoch : null;
          run = epoch !== null && epoch === last ? run + 1 : epoch !== null ? 1 : 0;
          last = epoch;
          expect(run, 'more than three pairs of one epoch in a row').toBeLessThanOrEqual(MAX_RUN);
        }
      }
    });

    it(`family mode "${mode}": a round is full when the pool is wide enough, and the same seed gives the same round`, () => {
      const pool = allowedIn(list, mode);
      const a = makeRound(pool, seeded(7));
      expect(makeRound(pool, seeded(7))).toEqual(a);
      if (pool.length >= ROUND_SIZE * 3) expect(a.length, 'need: ten pairs in this mode').toBe(ROUND_SIZE);
    });
  }

  it('a pool too narrow for ten pairs gives a shorter round, an empty one gives none', () => {
    expect(makeRound([entry('a', 1500), entry('b', 1600), entry('c', 1700)], seeded(3))).toHaveLength(1);
    expect(makeRound([], seeded(3))).toEqual([]);
  });
});

describe('the address', () => {
  it('the three languages have their own addresses', () => {
    expect(ROUTES.order).toEqual({ pt: 'o-que-veio-primeiro', en: 'which-came-first', ru: 'chto-bylo-ranshe' });
    expect(pagePath('ru', 'order')).toBe('/ru/chto-bylo-ranshe/');
  });
});
