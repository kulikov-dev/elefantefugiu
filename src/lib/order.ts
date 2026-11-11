// "Which came first?" (docs/spec.md 5.9): the rules of the pairs, with no Astro imports. The list of stories is made at build time from the published stories
// (src/lib/order-data.ts, /{lang}/order.json); the pairs are drawn in the browser (src/scripts/order.ts) from that list. Nothing here is a hand-kept list.
import { isSurpriseAllowed, type FamilyMode } from './family';

/** A round is this many pairs; a narrow family mode may give fewer. */
export const ROUND_SIZE = 10;
/** Years between two exact dates at least; with a rough date (a century, "about", a period) at least ROUGH_GAP. At most MAX_GAP between the two years. */
export const MIN_GAP = 20;
export const ROUGH_GAP = 150;
export const MAX_GAP = 400;
/** No more than this many pairs in a row from one epoch (a pair of two different epochs breaks the run). */
export const MAX_RUN = 3;
/** A story that begins before this year (the prologue: millions of years make a pair too easy) is not in the game. */
export const DEEPEST_YEAR = -2000;

/** One story of the game as /{lang}/order.json holds it. */
export interface OrderStory {
  id: string;
  title: string;
  /** The thumbnail (a picture of the story, a decorative one: the title is next to it); `pos` is the focus of the crop. */
  img?: { src: string; srcset?: string; pos?: string };
  /** The page of the story. */
  href: string;
  /** The year the pair is sorted by: the year itself, the middle of a period. */
  year: number;
  /** The first and the last year of the story (the same for one year). */
  from: number;
  to: number;
  /** The line under the title: the hook, or `order_hint`; none when the hook gives the date away. */
  hint?: string;
  /** The small thumbnail for the plate under an answer (96 and 192 px). */
  thumb?: { src: string; srcset?: string };
  /** The date as the story shows it. */
  date: string;
  epoch: string;
  minAge: string;
  /** A century, "about", "A or B", a period: the date is not one exact year. */
  rough: boolean;
}

/** "c. 1850", "séc. XVIII", "1778 ou 1782", "about", "century", "век", "или": the label says the date is not exact. */
const ROUGH_LABEL = /(^|\s)(c\.|ca\.|около)\s|séc\.|centur|век|\sou\s|\sor\s|\sили\s/iu;
/** Two years in one label ("1906 e 2020"): the game shows the first one only. */
const TWO_YEARS = /\b\d{4}\b[^\d]*\s(e|and|и)\s[^\d]*\b\d{4}\b/u;

/** Is the date rough? A period, or a label of a century or of an approximate year, in any language. */
export const isRoughDate = (from: number, to: number, labels: readonly (string | undefined)[]): boolean => from !== to || labels.some((l) => l !== undefined && ROUGH_LABEL.test(l));

/** Is the label a pair of years (the game then shows the first year only)? */
export const hasTwoYears = (labels: readonly (string | undefined)[]): boolean => labels.some((l) => l !== undefined && TWO_YEARS.test(l));

/** The year a story is sorted by: the year, or the middle of a period. */
export const sortYear = (from: number, to: number): number => Math.round((from + to) / 2);

/** Years between the two periods (0 when they overlap). */
export const gapBetween = (a: Pick<OrderStory, 'from' | 'to'>, b: Pick<OrderStory, 'from' | 'to'>): number => Math.max(0, Math.max(a.from, b.from) - Math.min(a.to, b.to));

/** May the two stories be a pair? At least 20 years apart (150 with a rough date), at most 400 between the sort years. */
export function canPair(a: OrderStory, b: OrderStory): boolean {
  if (a.id === b.id) return false;
  const need = a.rough || b.rough ? ROUGH_GAP : MIN_GAP;
  return gapBetween(a, b) >= need && Math.abs(a.year - b.year) <= MAX_GAP;
}

/** The stories a family mode allows (a heavy topic never gets into the list; the age is checked here, like "Surprise me"). */
export const allowedIn = (list: readonly OrderStory[], mode: FamilyMode): OrderStory[] => list.filter((s) => isSurpriseAllowed({ minAge: s.minAge, sensitive: false }, mode));

export interface Pair {
  /** Left (above) and right (below), in the order shown. */
  a: OrderStory;
  b: OrderStory;
}

/** The epoch of a pair when both stories are of it, otherwise none (it breaks a run). */
export const pairEpoch = (p: Pair): string | null => (p.a.epoch === p.b.epoch ? p.a.epoch : null);

/** The story of the pair that came first. */
export const earlier = (p: Pair): OrderStory => (p.a.year <= p.b.year ? p.a : p.b);

/** The years between the two: exact for two exact dates, otherwise "about", rounded to ten. */
export function between(p: Pair): { n: number; rough: boolean } {
  const n = Math.abs(p.a.year - p.b.year);
  const rough = p.a.rough || p.b.rough;
  return { n: rough ? Math.round(n / 10) * 10 : n, rough };
}

