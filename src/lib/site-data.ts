// Loads the content collections once per page build and applies the publishing rules.
// Thin wrapper (uses astro:content); the rules themselves are in the pure helpers of src/lib.
import { getCollection } from 'astro:content';
import { compareChronological, isPublished, type EventData } from './events';
import type { EpochData, ThreadData } from './epochs';
import { pickFeatured } from './home';
import { localize } from './localize';
import { visibleThreads } from './threads';

export interface SiteData {
  /** Published events in chronological order. */
  events: EventData[];
  /** All epochs in `order`. */
  epochs: EpochData[];
  threads: ThreadData[];
  /** Featured cards for the home page, in the order of featured.yaml (published ones only). */
  featured: EventData[];
  /** Threads with enough cards to have a page and to appear in filters and menus. */
  visibleThreads: ThreadData[];
  visibleThreadIds: Set<string>;
}

export async function loadSite(): Promise<SiteData> {
  // Every text object gets a `ru`: the Russian text of an event that is ru_ready, otherwise the English one (lib/localize.ts).
  // Epochs and threads have no flag: their Russian names are used where written, the English ones where not.
  const events = (await getCollection('events')).map((e) => localize(e.data, e.data.ru_ready) as EventData).filter(isPublished).sort(compareChronological);
  // `intro` is kept as written: localize() would fill a missing Russian text with the English one, and an introduction in another
  // language than the page is worse than none.
  const epochs = (await getCollection('epochs')).map((e) => ({ ...(localize({ ...e.data, intro: undefined }, true) as EpochData), intro: e.data.intro })).sort((a, b) => a.order - b.order);
  const threads = (await getCollection('threads')).map((e) => localize(e.data, true) as ThreadData);
  const visible = visibleThreads(threads, events);
  const featuredIds = (await getCollection('featured')).sort((a, b) => (a.data.position ?? 0) - (b.data.position ?? 0)).map((e) => e.data.id);
  return { events, epochs, threads, featured: pickFeatured(featuredIds, events), visibleThreads: visible, visibleThreadIds: new Set(visible.map((t) => t.id)) };
}
