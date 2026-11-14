// What the search interface reads on its first opening: /pt/search.json (src/pages/[lang]/search.json.ts). Pure, no Astro imports.
import { epochHref, pagePath, type Lang } from '../i18n/routes';
import { section } from '../i18n';
import { epochHasContent, type EpochData } from './epochs';
import type { EventData } from './events';
import type { SearchPlace } from './search';
import { searchPlaces } from './search-index';

export interface SearchData {
  /** The strings of the interface (`search.*` of the dictionary, plural forms included). */
  strings: Record<string, string>;
  /** The places of the stories: a query that names one offers the map. */
  places: SearchPlace[];
  /** The eras the empty result points to, the most told first. */
  epochs: { id: string; name: string; href: string }[];
  /** "Surprise me", the fourth link of the empty result. */
  surprise: { name: string; href: string };
  /** The map, base path included. */
  mapHref: string;
}

/** How many eras the empty result offers. */
export const SEARCH_EMPTY_EPOCHS = 3;

export function searchData(lang: Lang, events: readonly EventData[], epochs: readonly EpochData[], surpriseName: string): SearchData {
  const count = (e: EpochData) => events.filter((ev) => ev.epoch === e.id).length;
  const top = epochs
    .filter((e) => epochHasContent(e, events))
    .sort((a, b) => count(b) - count(a) || a.order - b.order)
    .slice(0, SEARCH_EMPTY_EPOCHS)
    .sort((a, b) => a.order - b.order);
  return {
    strings: section(lang, 'search'),
    places: searchPlaces(events, lang),
    epochs: top.map((e) => ({ id: e.id, name: e.name[lang], href: epochHref(lang, e.slug[lang]) })),
    surprise: { name: surpriseName, href: pagePath(lang, 'surprise') },
    mapHref: pagePath(lang, 'map'),
  };
}
