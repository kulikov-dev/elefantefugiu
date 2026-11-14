// Site search (docs/spec.md §3.11): the pure rules the interface needs, no DOM and no Astro imports (src/scripts/search-ui.ts and the map read it in the
// browser, so it imports nothing heavy). What the build needs (the attributes of the index, the places) is in search-index.ts.
import { normalizeFamilyMode, isVisibleInMode, type FamilyMode } from './family';

/** The query is searched from this many characters, after this pause (ms). */
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_DELAY_MS = 150;
/** The most results shown (no paging). */
export const SEARCH_MAX_RESULTS = 10;
/** How many raw results are read from the index: the family mode may hide some of them, the rest still fill the list. */
export const SEARCH_FETCH = 40;
/** The address parameter of the map that takes it to a place: `?place=<key>`. */
export const PLACE_PARAM = 'place';
/** The events of GoatCounter (no query text, ever). */
export const SEARCH_EVENT = 'search';
export const SEARCH_MAP_EVENT = 'search-map';

/** The metadata a story page gives the index (data-pf-*), read back as `meta.<name>` of a result. */
export const SEARCH_META = ['hook', 'year', 'place', 'epoch', 'pkey', 'age', 'sens'] as const;
export type SearchMetaName = (typeof SEARCH_META)[number];

/** A place a story is set at: the key is the one of the chips of "Through the centuries" (and of `?place=` of the map). */
export interface SearchPlace {
  key: string;
  name: string;
  /** How many stories are set there, by family mode (a place with none in the mode is not offered). */
  n: Record<FamilyMode, number>;
}

/** Lower case, no accents, no ё: the form a query and a place name are compared in. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

/** How much of the end of a name may differ from the query: "Лиссабоне", "Порту" for "Лиссабон", "Порту". */
const ENDING_MAX = 3;

/** Whether a query names a place: the start of the name ("Lis"), or the name with another ending ("Лиссабоне"). */
export function matchesPlace(query: string, name: string): boolean {
  const q = fold(query);
  const n = fold(name);
  if (q.length < 3 || n.length < 3) return false;
  if (n.startsWith(q)) return true;
  const stem = n.length >= 5 ? n.slice(0, n.length - 1) : n;
  return q.startsWith(stem) && q.length - stem.length <= ENDING_MAX;
}

/** The place the query names, with the most stories in the mode (none when no place has one there). */
export function placeForQuery(query: string, places: readonly SearchPlace[], mode: FamilyMode): SearchPlace | undefined {
  return places
    .filter((p) => p.n[mode] > 0 && matchesPlace(query, p.name))
    .sort((a, b) => b.n[mode] - a.n[mode])[0];
}

/** What a result of the index gives (the metadata of `searchAttrs`). */
export interface SearchHit {
  url: string;
  title: string;
  excerpt: string;
  hook: string;
  year: string;
  place: string;
  epoch: string;
  pkey: string;
  age: string;
  sens: string;
}

/** The hits the family mode lets through, at most `max`. */
export function visibleHits<T extends Pick<SearchHit, 'age' | 'sens'>>(hits: readonly T[], mode: unknown, max = SEARCH_MAX_RESULTS): T[] {
  const m = normalizeFamilyMode(mode);
  return hits.filter((h) => isVisibleInMode({ minAge: h.age, sensitive: h.sens === 'true' }, m)).slice(0, max);
}

/** The address of the map for a place, base path included in `base` (`/pt/mapa/`). */
export const mapPlaceLink = (base: string, key: string): string => `${base}?${PLACE_PARAM}=${encodeURIComponent(key)}`;

/** The place key of an address (`?place=sintra`), or null. */
export function placeFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(PLACE_PARAM);
  return value && /^[a-z0-9-]{1,60}$/.test(value) ? value : null;
}

/** A piece of a text for the results: the words of the query (and their forms) are marked. */
export interface Piece {
  text: string;
  mark: boolean;
}

/** The start of a query word that its forms share: "носорог" for "носорога", "лиссабо" for "Лиссабоне"; a short word is taken whole. */
function stemOf(word: string): string {
  const cut = word.length >= 7 ? 2 : word.length >= 6 ? 1 : 0;
  return word.slice(0, word.length - cut);
}

/** The text cut into pieces, a word that starts like a word of the query marked (accents and ё do not matter). */
export function highlight(text: string, query: string): Piece[] {
  const stems = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= SEARCH_MIN_CHARS)
    .map(stemOf);
  if (stems.length === 0 || !text) return [{ text, mark: false }];
  const pieces: Piece[] = [];
  let last = 0;
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const folded = fold(match[0]);
    if (!stems.some((stem) => folded.startsWith(stem))) continue;
    const at = match.index ?? 0;
    if (at > last) pieces.push({ text: text.slice(last, at), mark: false });
    pieces.push({ text: match[0], mark: true });
    last = at + match[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), mark: false });
  return pieces;
}

/**
 * The order of the results: the stories of the place the query names first (in the order the index ranks them), then the rest.
 * `ranked` is the plain search, `inPlace` the ids of the stories of the place.
 */
export function placeFirst<T extends { id: string }>(ranked: readonly T[], inPlace: readonly T[]): T[] {
  const ids = new Set(inPlace.map((r) => r.id));
  const rankedPlace = ranked.filter((r) => ids.has(r.id));
  const seen = new Set(rankedPlace.map((r) => r.id));
  return [...rankedPlace, ...inPlace.filter((r) => !seen.has(r.id)), ...ranked.filter((r) => !ids.has(r.id))];
}
