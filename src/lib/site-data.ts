// Loads the content collections once per page build and applies the publishing rules.
// Thin wrapper (uses astro:content); the rules themselves are in the pure helpers of src/lib.
import { getCollection } from 'astro:content';
import { compareChronological, isPublished, type EventData } from './events';
import type { EpochData, ThreadData } from './epochs';
import { pickFeatured } from './home';
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
  const events = (await getCollection('events')).map((e) => e.data as EventData).filter(isPublished).sort(compareChronological);
  const epochs = (await getCollection('epochs')).map((e) => e.data as EpochData).sort((a, b) => a.order - b.order);
  const threads = (await getCollection('threads')).map((e) => e.data as ThreadData);
  const visible = visibleThreads(threads, events);
  const featuredIds = (await getCollection('featured')).map((e) => e.data.id);
  return { events, epochs, threads, featured: pickFeatured(featuredIds, events), visibleThreads: visible, visibleThreadIds: new Set(visible.map((t) => t.id)) };
}
