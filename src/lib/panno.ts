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

const STARTS = 3;
/** How much more a tile with more open neighbours is wanted: weight = 1 + BIAS * (open neighbours - 1), so the spots grow dense, not stringy. */
const BIAS = 0.5;

/**
 * The order the tiles open in (index = row * cols + column): growth in spots, a fixed permutation of all tiles seeded by the id of the epoch. It
 * starts with three tiles that are not on the edge and far from each other; then every next tile is a random one from the neighbours (by side)
 * of the tiles already open, with a small preference for those that touch more open tiles. The same on every load, and the order never changes:
 * with one more story read the same tiles stay open and new ones are added.
 */
export function openOrder(epochId: string, cols: number, rows: number): number[] {
  const pieces = cols * rows;
  const next = random(seedOf(epochId));
  const isOpen = new Array<boolean>(pieces).fill(false);
  const order: number[] = [];
  const at = (x: number, y: number): number => y * cols + x;
  const take = (i: number): void => {
    isOpen[i] = true;
    order.push(i);
  };

  // Starts: inside the edge (when the grid has an inside), each the best of a few random tries by the distance to those already taken.
  const inner = Array.from({ length: pieces }, (_, i) => i).filter((i) => i % cols > 0 && i % cols < cols - 1 && Math.floor(i / cols) > 0 && Math.floor(i / cols) < rows - 1);
  const pool = inner.length >= STARTS ? inner : Array.from({ length: pieces }, (_, i) => i);
  const far = (i: number): number => Math.min(...order.map((o) => Math.abs((o % cols) - (i % cols)) + Math.abs(Math.floor(o / cols) - Math.floor(i / cols))));
  take(pool[Math.floor(next() * pool.length)] as number);
  while (order.length < Math.min(STARTS, pieces)) {
    let best = -1;
    for (let t = 0; t < 12; t++) {
      const c = pool[Math.floor(next() * pool.length)] as number;
      if (!isOpen[c] && (best < 0 || far(c) > far(best))) best = c;
    }
    if (best < 0) best = pool.find((c) => !isOpen[c]) ?? isOpen.indexOf(false);
    take(best);
  }

  const neighbours = (i: number): number[] => {
    const x = i % cols;
    const y = Math.floor(i / cols);
    const out: number[] = [];
    if (x > 0) out.push(at(x - 1, y));
    if (x < cols - 1) out.push(at(x + 1, y));
    if (y > 0) out.push(at(x, y - 1));
    if (y < rows - 1) out.push(at(x, y + 1));
    return out;
  };
  while (order.length < pieces) {
    const weights: { tile: number; w: number }[] = [];
    let sum = 0;
    for (let i = 0; i < pieces; i++) {
      if (isOpen[i]) continue;
      const touching = neighbours(i).filter((n) => isOpen[n]).length;
      if (touching === 0) continue;
      const w = 1 + BIAS * (touching - 1);
      weights.push({ tile: i, w });
      sum += w;
    }
    let pick = next() * sum;
    let chosen = (weights[weights.length - 1] as { tile: number }).tile;
    for (const c of weights) {
      pick -= c.w;
      if (pick < 0) {
        chosen = c.tile;
        break;
      }
    }
    take(chosen);
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

/** The key in localStorage (next to `readStories`, so the reset of the legal page sweeps it too) that says the finished panel of the epoch has been shown assembled. */
export const PANNO_CELEBRATED_PREFIX = 'panno-celebrated-';
export const pannoCelebratedKey = (epochId: string): string => `${PANNO_CELEBRATED_PREFIX}${epochId}`;

/** The pause between two tiles of the moment of assembly, and the most the whole row of tiles may take. */
export const CELEBRATION_STEP_MS = 120;
export const CELEBRATION_MAX_MS = 1500;
/** The rim of the colour of the epoch fades in this long after the last tile (the same number is `--panno-rim-fade` in tokens.css). */
export const CELEBRATION_RIM_MS = 300;

/**
 * The tiles the last story read opened: the ones that are open with m of m stories read and were not with m - 1, in the order they open in.
 * With one story in the panel that is every tile.
 */
export function lastOpened(m: number, order: readonly number[]): number[] {
  if (m <= 0) return [];
  return order.slice(openPieces(m - 1, m, order.length));
}

/** The pause between two of `count` tiles: 120 ms, less when the row would take more than 1.5 s in all. */
export function celebrationStep(count: number): number {
  if (count <= 0) return 0;
  return Math.min(CELEBRATION_STEP_MS, Math.floor(CELEBRATION_MAX_MS / count));
}

/**
 * The line at the foot of a story (docs/spec.md 5.2): shown when, with the story just counted, every story of its epoch that the mode shows is read
 * and the panel of the epoch has not been celebrated yet.
 */
export function showPannoLine(onEpoch: readonly StoryOnPage[], read: readonly string[], mode: FamilyMode, celebrated: boolean): boolean {
  if (celebrated) return false;
  const done = new Set(read);
  const shown = onEpoch.filter((s) => s.id && isVisibleInMode(s, mode));
  return shown.length > 0 && shown.every((s) => done.has(s.id));
}
