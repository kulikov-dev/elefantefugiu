import { describe, expect, it } from 'vitest';
import { pannoSchema } from '../../src/data/schemas';
import { firstUnread, openOrder, openPieces, openSet } from '../../src/lib/panno';
import { readProgress, type StoryOnPage } from '../../src/lib/read-marks';

const story = (id: string, sensitive: unknown = false, minAge: unknown = 'all'): StoryOnPage => ({ id, minAge, sensitive });
const stories = (n: number): StoryOnPage[] => Array.from({ length: n }, (_, i) => story(`s${i + 1}`));
const ids = (list: StoryOnPage[]): string[] => list.map((s) => s.id);

const GRIDS = [
  { cols: 6, rows: 4 },
  { cols: 9, rows: 6 },
  { cols: 12, rows: 8 },
];
const piecesOf = (g: { cols: number; rows: number }): number => g.cols * g.rows;

describe('order of the tiles', () => {
  it('is every tile of the grid exactly once, for every grid', () => {
    for (const g of GRIDS) expect([...openOrder('some-epoch', piecesOf(g))].sort((a, b) => a - b)).toEqual(Array.from({ length: piecesOf(g) }, (_, i) => i));
  });

  it('is the same on every call for the same epoch (deterministic)', () => {
    for (const g of GRIDS) expect(openOrder('monarquia-e-republica', piecesOf(g))).toEqual(openOrder('monarquia-e-republica', piecesOf(g)));
  });

  it('differs between epochs and is not the plain reading order', () => {
    const a = openOrder('lusitania-e-roma', 54);
    expect(a).not.toEqual(openOrder('pombal-e-terramoto', 54));
    expect(a).not.toEqual(Array.from({ length: 54 }, (_, i) => i));
  });

  it('never closes a tile when one more story is read (monotone): k + 1 = the same tiles and new ones', () => {
    for (const g of GRIDS) {
      const order = openOrder('avis-e-descobrimentos', piecesOf(g));
      for (let m = 1; m <= 30; m++) {
        for (let n = 0; n < m; n++) {
          const now = openSet(n, m, order);
          const next = openSet(n + 1, m, order);
          for (const piece of now) expect(next.has(piece)).toBe(true);
          expect(next.size).toBeGreaterThanOrEqual(now.size);
        }
      }
    }
  });
});

describe('share of tiles open', () => {
  it.each(GRIDS)('$cols x $rows: 0 read none, some read the rounded share, all read every tile', (g) => {
    const total = piecesOf(g);
    expect(openPieces(0, 7, total)).toBe(0);
    expect(openPieces(3, 7, total)).toBe(Math.round((total * 3) / 7));
    expect(openPieces(7, 7, total)).toBe(total);
    expect(openPieces(5, 0, total)).toBe(0);
  });

  it.each(GRIDS)('$cols x $rows: all read and then a new story comes out: a few tiles close, never more than a share', (g) => {
    const total = piecesOf(g);
    const m = 11;
    const after = openPieces(m, m + 1, total);
    expect(after).toBeLessThan(total);
    expect(after).toBe(Math.round((total * m) / (m + 1)));
    const order = openOrder('uniao-restauracao-e-ouro-do-brasil', total);
    for (const piece of openSet(m, m + 1, order)) expect(openSet(m, m, order).has(piece)).toBe(true);
  });

  it('the count changes with the grid: 1 of 12 is 2 tiles on 6 x 4, 9 on 9 x 6 (rounded 4.5), 8 on 12 x 8', () => {
    expect(openPieces(1, 12, 24)).toBe(2);
    expect(openPieces(1, 12, 54)).toBe(5);
    expect(openPieces(1, 12, 96)).toBe(8);
  });

  it('is capped: more stories read than exist never opens more than the grid', () => {
    expect(openPieces(20, 12, 54)).toBe(54);
    expect(openPieces(-3, 12, 54)).toBe(0);
  });

  it('opens as many tiles as the share says', () => {
    const order = openOrder('pombal-e-terramoto', 96);
    expect(openSet(3, 7, order).size).toBe(openPieces(3, 7, 96));
  });
});

describe('states of the panel', () => {
  const m = 12;
  const all = stories(m);
  const state = (read: string[]) => {
    const { n, m: total } = readProgress(all, read, 'off');
    return { n, m: total, open: openPieces(n, total, 24), next: firstUnread(all, read, 'off') };
  };

  it('0 read: nothing open, the link leads to the first story', () => {
    expect(state([])).toEqual({ n: 0, m, open: 0, next: 's1' });
  });

  it('some read: part open, the link leads to the first story not read, in the order of the page', () => {
    expect(state(['s1', 's3'])).toEqual({ n: 2, m, open: 4, next: 's2' });
  });

  it('all read: the whole picture, no link', () => {
    expect(state(ids(all))).toEqual({ n: m, m, open: 24, next: undefined });
  });

  it('all read and then a new story comes out: some pieces close again, the link leads to the new story', () => {
    const grown: StoryOnPage[] = [...all, story('new')];
    const { n, m: total } = readProgress(grown, ids(all), 'off');
    expect(openPieces(n, total, 24)).toBeLessThan(24);
    expect(firstUnread(grown, ids(all), 'off')).toBe('new');
    const order = openOrder('e', 24);
    for (const piece of openSet(n, total, order)) expect(openSet(m, m, order).has(piece)).toBe(true);
  });

  it('counts only the stories the family mode shows', () => {
    const list: StoryOnPage[] = [story('a'), story('b', 'true'), story('c')];
    const { n, m: total } = readProgress(list, ['a'], 'all');
    expect([n, total]).toEqual([1, 2]);
    expect(firstUnread(list, ['a'], 'all')).toBe('c');
  });
});

describe('panno in the data of an epoch', () => {
  const ok = { image: 'roma.jpg', cols: 6, rows: 4 };
  it('accepts whole numbers of tiles from 4 to 14', () => {
    expect(pannoSchema.safeParse(ok).success).toBe(true);
    expect(pannoSchema.safeParse({ ...ok, cols: 14, rows: 14 }).success).toBe(true);
  });

  it('rejects fewer than 4, more than 14, fractions, and unknown fields', () => {
    expect(pannoSchema.safeParse({ ...ok, cols: 3 }).success).toBe(false);
    expect(pannoSchema.safeParse({ ...ok, rows: 15 }).success).toBe(false);
    expect(pannoSchema.safeParse({ ...ok, cols: 6.5 }).success).toBe(false);
    expect(pannoSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(pannoSchema.safeParse({ cols: 6, rows: 4 }).success).toBe(false);
  });
});
