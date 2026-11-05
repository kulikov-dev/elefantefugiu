// The personal panel of an epoch (docs/spec.md 5.2): the epoch's own picture cut in cols x rows tiles (the `panno` field of the epoch). A tile shows its
// part of the picture when it is "won", a smooth glazed tile when it is not. The share of the tiles won equals the share of the stories read, and the
// tiles open always in the same order for an epoch. Pure helpers, so the rules run in plain unit tests; src/scripts/read-marks.ts draws the panel.
import { isVisibleInMode, type FamilyMode } from './family';
import type { StoryOnPage } from './read-marks';

/** A 32-bit seed from a string (FNV-1a). */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** A small seeded generator (mulberry32): the same seed gives the same numbers in every browser and in the build. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The order the tiles open in: a fixed permutation of all tiles (index = row * cols + column), seeded by the id of the epoch. The same on every
 * load, and the order never changes: with one more story read the same tiles stay open and new ones are added.
 */
export function openOrder(epochId: string, pieces: number): number[] {
  const order = Array.from({ length: pieces }, (_, i) => i);
  const next = random(seedOf(epochId));
  for (let i = pieces - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return order;
}

/** How many of `pieces` tiles are open when n of m stories are read. */
export function openPieces(n: number, m: number, pieces: number): number {
  if (m <= 0) return 0;
  return Math.round((pieces * Math.min(Math.max(n, 0), m)) / m);
}

/** The tiles open for that count: the first of the order. */
export const openSet = (n: number, m: number, order: readonly number[]): ReadonlySet<number> => new Set(order.slice(0, openPieces(n, m, order.length)));

/** The id of the first story, in the order of the page, that the mode shows and the reader has not read; none when all are read. */
export function firstUnread(onPage: readonly StoryOnPage[], read: readonly string[], mode: FamilyMode): string | undefined {
  const done = new Set(read);
  return onPage.find((story) => story.id && isVisibleInMode(story, mode) && !done.has(story.id))?.id;
}