/** A round of at most `size` pairs from the list: no story twice, the rules of canPair, no run of one epoch above MAX_RUN. The draw is greedy; a few tries, the longest round wins (a full one stops it). */
export function makeRound(list: readonly OrderStory[], random: () => number = Math.random, size: number = ROUND_SIZE): Pair[] {
  const all: [OrderStory, OrderStory][] = [];
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) if (canPair(list[i]!, list[j]!)) all.push([list[i]!, list[j]!]);
  let best: Pair[] = [];
  for (let attempt = 0; attempt < 40 && best.length < size; attempt += 1) {
    const used = new Set<string>();
    const round: Pair[] = [];
    let run = 0;
    let last: string | null = null;
    while (round.length < size) {
      const open = all.filter(([a, b]) => {
        if (used.has(a.id) || used.has(b.id)) return false;
        const epoch = a.epoch === b.epoch ? a.epoch : null;
        return !(epoch !== null && epoch === last && run >= MAX_RUN);
      });
      if (open.length === 0) break;
      const [x, y] = open[Math.min(open.length - 1, Math.floor(random() * open.length))]!;
      const pair: Pair = random() < 0.5 ? { a: x, b: y } : { a: y, b: x };
      used.add(x.id).add(y.id);
      const epoch = pairEpoch(pair);
      run = epoch !== null && epoch === last ? run + 1 : epoch !== null ? 1 : 0;
      last = epoch;
      round.push(pair);
    }
    if (round.length > best.length) best = round;
  }
  return best;
}

/** A generator that gives the same numbers for the same seed (mulberry32): for tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type OrderBand = 'low' | 'mid' | 'high' | 'top';

/** The caption of the result by the share of right answers: all (10 of 10), from 7 tenths (7-9), from 4 tenths (4-6), the rest (0-3). No score, no title of rank. */
export function orderBand(hits: number, total: number): OrderBand {
  const share = total > 0 ? hits / total : 0;
  return share >= 1 ? 'top' : share >= 0.7 ? 'high' : share >= 0.4 ? 'mid' : 'low';
}

/** The only event of the game the counter gets: the result screen is shown (a shared result sends nothing). */
export const ORDER_FINISH_EVENT = 'order-finish';

/** The round that is not finished (or just finished), kept in this browser only: the pairs, the pick of each (0 = the upper card, 1 = the lower, null = not answered yet), whether it was right, and the pair the reader is on. */
export const ORDER_GAME_KEY = 'order:game';
export interface OrderGame {
  pairs: [string, string][];
  picks: (0 | 1 | null)[];
  hits: (boolean | null)[];
  /** The pair on the screen; equal to the number of pairs when the round is over (the result is shown). */
  index: number;
}

/** What a round is saved as. */
export function toOrderGame(round: readonly Pair[], picks: readonly (0 | 1 | null)[], index: number): OrderGame {
  return {
    pairs: round.map((p) => [p.a.id, p.b.id]),
    picks: [...picks],
    hits: round.map((p, i) => (picks[i] === null || picks[i] === undefined ? null : (picks[i] === 0 ? p.a : p.b) === earlier(p))),
    index,
  };
}

export interface ResumedRound {
  round: Pair[];
  picks: (0 | 1 | null)[];
  index: number;
}

/**
 * What the browser holds, as a round over the stories of the list; anything else (broken, a story that is not on the site any more, one the family mode does not allow now, a pair that
 * breaks the rules of the pair) is nothing, so the page starts a new round without a word. `mode` is the family mode of the reader.
 */
export function parseOrderGame(raw: string | null, list: readonly OrderStory[], mode: FamilyMode): ResumedRound | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as Partial<OrderGame>;
    const { pairs, picks, index } = v;
    if (!Array.isArray(pairs) || !Array.isArray(picks) || pairs.length < 1 || pairs.length > ROUND_SIZE || picks.length !== pairs.length) return undefined;
    if (!Number.isInteger(index) || index! < 0 || index! > pairs.length) return undefined;
    const byId = new Map(allowedIn(list, mode).map((s) => [s.id, s]));
    const used = new Set<string>();
    const round: Pair[] = [];
    for (const raw of pairs) {
      if (!Array.isArray(raw) || raw.length !== 2) return undefined;
      const a = byId.get(String(raw[0]));
      const b = byId.get(String(raw[1]));
      if (!a || !b || used.has(a.id) || used.has(b.id) || !canPair(a, b)) return undefined;
      used.add(a.id).add(b.id);
      round.push({ a, b });
    }
    if (!picks.every((p) => p === null || p === 0 || p === 1)) return undefined;
    // The pairs before the one on the screen are answered; the one on the screen may be; the ones after are not.
    if (picks.some((p, i) => (i < index! ? p === null : i > index! ? p !== null : false))) return undefined;
    return { round, picks: picks as (0 | 1 | null)[], index: index! };
  } catch {
    return undefined;
  }
}
