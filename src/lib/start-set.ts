// "Where to start" on the home page: which three cards to show on a day. One pure function (no Astro or DOM imports), used by the build
// (the day of the build, nothing read) and by the browser (the day in Lisbon, the read marks, the family mode), so both give the same answer
// when they know the same things. docs/STATE.md, "Витрина «С чего начать»".
//
// Rules: at most two pinned cards (a holiday, an anniversary), the rest comes from a rotation that changes every 3 days. The rotation is the
// same for everybody on a day: a seeded shuffle of the stories the mode shows, one story per epoch while there are epochs, unread stories first.
// The chosen cards of the rotation are shown by the year of the event, earliest first, after the pinned ones.
import type { Lang } from '../i18n/routes';

/** A text in each language of the site. */
export type Say = Record<Lang, string>;

export type PinTarget =
  | { type: 'story'; id: string }
  /** A page that is not a story (a holiday page with traditions): the card shows `title`, `hook` and `image` and leads to `href`. */
  | { type: 'page'; href: string; title: Say; hook: Say; image?: string };

/** A card that stays on top of the showcase in a window of days. */
export interface Pin {
  id: string;
  kind: 'anniversary' | 'holiday';
  /** The first and the last day of the window, YYYY-MM-DD, both included. */
  from: string;
  to: string;
  /** Among pins of the same kind the higher number goes first. */
  priority: number;
  /** The small line above the card. */
  label: Say;
  target: PinTarget;
}

/** What the function needs to know about a story. Only the stories the family mode shows are passed. */
export interface StartStory {
  id: string;
  epoch: string;
  sensitive: boolean;
  /** Year and day (MM-DD) of the event, for the anniversary. */
  year?: number;
  day?: string;
  /** First and last year of the event, the sort key of the epoch feed (`compareChronological`); the rotation is shown in this order. */
  span?: readonly [number, number];
}

export interface StartCardRef {
  /** `pin`: a pinned card; `rotation`: from the rotation. */
  source: 'pin' | 'rotation';
  target: PinTarget;
  /** The pin kind and the line above the card; both only on a pinned card. */
  kind?: Pin['kind'];
  label?: Say;
}

export interface StartInput {
  /** The day in Lisbon, YYYY-MM-DD. */
  today: string;
  stories: readonly StartStory[];
  read: ReadonlySet<string>;
  pins: readonly Pin[];
  /** How many cards. */
  count?: number;
}

export const START_COUNT = 3;
export const MAX_PINS = 2;
/** The rotation changes every this many days. */
export const PERIOD_DAYS = 3;
/** The day the periods are counted from. Any fixed day does; do not change it (every reader's showcase would change at once). */
export const PERIOD_ORIGIN = '2026-01-01';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

/** The number of the period of a day: 0 for the first 3 days from PERIOD_ORIGIN, negative before it. */
export const periodOf = (today: string): number => Math.floor((dayNumber(today) - dayNumber(PERIOD_ORIGIN)) / PERIOD_DAYS);

