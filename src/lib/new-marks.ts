// "New since your last visit" (docs/STATE.md): the browser keeps when the reader was last here, and the stories published after the visit before
// this session carry a mark "New" until they are read. Pure helpers, so the rules run in plain unit tests; src/scripts/new-marks.ts does the
// storage and the page. Nothing is sent anywhere.
import { isVisibleInMode, type AgeInfo, type FamilyMode } from './family';

export const VISIT_KEY = 'lastVisit';
/** More than this since the last page of the reader: a new session, and the last visit becomes the one to compare with. */
export const SESSION_GAP_MS = 30 * 60 * 1000;

export interface Visit {
  /** The last page of the previous session: stories published after this day are new. null: no previous session (the first visit). */
  prev: number | null;
  /** The last page seen, in any session. null: never seen before. */
  last: number | null;
}

const time = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);

/** The saved value; anything that is not {prev, last} with times is "never here before". */
export function parseVisit(raw: string | null | undefined): Visit {
  if (!raw) return { prev: null, last: null };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return { prev: null, last: null };
    const { prev, last } = value as Record<string, unknown>;
    const l = time(last);
    return l === null ? { prev: null, last: null } : { prev: time(prev), last: l };
  } catch {
    return { prev: null, last: null };
  }
}

/** The visit after a page opened at `now`: a new session (more than SESSION_GAP_MS after the last page) moves `last` into `prev`; always `last` = now. */
export function advanceVisit(stored: Visit, now: number): Visit {
  if (stored.last === null) return { prev: null, last: now };
  const newSession = now - stored.last > SESSION_GAP_MS;
  return { prev: newSession ? stored.last : stored.prev, last: now };
}

/** The day (YYYY-MM-DD, UTC) of a time. */
export const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Was the story published (a day, YYYY-MM-DD) after the visit `prev`? No visit before: nothing is new. */
export const isNewSince = (published: string, prev: number | null): boolean => prev !== null && published > dayOf(prev);

export interface NewCandidate extends AgeInfo {
  id: string;
  epoch: string;
  published: string;
}

/** For every epoch, the day of its earliest story among those a family mode shows (the page carries it: BaseLayout). */
export type EpochFirsts = Record<string, Partial<Record<FamilyMode, string>>>;

/** The epochs that are new as a whole: every story the mode shows in them was published after the visit `prev`. */
export function newEras(firsts: EpochFirsts, prev: number | null, mode: FamilyMode): string[] {
  return Object.entries(firsts)
    .filter(([, byMode]) => {
      const first = byMode[mode];
      return first !== undefined && isNewSince(first, prev);
    })
    .map(([id]) => id);
}

/**
 * The new stories the mode shows and the reader has not read: all of them and per epoch (a story listed twice counts once), and `whole`: every
 * epoch that has one is a new epoch as a whole (then the home page speaks of epochs, not of stories).
 */
export function newCounts(
  stories: readonly NewCandidate[],
  read: readonly string[],
  prev: number | null,
  mode: FamilyMode,
  firsts: EpochFirsts = {},
): { total: number; byEpoch: Record<string, number>; eras: string[]; whole: boolean } {
  const done = new Set(read);
  const seen = new Set<string>();
  const byEpoch: Record<string, number> = {};
  for (const s of stories) {
    if (seen.has(s.id) || done.has(s.id) || !isNewSince(s.published, prev) || !isVisibleInMode(s, mode)) continue;
    seen.add(s.id);
    byEpoch[s.epoch] = (byEpoch[s.epoch] ?? 0) + 1;
  }
  const eras = newEras(firsts, prev, mode);
  const ids = Object.keys(byEpoch);
  return { total: seen.size, byEpoch, eras, whole: ids.length > 0 && ids.every((id) => eras.includes(id)) };
}
