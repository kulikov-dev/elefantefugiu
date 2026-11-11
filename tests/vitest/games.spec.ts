import { describe, expect, it } from 'vitest';
import { LANGS, RANKS, RANK_SEGMENT, ROUTES, rankPath } from '../../src/i18n/routes';
import { ORDER_GAME_KEY, earlier, parseOrderGame, toOrderGame, type OrderStory } from '../../src/lib/order';
import { verdictIcon } from '../../src/lib/verdict';
import { bandOf } from '../../src/lib/myths';
import { orderBand } from '../../src/lib/order';

const entry = (id: string, year: number, extra: Partial<OrderStory> = {}): OrderStory => ({ id, title: id, href: `/${id}/`, year, from: year, to: year, date: String(year), epoch: 'e', minAge: 'all', rough: false, ...extra });
const list = [entry('a', 1400), entry('b', 1500), entry('c', 1600), entry('d', 1700), entry('e', 1800), entry('old', 1900, { minAge: '12' })];
const pair = (x: string, y: string) => ({ a: list.find((s) => s.id === x)!, b: list.find((s) => s.id === y)! });

describe('the kept round of "Which came first?"', () => {
  const round = [pair('a', 'b'), pair('d', 'c')];
  const saved = (picks: (0 | 1 | null)[], index: number) => JSON.stringify(toOrderGame(round, picks, index));

  it('is saved with the pairs, the picks, whether each was right, and the pair on the screen', () => {
    const g = toOrderGame(round, [0, null], 1);
    expect(g.pairs).toEqual([['a', 'b'], ['d', 'c']]);
    expect(g.hits).toEqual([true, null]); // a (1400) came before b: the upper card was right
    expect(g.index).toBe(1);
    expect(earlier(round[1]!).id).toBe('c');
    expect(toOrderGame(round, [1, 0], 2).hits).toEqual([false, false]);
  });

  it('is read back as the same round: the pair on the screen, answered or not, and a finished round', () => {
    const mid = parseOrderGame(saved([0, null], 1), list, 'off')!;
    expect(mid.round.map((p) => [p.a.id, p.b.id])).toEqual([['a', 'b'], ['d', 'c']]);
    expect(mid.index).toBe(1);
    expect(parseOrderGame(saved([0, 1], 1), list, 'off')!.picks).toEqual([0, 1]); // answered, "Next" not pressed yet
    const done = parseOrderGame(saved([0, 1], 2), list, 'off')!;
    expect(done.index).toBe(2);
  });

  it('is nothing, so the page starts a new round, when a story is not in the list any more', () => {
    const raw = saved([0, null], 1);
    expect(parseOrderGame(raw, list.filter((s) => s.id !== 'c'), 'off')).toBeUndefined();
  });

  it('is nothing when the family mode does not allow a story of it now', () => {
    const withOld = JSON.stringify(toOrderGame([pair('e', 'old')], [null], 0));
    expect(parseOrderGame(withOld, list, 'off')).toBeDefined();
    expect(parseOrderGame(withOld, list, 'all')).toBeUndefined();
    expect(parseOrderGame(withOld, list, '12')).toBeDefined();
  });

  it('is nothing when it is broken: not JSON, empty, a pair that breaks the rules, a story twice, picks out of order', () => {
    expect(parseOrderGame(null, list, 'off')).toBeUndefined();
    expect(parseOrderGame('', list, 'off')).toBeUndefined();
    expect(parseOrderGame('{', list, 'off')).toBeUndefined();
    expect(parseOrderGame('[]', list, 'off')).toBeUndefined();
    expect(parseOrderGame(JSON.stringify({ pairs: [['a', 'a']], picks: [null], hits: [null], index: 0 }), list, 'off')).toBeUndefined();
    expect(parseOrderGame(JSON.stringify({ pairs: [['a', 'b'], ['b', 'c']], picks: [null, null], hits: [null, null], index: 0 }), list, 'off')).toBeUndefined();
    expect(parseOrderGame(JSON.stringify({ pairs: [['a', 'b']], picks: [2], hits: [null], index: 0 }), list, 'off')).toBeUndefined();
    expect(parseOrderGame(JSON.stringify({ pairs: [['a', 'b'], ['c', 'd']], picks: [null, 0], hits: [null, null], index: 1 }), list, 'off')).toBeUndefined(); // an earlier pair not answered
    expect(parseOrderGame(JSON.stringify({ pairs: [['a', 'b'], ['c', 'd']], picks: [0, 0], hits: [null, null], index: 0 }), list, 'off')).toBeUndefined(); // a later pair answered
    expect(parseOrderGame(JSON.stringify({ pairs: [['a', 'b']], picks: [null], hits: [null], index: 5 }), list, 'off')).toBeUndefined();
  });

  it('has a key of its own, not the one of the myths', () => {
    expect(ORDER_GAME_KEY).toBe('order:game');
    expect(ORDER_GAME_KEY).not.toBe('myths:game');
  });
});

describe('the pages of a shared result', () => {
  it('every game has the ranges its captions are made of, the same ids in every language', () => {
    expect(RANKS.myths).toEqual(['low', 'mid', 'high']);
    expect(RANKS.order).toEqual(['low', 'mid', 'high', 'top']);
    expect(bandOf(0, 10)).toBe('low');
    expect(RANKS.myths).toContain(bandOf(9, 12));
    expect(RANKS.order).toContain(orderBand(10, 10));
  });
  it('the addresses: ru zvanie, pt titulo, en rank, under the page of the game', () => {
    expect(RANK_SEGMENT).toEqual({ pt: 'titulo', en: 'rank', ru: 'zvanie' });
    expect(rankPath('ru', 'myths', 'high')).toBe('/ru/mif-ili-pravda/zvanie/high/');
    expect(rankPath('ru', 'order', 'top')).toBe('/ru/chto-bylo-ranshe/zvanie/top/');
    expect(rankPath('pt', 'order', 'mid')).toBe('/pt/o-que-veio-primeiro/titulo/mid/');
    expect(rankPath('en', 'myths', 'low')).toBe('/en/myth-or-fact/rank/low/');
  });
  it('the page "Games" has its own address in every language', () => {
    expect(ROUTES.games).toEqual({ pt: 'jogos', en: 'games', ru: 'igry' });
    expect(LANGS.every((l) => ROUTES.games[l] !== ROUTES.myths[l] && ROUTES.games[l] !== ROUTES.order[l])).toBe(true);
  });
});

describe('the label of a verdict', () => {
  it('has a shape of its own: a check, a cross, a half disc', () => {
    expect(verdictIcon('fact')).toContain('M5 8.3l2.2 2.2');
    expect(verdictIcon('myth')).toContain('M5.6 5.6l4.8 4.8');
    expect(verdictIcon('part')).toContain('M8 1.5a6.5');
    expect(verdictIcon('fact')).toContain('aria-hidden="true"');
  });
});