/** A small seeded generator (mulberry32): the same seed gives the same numbers in Node and in a browser. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The pool in the order of the period: sorted by id first, so the input order does not matter, then shuffled with the number of the period as the seed. */
export function shuffledPool<T extends { id: string }>(pool: readonly T[], period: number): T[] {
  const list = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const random = seeded(Math.imul(period + 1, 0x9e3779b1));
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

/**
 * `count` stories of the rotation. Unread stories first, in the order of the period, each from an epoch not yet taken; when the epochs run out,
 * more unread stories; when unread stories run out, read ones (again from new epochs first). `exclude` are ids that are pinned.
 */
export function rotation(pool: readonly StartStory[], period: number, read: ReadonlySet<string>, count: number, exclude: ReadonlySet<string> = new Set()): StartStory[] {
  const order = shuffledPool(pool.filter((s) => !s.sensitive && !exclude.has(s.id)), period);
  const picked: StartStory[] = [];
  const epochs = new Set<string>();
  const take = (list: readonly StartStory[], newEpochOnly: boolean) => {
    for (const story of list) {
      if (picked.length >= count) return;
      if (picked.includes(story) || (newEpochOnly && epochs.has(story.epoch))) continue;
      picked.push(story);
      epochs.add(story.epoch);
    }
  };
  const unread = order.filter((s) => !read.has(s.id));
  const done = order.filter((s) => read.has(s.id));
  take(unread, true);
  take(unread, false);
  take(done, true);
  take(done, false);
  return picked.sort(byYear);
}

/** Chronological, as in the epoch feed: first year, last year, id. A story without a span keeps its place after the ones with one. */
function byYear(a: StartStory, b: StartStory): number {
  if (!a.span || !b.span) return a.span ? -1 : b.span ? 1 : 0;
  return a.span[0] - b.span[0] || a.span[1] - b.span[1] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

const targetKey = (target: PinTarget): string => (target.type === 'story' ? `story:${target.id}` : `page:${target.href}`);
const kindRank = (kind: Pin['kind']): number => (kind === 'holiday' ? 1 : 0);

/**
 * The pins that show on `today`, best first: a holiday before an anniversary, then by priority, then by id. A pin whose story is not among `stories`
 * (hidden in the mode, or not published) is skipped; a story pinned twice (a holiday and an anniversary) keeps the better pin, so the holiday's line.
 */
export function activePins(pins: readonly Pin[], today: string, stories: readonly StartStory[]): Pin[] {
  const known = new Set(stories.map((s) => s.id));
  const best = new Map<string, Pin>();
  const better = (a: Pin, b: Pin): boolean => (kindRank(a.kind) - kindRank(b.kind) || a.priority - b.priority) > 0;
  for (const pin of pins) {
    if (!DAY.test(pin.from) || !DAY.test(pin.to) || pin.from > today || pin.to < today) continue;
    if (pin.target.type === 'story' && !known.has(pin.target.id)) continue;
    const key = targetKey(pin.target);
    const had = best.get(key);
    if (!had || better(pin, had)) best.set(key, pin);
  }
  const sorted = [...best.values()].sort((a, b) => kindRank(b.kind) - kindRank(a.kind) || b.priority - a.priority || (a.id < b.id ? -1 : 1));
  // One anniversary at most: the second pin is left for a holiday.
  let anniversaries = 0;
  return sorted.filter((pin) => pin.kind !== 'anniversary' || ++anniversaries === 1);
}

/** The cards of the showcase, in order: the pins first, then the rotation. Fewer than `count` only when the pool is too small. */
export function startSet({ today, stories, read, pins, count = START_COUNT }: StartInput): StartCardRef[] {
  const chosen = activePins(pins, today, stories).slice(0, Math.min(MAX_PINS, count - 1));
  const cards: StartCardRef[] = chosen.map((pin) => ({ source: 'pin', target: pin.target, kind: pin.kind, label: pin.label }));
  const pinned = new Set(chosen.flatMap((pin) => (pin.target.type === 'story' ? [pin.target.id] : [])));
  for (const story of rotation(stories, periodOf(today), read, count - cards.length, pinned)) cards.push({ source: 'rotation', target: { type: 'story', id: story.id } });
  return cards;
}

/** The ids of the stories of a set of cards, in order (the set compared with the one on the page). */
export const setKey = (cards: readonly StartCardRef[]): string => cards.map((c) => `${c.source}:${targetKey(c.target)}:${c.label?.en ?? ''}`).join('|');

/** The set with `fallback` (the ids of featured.yaml) filling the places a too small pool left empty. */
export function withFallback(cards: readonly StartCardRef[], fallback: readonly string[], count = START_COUNT): StartCardRef[] {
  const list = [...cards];
  for (const id of fallback) {
    if (list.length >= count) break;
    if (!list.some((c) => c.target.type === 'story' && c.target.id === id)) list.push({ source: 'rotation', target: { type: 'story', id } });
  }
  return list;
}
