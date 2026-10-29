// "Read" marks (docs/spec.md 5.x): the ids of the stories whose end the reader has seen, kept in the browser only (localStorage, one key,
// an array of ids). Pure helpers, so the rules run in plain unit tests; src/scripts/read-marks.ts does the storage and the page.
import { isVisibleInMode, type AgeInfo, type FamilyMode } from './family';

export const READ_KEY = 'readStories';
/** More than this many ids is more stories than the site has; the oldest are dropped, so the key can never grow without end. */
export const READ_LIMIT = 500;
/** A story is marked read when its end has been seen and the page has been open this long with the tab in view. */
export const READ_DELAY_MS = 20_000;

/** The saved value as a list of ids: anything that is not an array of strings is "nothing read". */
export function parseRead(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 120))].slice(-READ_LIMIT);
  } catch {
    return [];
  }
}

/** The list with `id` added at the end (once); the oldest ids go when the limit is passed. */
export function addRead(list: readonly string[], id: string): string[] {
  if (!id) return [...list];
  return [...list.filter((x) => x !== id), id].slice(-READ_LIMIT);
}

export interface StoryOnPage extends AgeInfo {
  id: string;
}

/**
 * "Read N of M" for the stories of a page: only those the family mode shows count, both in M and in N, and a story listed twice counts once.
 */
export function readProgress(onPage: readonly StoryOnPage[], read: readonly string[], mode: FamilyMode): { n: number; m: number } {
  const done = new Set(read);
  const shown = new Map<string, StoryOnPage>();
  for (const story of onPage) if (story.id && isVisibleInMode(story, mode)) shown.set(story.id, story);
  return { n: [...shown.keys()].filter((id) => done.has(id)).length, m: shown.size };
}
