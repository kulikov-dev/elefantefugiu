import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { eventSchema, type MythData } from '../../src/data/schemas';
import { ROUTES, mythPath, pagePath } from '../../src/i18n/routes';
import type { EventData } from '../../src/lib/events';
import { mythPool } from '../../src/lib/myths-pool';
import { ANSWER_MAX_WORDS, ROUND_SIZE, STATEMENT_MAX_WORDS, answerEvent, answered, bandOf, fill, hitsOf, mythsInOrder, outcomeOf, parseBest, parseGame, pickRound, roundSizeOf, shuffled, squaresLine, withStatement, wordCount } from '../../src/lib/myths';

const myth = (id: string, story = `story-${id}`): MythData => ({ id, story, verdict: 'myth', statement: { pt: 'a', en: 'b', ru: 'в' }, answer: { pt: 'a', en: 'b', ru: 'в' } });

describe('rules', () => {
  it('counts words', () => {
    expect(wordCount('  Лифт Санта-Жушта   построил Эйфель ')).toBe(4);
    expect(wordCount('')).toBe(0);
  });

  it('makes the pool of the published stories that have a claim and are not a heavy topic; a story of a later day is not in it', () => {
    const day = (shift: number) => new Date(Date.now() + shift * 86_400_000).toISOString().slice(0, 10);
    const claim = (id?: string) => ({ ...(id ? { id } : {}), verdict: 'fact', statement: { pt: 'a', en: 'b', ru: 'в' }, answer: { pt: 'a', en: 'b', ru: 'в' } });
    const story = (id: string, extra: Record<string, unknown>) => ({ id, status: 'ready', published: day(-1), sensitive: false, ...extra }) as unknown as EventData;
    const events = [
      story('s-a', { myth: claim() }),
      story('s-b', { myth: claim('old-address') }),
      story('s-heavy', { myth: claim(), sensitive: true }),
      story('s-tomorrow', { myth: claim(), published: day(1) }),
      story('s-draft', { myth: claim(), status: 'draft' }),
      story('s-none', {}),
    ];
    expect(mythPool(events).map((m) => [m.id, m.story])).toEqual([
      ['s-a', 's-a'],
      ['old-address', 's-b'],
    ]);
  });

  it('puts the claim of the address first and keeps the order of the rest', () => {
    const list = [myth('a'), myth('b'), myth('c'), myth('d')];
    expect(mythsInOrder(list, 'c').map((m) => m.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(mythsInOrder(list).map((m) => m.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(mythsInOrder(list, 'nope').map((m) => m.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('fills a template with the statement and drops a mark at its end', () => {
    expect(withStatement('{statement}. Миф или правда?', 'Укулеле придумали на Гавайях')).toBe('Укулеле придумали на Гавайях. Миф или правда?');
    expect(withStatement('Миф или правда: {statement}?', 'Слон испугался носорога?')).toBe('Миф или правда: Слон испугался носорога?');
  });

  it('names the counter event of an answer', () => {
    expect(answerEvent('lello')).toBe('myth-lello');
  });
});

describe('the game', () => {
  it('counts a right guess, a wrong one and a "partly" claim', () => {
    expect(outcomeOf('myth', 'myth')).toBe('hit');
    expect(outcomeOf('fact', 'myth')).toBe('miss');
    expect(outcomeOf('part', 'fact')).toBe('part');
    expect(outcomeOf('part', 'myth')).toBe('part');
  });

  it('picks the caption by the share of right answers: 0-4, 5-7, 8-10 of ten', () => {
    const band = (n: number) => bandOf(n, 10);
    expect([0, 4].map(band)).toEqual(['low', 'low']);
    expect([5, 7].map(band)).toEqual(['mid', 'mid']);
    expect([8, 10].map(band)).toEqual(['high', 'high']);
    expect(bandOf(0, 0)).toBe('low');
  });

  it('writes the squares of a result for a message', () => {
    expect(squaresLine([true, false, true])).toBe('🟦⬜🟦');
  });

  it('fills the marks of a template and leaves an unknown one', () => {
    expect(fill('{score} of {total} {x}', { score: 7, total: 10 })).toBe('7 of 10 {x}');
  });

  it('shuffles into a copy with the same members', () => {
    const list = [1, 2, 3, 4, 5];
    const out = shuffled(list, () => 0);
    expect([...out].sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled(list, () => 0.5)).toHaveLength(5);
  });

  it('reads the best result only if it is whole and for a game of this length', () => {
    expect(parseBest('{"score":7,"total":10}', 10)).toEqual({ score: 7, total: 10 });
    expect(parseBest('{"score":7,"total":8}', 10)).toBeUndefined();
    expect(parseBest('{"score":11,"total":10}', 10)).toBeUndefined();
    expect(parseBest('nope', 10)).toBeUndefined();
    expect(parseBest(null, 10)).toBeUndefined();
  });
});

describe('addresses', () => {
  it('the page and the card have the pattern of the other service pages', () => {
    expect(ROUTES.myths).toEqual({ pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' });
    expect(pagePath('ru', 'myths')).toBe('/ru/mif-ili-pravda/');
    expect(mythPath('pt', 'lello')).toBe('/pt/mito-ou-verdade/lello/');
    expect(mythPath('en', 'lello')).toBe('/en/myth-or-fact/lello/');
  });
});

describe('the claims in the stories (src/content/events)', () => {
  const root = join(__dirname, '../..');
  const stories = readdirSync(join(root, 'src/content/events'))
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(join(root, 'src/content/events', f), 'utf8')))
    .filter((e) => e.myth);
  const claims = stories.map((e) => ({ ...e.myth, id: (e.myth.id ?? e.id) as string, story: e.id as string }) as MythData);

  it('has claims, with no id twice, and the claim is valid for the schema of a story', () => {
    expect(claims.length).toBeGreaterThan(0);
    expect(new Set(claims.map((m) => m.id)).size).toBe(claims.length);
    for (const e of stories) expect(eventSchema.safeParse(e).success, e.id).toBe(true);
  });

  it('never rests a claim on a heavy topic', () => {
    for (const e of stories) expect(e.sensitive, e.id).toBe(false);
  });

  it('keeps the texts within the limits in every language', () => {
    for (const m of claims)
      for (const lang of ['pt', 'en', 'ru'] as const) {
        expect(wordCount(m.statement[lang]), `${m.id} ${lang} statement`).toBeLessThanOrEqual(STATEMENT_MAX_WORDS);
        expect(wordCount(m.answer[lang]), `${m.id} ${lang} answer`).toBeLessThanOrEqual(ANSWER_MAX_WORDS);
      }
  });
});

describe('a round', () => {
  const pool = (myths: number, facts: number, parts = 0) => [
    ...Array.from({ length: myths }, (_, i) => ({ id: `m${i}`, verdict: 'myth' as const })),
    ...Array.from({ length: facts }, (_, i) => ({ id: `f${i}`, verdict: 'fact' as const })),
    ...Array.from({ length: parts }, (_, i) => ({ id: `p${i}`, verdict: 'part' as const })),
  ];
  /** A random() that walks, so every call differs, but a run is the same every time. */
  const seeded = (seed: number) => () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648;
  const count = (ids: string[], from: { id: string; verdict: string }[], verdict: string) => ids.filter((id) => from.find((m) => m.id === id)?.verdict === verdict).length;

  it('is ten claims, or all of them when the pool is smaller', () => {
    expect(roundSizeOf(40)).toBe(ROUND_SIZE);
    expect(pickRound(pool(20, 20), seeded(1))).toHaveLength(ROUND_SIZE);
    expect(pickRound(pool(3, 4), seeded(1)).sort()).toEqual(pool(3, 4).map((m) => m.id).sort());
    expect(pickRound([], seeded(1))).toEqual([]);
  });

  it('has no claim twice and only claims of the pool', () => {
    const from = pool(7, 9, 2);
    for (let seed = 1; seed <= 50; seed += 1) {
      const ids = pickRound(from, seeded(seed));
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => from.some((m) => m.id === id))).toBe(true);
    }
  });

  it('keeps at least three myths and three facts even when one kind is rare', () => {
    const from = pool(3, 30);
    for (let seed = 1; seed <= 100; seed += 1) {
      const ids = pickRound(from, seeded(seed));
      expect(count(ids, from, 'myth')).toBeGreaterThanOrEqual(3);
      expect(count(ids, from, 'fact')).toBeGreaterThanOrEqual(3);
    }
    const few = pool(2, 30);
    for (let seed = 1; seed <= 30; seed += 1) {
      const ids = pickRound(few, seeded(seed));
      expect(count(ids, few, 'myth'), 'all of the rare kind the pool has').toBe(2);
      expect(count(ids, few, 'fact')).toBeGreaterThanOrEqual(3);
    }
  });

  it('mixes the choice and the order', () => {
    const from = pool(20, 20);
    expect(new Set(Array.from({ length: 30 }, (_, i) => pickRound(from, seeded(i + 1)).join())).size).toBeGreaterThan(20);
  });

  it('avoids the claims of the last round while the pool allows, and repeats them when it does not', () => {
    const from = pool(12, 12);
    const first = pickRound(from, seeded(3));
    for (let seed = 1; seed <= 30; seed += 1) expect(pickRound(from, seeded(seed), first).filter((id) => first.includes(id))).toEqual([]);
    const small = pool(6, 6);
    const last = pickRound(small, seeded(4));
    const next = pickRound(small, seeded(5), last);
    expect(next).toHaveLength(ROUND_SIZE);
    expect(next.filter((id) => last.includes(id))).toHaveLength(ROUND_SIZE - 2);
    expect(count(next, small, 'myth')).toBeGreaterThanOrEqual(3);
  });

  it('puts the claim of the address first and counts it in the balance', () => {
    const from = pool(3, 30);
    for (let seed = 1; seed <= 30; seed += 1) {
      const ids = pickRound(from, seeded(seed), [], 'm1');
      expect(ids[0]).toBe('m1');
      expect(ids).toHaveLength(ROUND_SIZE);
      expect(count(ids, from, 'myth')).toBe(3);
    }
  });
});

describe('saved round', () => {
  const pool = Array.from({ length: 14 }, (_, i) => `c${i}`);
  const round = pool.slice(2, 12);
  const raw = (g: unknown) => JSON.stringify(g);
  const marks = (...head: (string | null)[]) => [...head, ...Array(ROUND_SIZE - head.length).fill(null)];

  it('reads a round of claims of the pool and counts it', () => {
    const game = parseGame(raw({ order: round, marks: marks('hit', 'part', null) }), pool);
    expect(game).toEqual({ order: round, marks: marks('hit', 'part', null) });
    expect(answered(game!)).toBe(2);
    expect(hitsOf(game!)).toBe(2);
  });

  it('reads a round of a small pool, which is the whole pool', () => {
    expect(parseGame(raw({ order: ['b', 'c', 'a'], marks: ['hit', 'part', null] }), ['a', 'b', 'c'])).toBeDefined();
  });

  it('drops the round when a story has left the pool, so a new round starts', () => {
    expect(parseGame(raw({ order: round, marks: marks() }), pool.filter((id) => id !== 'c5'))).toBeUndefined();
  });

  it('drops a round of another size, with a claim twice, with a broken mark or record', () => {
    expect(parseGame(raw({ order: round.slice(1), marks: marks().slice(1) }), pool)).toBeUndefined();
    expect(parseGame(raw({ order: [...round.slice(1), round[1]], marks: marks() }), pool)).toBeUndefined();
    expect(parseGame(raw({ order: round, marks: marks('wrong') }), pool)).toBeUndefined();
    expect(parseGame(raw({ order: round, marks: marks().slice(1) }), pool)).toBeUndefined();
    expect(parseGame('{broken', pool)).toBeUndefined();
    expect(parseGame(null, pool)).toBeUndefined();
  });
});
