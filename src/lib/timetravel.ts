// "Through the centuries" (docs/spec.md 5.4): the map plays the stories of its window one after another in the order of time.
// Pure helpers, no Leaflet, DOM or Astro imports, so the rules run in plain unit tests; src/scripts/timetravel.ts is the player.
import type { Lang } from '../i18n/routes';
import { placeShort, yearRange, yearsAgoText, type EventData } from './events';
import { meanwhileYearText } from './meanwhile';
import { cardsView, isInPortugal, isIsland, MAINLAND_VIEW } from './map-data';
import { inBounds, type Bounds } from './markers';

/** With fewer stories in the window there is nothing to play: the card says so and offers places instead. */
export const TT_MIN_STORIES = 3;
/** A place gets a chip when at least this many published stories are set there. */
export const TT_PLACE_MIN = 4;
/** The address parameter that starts the mode on arrival: `?era=lisboa`, `?era=portugal`. */
export const TT_PARAM = 'era';
/** The key of the chip "All of Portugal"; a place never has this key. */
export const TT_WHOLE = 'portugal';
/** The key of a start from the button (the current view, no place). */
export const TT_VIEW = 'view';
/** sessionStorage key of the state kept while a story is read, so "Back" lands on the same story. */
export const TT_SESSION_KEY = 'timetravel';

/** What the player needs of a story, besides the map card. */
export interface TtInfo {
  /** First and last year (the sort key of the epoch feed). */
  from: number;
  to: number;
  /** The year, short, as written on the site: "I в.", "1515", "140 до н. э." (`ttYear`). */
  year: string;
  /** The place key (a slug of the Portuguese short name), when the story is set somewhere. */
  place?: string;
}

export interface TtChip {
  key: string;
  name: string;
  count: number;
  /** The box the map shows for this place. */
  bounds: Bounds;
}

/** A key of a place that is the same in every language: "São Miguel" gives "sao-miguel". */
export function placeSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type TtEvent = Pick<EventData, 'id' | 'year' | 'year_scale' | 'years_ago' | 'place'>;

/**
 * The year of a story as the card and the scale write it, short: the `year_scale` of the data ("I в."), "150 million years ago", else the first year;
 * before the common era and in the first centuries with the era ("140 до н. э.", "AD 8"), never a bare "1".
 */
export function ttYear(event: Pick<EventData, 'year' | 'year_scale' | 'years_ago'>, lang: Lang): string {
  const own = event.year_scale?.[lang]?.trim();
  if (own) return own;
  if (event.years_ago) return yearsAgoText(event.years_ago, lang, 'scale');
  return meanwhileYearText(lang, yearRange(event)[0]);
}

/** The player data of a story in one language. */
export function ttInfoOf(event: TtEvent, lang: Lang): TtInfo {
  const [from, to] = yearRange(event);
  const key = placeSlug(placeShort(event.place, 'pt'));
  return {
    from,
    to,
    year: ttYear(event, lang),
    ...(key ? { place: key } : {}),
  };
}

