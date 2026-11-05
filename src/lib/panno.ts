// The personal panel of an epoch (docs/spec.md 5.2): the epoch's picture cut in 6 x 4 pieces. A piece shows its part of the picture when it is
// "won", a smooth glazed tile when it is not. The share of the pieces won equals the share of the stories read, and the pieces open always in
// the same order. Pure helpers, so the rules run in plain unit tests; src/scripts/read-marks.ts draws the panel.
import { isVisibleInMode, type FamilyMode } from './family';
import type { StoryOnPage } from './read-marks';

export const GRID_COLS = 6;
export const GRID_ROWS = 4;
export const PIECES = GRID_COLS * GRID_ROWS;

/**
 * The order the pieces open in, by index (row * 6 + column): the middle 2 x 2 (a horizontal pair first), then the neighbours to the left and
 * right of it, then the pieces above and below the middle, the outer pieces of the middle rows, the rest of the top and bottom rows, the
 * corners. Every step is joined to the part already open, and the order never changes: more stories read only ever adds pieces.
 */
export const OPEN_ORDER: readonly number[] = [8, 9, 14, 15, 7, 10, 13, 16, 2, 3, 20, 21, 6, 11, 12, 17, 1, 4, 19, 22, 0, 5, 18, 23];

/** How many pieces are open when n of m stories are read. */
export function openPieces(n: number, m: number): number {
  if (m <= 0) return 0;
  return Math.round((PIECES * Math.min(Math.max(n, 0), m)) / m);
}

/** The pieces open for that count: the first of OPEN_ORDER. */
export const openSet = (n: number, m: number): ReadonlySet<number> => new Set(OPEN_ORDER.slice(0, openPieces(n, m)));

/** The id of the first story, in the order of the page, that the mode shows and the reader has not read; none when all are read. */
export function firstUnread(onPage: readonly StoryOnPage[], read: readonly string[], mode: FamilyMode): string | undefined {
  const done = new Set(read);
  return onPage.find((story) => story.id && isVisibleInMode(story, mode) && !done.has(story.id))?.id;
}
