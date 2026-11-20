// Loads the content collections once per page build and applies the publishing rules.
// Thin wrapper (uses astro:content); the rules themselves are in the pure helpers of src/lib.
import { getCollection } from 'astro:content';
import { compareChronological, isPublished, type EventData } from './events';
import type { EpochData, ThreadData } from './epochs';
import { pickFeatured } from './home';
import { localize } from './localize';
import { visibleThreads } from './threads';
import { activeItems, type ActiveItem } from './cabinet';
import { isCabinetOpen } from './cabinet-config.mjs';
import { placePages, type PlaceData, type PlacePage } from './places';

export interface SiteData {
  /** Published events in chronological order. */
  events: EventData[];
  /** The published stories of the cabinet of rarities (the field `cabinet`): on their own pages only, in no list, so never in `events`. */
  cabinetStories: EventData[];
  /** The rarities of the cabinet that are on the site (host and story published), in the order of the file. */
  cabinet: ActiveItem[];
  /** Is the cabinet open in this build (src/lib/cabinet-config.mjs)? While not, there is no link to it, no hidden word and no sardine. */
  cabinetOpen: boolean;
  /** Every place of src/content/places.yaml. */
  places: PlaceData[];
  /** The places that have a page on the day of the build (three or more stories on the site), with their stories in time and their districts. */
  placePages: PlacePage<EventData>[];
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
  const published = (await getCollection('events')).map((e) => localize(e.data, e.data.ru_ready) as EventData).filter(isPublished).sort(compareChronological);
  // The stories of the cabinet are published at once and live apart: every list of the site takes `events`, which has none of them.
  const events = published.filter((e) => !e.cabinet);
  const cabinetStories = published.filter((e) => e.cabinet);
  const cabinet = activeItems((await getCollection('cabinet')).map((e) => e.data), new Map(published.map((e) => [e.id, e])), new Set(events.map((e) => e.id)));
  // `intro` is kept as written: localize() would fill a missing Russian text with the English one, and an introduction in another
  // language than the page is worse than none.
  const epochs = (await getCollection('epochs')).map((e) => ({ ...(localize({ ...e.data, intro: undefined }, true) as EpochData), intro: e.data.intro })).sort((a, b) => a.order - b.order);
  // The colour of a thread is a pair: the dot is lighter in the dark theme (light-dark() follows the theme of the page).
  const threads = (await getCollection('threads')).map((e) => {
    const thread = localize(e.data, true) as ThreadData;
    return { ...thread, color: `light-dark(${e.data.color}, ${e.data.color_dark})` };
  });
  const visible = visibleThreads(threads, events);
  const featuredIds = (await getCollection('featured')).sort((a, b) => (a.data.position ?? 0) - (b.data.position ?? 0)).map((e) => e.data.id);
  const places = (await getCollection('places')).map((e) => e.data as PlaceData);
  return { events, cabinetStories, places, placePages: placePages(places, events), cabinet, cabinetOpen: isCabinetOpen(), epochs, threads, featured: pickFeatured(featuredIds, events), visibleThreads: visible, visibleThreadIds: new Set(visible.map((t) => t.id)) };
}