/** Places with at least `min` stories, most stories first (then by name); each with the box around the points of its stories. */
export function placeChips(events: readonly (Pick<EventData, 'place' | 'bridge'>)[], lang: Lang, min = TT_PLACE_MIN): TtChip[] {
  const groups = new Map<string, { name: string; points: { lat: number; lon: number }[] }>();
  for (const e of events) {
    const key = placeSlug(placeShort(e.place, 'pt'));
    if (!key || key === TT_WHOLE || key === TT_VIEW) continue;
    const group = groups.get(key) ?? { name: placeShort(e.place, lang), points: [] };
    group.points.push({ lat: e.bridge.lat, lon: e.bridge.lon });
    groups.set(key, group);
  }
  return [...groups]
    .filter(([, g]) => g.points.length >= min)
    .map(([key, g]) => ({ key, name: g.name, count: g.points.length, bounds: cardsView(g.points, 0.15, 0.05) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface TtCard {
  id: string;
  lat: number;
  lon: number;
  epoch: string;
  threads: readonly string[];
  /** Set for a story whose place lies abroad (a hollow diamond on the map): it takes no part in the show. */
  overseas?: unknown;
}

/** The order of the epoch feed (start year, end year, id) across epochs: the epoch first, then the year. */
export function ttCompare(a: { id: string; epoch: string; from: number; to: number }, b: { id: string; epoch: string; from: number; to: number }, epochOrder: Readonly<Record<string, number>>): number {
  return (epochOrder[a.epoch] ?? 0) - (epochOrder[b.epoch] ?? 0) || a.from - b.from || a.to - b.to || a.id.localeCompare(b.id);
}

export interface PlaylistInput<C extends TtCard> {
  /** The cards the family mode shows. */
  cards: readonly C[];
  info: Readonly<Record<string, TtInfo>>;
  bounds: Bounds;
  /** The thread filter of the map (the epoch filter is off while the mode runs). */
  fio: string | null;
  epochOrder: Readonly<Record<string, number>>;
  /** Only the stories of this place (a start from a chip). */
  place?: string | null;
  /** The stories of Madeira and the Azores play too, though the window (the mainland) does not hold them. */
  islands?: boolean;
}

/** Does the window show the whole mainland (so that "all in order" means all of Portugal)? */
export const coversMainland = (b: Bounds): boolean => b.south <= 37.5 && b.north >= 41.5 && b.west <= -9 && b.east >= -7;

/** The stories to play (Portugal with the islands only): those whose point is in the window, passing the thread filter (and the place), in the order of time. */
export function playlist<C extends TtCard>(input: PlaylistInput<C>): C[] {
  return input.cards
    .filter((c) => input.info[c.id] !== undefined && !c.overseas && isInPortugal(c.lat, c.lon))
    .filter((c) => (inBounds(c, input.bounds) || (input.islands === true && isIsland(c.lat, c.lon))) && (input.fio === null || c.threads.includes(input.fio)) && (!input.place || input.info[c.id]!.place === input.place))
    .map((c) => ({ c, i: input.info[c.id]! }))
    .sort((a, b) => ttCompare({ id: a.c.id, epoch: a.c.epoch, from: a.i.from, to: a.i.to }, { id: b.c.id, epoch: b.c.epoch, from: b.i.from, to: b.i.to }, input.epochOrder))
    .map((x) => x.c);
}

/** The box of the chip "All of Portugal". */
export const WHOLE_BOUNDS: Bounds = MAINLAND_VIEW;

/** Runs of equal epochs along the list: the segments of the scale (each as long as its stories are many). */
export function epochRuns(epochs: readonly string[]): { epoch: string; count: number }[] {
  const runs: { epoch: string; count: number }[] = [];
  for (const epoch of epochs) {
    const last = runs[runs.length - 1];
    if (last && last.epoch === epoch) last.count += 1;
    else runs.push({ epoch, count: 1 });
  }
  return runs;
}

/**
 * The stories drawn on the map, as the range of indices [from, to] (empty when from > to): before the start none; while the show plays, the epoch of the
 * story on the screen from its first story up to it (a new epoch starts the picture from nothing, a rewind shows the epoch up to the chosen story);
 * at the end all of them.
 */
export function drawnRange(epochs: readonly string[], index: number, mode: 'none' | 'play' | 'all'): [number, number] {
  if (mode === 'none' || epochs.length === 0) return [0, -1];
  if (mode === 'all') return [0, epochs.length - 1];
  const at = Math.min(Math.max(index, 0), epochs.length - 1);
  let from = at;
  while (from > 0 && epochs[from - 1] === epochs[at]) from -= 1;
  return [from, at];
}

/** The index after a step, kept inside the list. */
export const stepIndex = (index: number, step: number, length: number): number => Math.min(Math.max(index + step, 0), Math.max(length - 1, 0));

/** "from 1498 to 1910" with the years as the site writes them; one year when both are the same. */
export function yearSpan(first: string, last: string, template: string): string {
  return first === last ? first : template.replace('{from}', first).replace('{to}', last);
}

/** The stories of the list the reader has not read, in the order of the list. */
export const unreadOf = <C extends { id: string }>(list: readonly C[], read: readonly string[]): C[] => {
  const done = new Set(read);
  return list.filter((c) => !done.has(c.id));
};

// ---- stories on the same spot -----------------------------------------------------------------------------------

export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
}

/**
 * Markers lying on one spot (closer than `same` pixels to the first of their group: stories of one square, of one building) are laid on a small
 * ring around the group's middle, `gap` pixels between neighbours, never wider than `maxRadius`, so each can be seen and pressed. All in pixels,
 * never in degrees. Groups do not chain: a row of markers each near the next is not one group. Returns the shift in pixels of the markers that move.
 */
export function spreadPoints(points: readonly ScreenPoint[], same = 6, gap = 14, maxRadius = 28): Map<string, { dx: number; dy: number }> {
  const groups: ScreenPoint[][] = [];
  for (const p of [...points].sort((a, b) => a.id.localeCompare(b.id))) {
    const home = groups.find((g) => Math.hypot(g[0]!.x - p.x, g[0]!.y - p.y) < same);
    if (home) home.push(p);
    else groups.push([p]);
  }
  const out = new Map<string, { dx: number; dy: number }>();
  for (const g of groups) {
    if (g.length < 2) continue;
    const cx = g.reduce((s, p) => s + p.x, 0) / g.length;
    const cy = g.reduce((s, p) => s + p.y, 0) / g.length;
    const radius = Math.min(Math.max(gap / (2 * Math.sin(Math.PI / g.length)), gap / 2), maxRadius);
    g.forEach((p, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / g.length;
      out.set(p.id, { dx: cx + radius * Math.cos(angle) - p.x, dy: cy + radius * Math.sin(angle) - p.y });
    });
  }
  return out;
}

/** The pan (in pixels, along y) that brings a point out from under a card whose top edge is `cardTop`; 0 when it is clear of it. */
export function panAboveCard(pointY: number, cardTop: number, margin: number): number {
  return pointY > cardTop - margin ? pointY - (cardTop - margin) : 0;
}

// ---- state kept while a story is read ------------------------------------------------------------------------------

export interface TtSession {
  id: string;
  /** The place key of the start, or "view". */
  src: string;
}

export function parseSession(raw: string | null | undefined): TtSession | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && typeof (v as TtSession).id === 'string' && typeof (v as TtSession).src === 'string') return { id: (v as TtSession).id.slice(0, 120), src: (v as TtSession).src.slice(0, 60) };
  } catch {
    // Not ours: nothing to resume.
  }
  return null;
}

// ---- counter events ----------------------------------------------------------------------------------------------------

/** The only two events of the mode: a start (with the place key, or "view") and a press of "Read" from the card. */
export const startEventPath = (src: string): string => `timetravel-start-${src}`;
export const READ_EVENT_PATH = 'timetravel-read';
