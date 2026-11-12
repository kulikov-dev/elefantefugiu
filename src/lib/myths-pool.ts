// The pool of "Myth or fact" (docs/spec.md 5.8): the claims of the stories, taken from the stories themselves. For pages; the rules of a round are in myths.ts.
import type { MythData } from '../data/schemas';
import { isPublished, type EventData } from './events';

/**
 * Every story that is on the site (the same function as for the sitemap and the feeds, with the day of `published`), is not a heavy topic (`sensitive`) and has a `myth` gives a claim.
 * The order is the order of `events` (chronological). A claim of a story of a later day is not here, so it is not in the HTML of a page either.
 * The id of the claim is its own `myth.id` (a claim that already has an address out in the world) or the id of the story.
 */
export function mythPool(events: readonly EventData[]): MythData[] {
  return events
    .filter((e) => e.myth !== undefined && !e.sensitive && isPublished(e))
    .map((e) => ({ ...e.myth!, id: e.myth!.id ?? e.id, story: e.id }));
}
