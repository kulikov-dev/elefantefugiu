import { describe, expect, it } from 'vitest';
import { firstUnread, GRID_COLS, OPEN_ORDER, openPieces, openSet, PIECES } from '../../src/lib/panno';
import { readProgress, type StoryOnPage } from '../../src/lib/read-marks';

const story = (id: string, sensitive: unknown = false, minAge: unknown = 'all'): StoryOnPage => ({ id, minAge, sensitive });
const stories = (n: number): StoryOnPage[] => Array.from({ length: n }, (_, i) => story(`s${i + 1}`));
const ids = (list: StoryOnPage[]): string[] => list.map((s) => s.id);

describe('order of the pieces', () => {
  it('is every piece of the grid exactly once', () => {
    expect([...OPEN_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: PIECES }, (_, i) => i));
  });

  it('starts with the middle 2 x 2, a horizontal pair first, then widens sideways', () => {
    expect(OPEN_ORDER.slice(0, 8)).toEqual([8, 9, 14, 15, 7, 10, 13, 16]);
  });

  it('joins every piece to the part already open (no piece alone, no diagonal start)', () => {
    const touches = (a: number, b: number): boolean => {
      const dx = Math.abs((a % GRID_COLS) - (b % GRID_COLS));
      const dy = Math.abs(Math.floor(a / GRID_COLS) - Math.floor(b / GRID_COLS));
      return dx + dy === 1;
    };
    OPEN_ORDER.forEach((piece, i) => {
      if (i === 0) return;
      expect(OPEN_ORDER.slice(0, i).some((other) => touches(piece, other)), `piece ${piece} at step ${i}`).toBe(true);
    });
  });

  it('is mirrored left to right in the pairs of the first rows', () => {
    for (let i = 0; i < 4; i += 2) expect((OPEN_ORDER[i] ?? 0) + (OPEN_ORDER[i + 1] ?? 0)).toBe(2 * Math.floor((OPEN_ORDER[i] ?? 0) / GRID_COLS) * GRID_COLS + GRID_COLS - 1);
  });
});

describe('share of pieces open', () => {
  it('is the share of the stories read, rounded to a piece', () => {
    expect(openPieces(0, 12)).toBe(0);
    expect(openPieces(1, 12)).toBe(2);
    expect(openPieces(3, 12)).toBe(6);
    expect(openPieces(12, 12)).toBe(PIECES);
    expect(openPieces(1, 7)).toBe(3);
    expect(openPieces(5, 0)).toBe(0);
    expect(openPieces(20, 12)).toBe(PIECES);
  });

  it('shows a horizontal pair in the middle for 1 of 12', () => {
    expect([...openSet(1, 12)].sort((a, b) => a - b)).toEqual([8, 9]);
  });

  it('never closes a piece when one more story is read', () => {
    for (let m = 1; m <= 40; m++) {
      for (let n = 0; n < m; n++) {
        const now = openSet(n, m);
        for (const piece of now) expect(openSet(n + 1, m).has(piece)).toBe(true);
      }
    }
  });
});

describe('states of the panel', () => {
  const m = 12;
  const all = stories(m);
  const state = (read: string[]) => {
    const { n, m: total } = readProgress(all, read, 'off');
    return { n, m: total, open: openPieces(n, total), next: firstUnread(all, read, 'off') };
  };

  it('0 read: nothing open, the link leads to the first story', () => {
    expect(state([])).toEqual({ n: 0, m, open: 0, next: 's1' });
  });

  it('some read: part open, the link leads to the first story not read, in the order of the page', () => {
    expect(state(['s1', 's3'])).toEqual({ n: 2, m, open: 4, next: 's2' });
  });

  it('all read: the whole picture, no link', () => {
    expect(state(ids(all))).toEqual({ n: m, m, open: PIECES, next: undefined });
  });

  it('all read and then a new story comes out: some pieces close again, the link leads to the new story', () => {
    const grown: StoryOnPage[] = [...all, story('new')];
    const { n, m: total } = readProgress(grown, ids(all), 'off');
    expect(openPieces(n, total)).toBeLessThan(PIECES);
    expect(openPieces(n, total)).toBeGreaterThan(PIECES - 3);
    expect(firstUnread(grown, ids(all), 'off')).toBe('new');
    // The pieces still open are a part of those that were: nothing jumps.
    for (const piece of openSet(n, total)) expect(openSet(m, m).has(piece)).toBe(true);
  });

  it('counts only the stories the family mode shows', () => {
    const list: StoryOnPage[] = [story('a'), story('b', 'true'), story('c')];
    const { n, m: total } = readProgress(list, ['a'], 'all');
    expect([n, total]).toEqual([1, 2]);
    expect(firstUnread(list, ['a'], 'all')).toBe('c');
  });
});
