// What the build gives the search index (docs/spec.md §3.11): the attributes of a story page and the places of the stories.
// The rules the interface needs in the browser are in search.ts.
import type { Lang } from '../i18n/routes';
import { formatYear, placeShort, type EventData } from './events';
import { ageInfoOf, FAMILY_MODES, isVisibleInMode } from './family';
import { SEARCH_META, type SearchMetaName, type SearchPlace } from './search';
import { placeSlug } from './timetravel';

/** Attributes for the element that carries the metadata of a story in the index. */
export function searchAttrs(event: EventData, lang: Lang): Record<string, string> {
  const short = placeShort(event.place, lang);
  const values: Record<SearchMetaName, string> = {
    hook: event.hook[lang],
    year: formatYear(event, lang),
    place: short,
    epoch: event.epoch,
    pkey: placeSlug(placeShort(event.place, 'pt')),
    age: String(event.min_age),
    sens: String(Boolean(event.sensitive)),
  };
  // The place key is a filter too: a query that names a place asks the index for the stories of that place first.
  const attrs: Record<string, string> = { 'data-pagefind-meta': SEARCH_META.map((name) => `${name}[data-pf-${name}]`).join(', '), 'data-pagefind-filter': 'pkey[data-pf-pkey]' };
  for (const name of SEARCH_META) attrs[`data-pf-${name}`] = values[name];
  return attrs;
}

/** The places of the published stories in a language, for the line "Show N stories <place> on the map". */
export function searchPlaces(events: readonly EventData[], lang: Lang): SearchPlace[] {
  const groups = new Map<string, SearchPlace>();
  for (const e of events) {
    const key = placeSlug(placeShort(e.place, 'pt'));
    if (!key) continue;
    const group = groups.get(key) ?? { key, name: placeShort(e.place, lang), n: { off: 0, all: 0, '12': 0 } };
    for (const mode of FAMILY_MODES) if (isVisibleInMode(ageInfoOf(e), mode)) group.n[mode] += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

