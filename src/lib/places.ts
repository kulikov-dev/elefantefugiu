// The pages of places (docs/spec.md, "Страницы мест"): which place a story belongs to, which places have a page, what the page says when
// nobody wrote its introduction, the titles for search. Pure functions, no Astro imports (tested in plain Node, read by scripts/schedule.mjs).
//
// A story belongs to the place `area` names, else to the SMALLEST circle (src/content/places.yaml: centre, radius) that holds the coordinates of
// its bridge, the place a reader goes to (the place of the event itself may be abroad). A district also stands on the page of its parent
// (Belém on the page of Lisboa). A place has a page when it has PLACE_MIN_STORIES stories on the site: the number is counted from the stories
// published that day, so a page appears with its third story and goes away, with its link and its line in the sitemap, if the number falls.
import { plural, t } from '../i18n';
import type { Lang } from '../i18n/routes';
import type { PlaceInput } from '../data/schemas';
import { distanceKm, yearRange, yearText } from './events';
import { cutAtWord } from './og-text';
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from './seo';

export type PlaceData = PlaceInput;

/** A place has a page from this many stories. */
export const PLACE_MIN_STORIES = 3;
/** The page "Nearby": at most this many places; a place further than NEAR_KM is nearby only when the data names it. */
export const MAX_NEIGHBOURS = 4;
export const NEAR_KM = 30;

/** What the place of a story is read from. */
export interface PlaceStory {
  id: string;
  area?: string | undefined;
  bridge: { lat: number; lon: number };
}

/** The place of a story: its `area` (an unknown id is ignored: check:data fails on it), else the smallest circle that holds the bridge, the nearest centre among equals. */
export function placeOf(story: PlaceStory, places: readonly PlaceData[]): PlaceData | undefined {
  if (story.area) {
    const named = places.find((p) => p.id === story.area);
    if (named) return named;
  }
  return places
    .map((p) => ({ place: p, km: distanceKm(story.bridge, p.center) }))
    .filter((c) => c.km <= c.place.radius_km)
    .sort((a, b) => a.place.radius_km - b.place.radius_km || a.km - b.km)[0]?.place;
}

/** The place and its parents, the smallest first. */
export function placeChain(place: PlaceData, places: readonly PlaceData[]): PlaceData[] {
  const chain: PlaceData[] = [];
  for (let p: PlaceData | undefined = place; p && !chain.includes(p); p = p.parent ? places.find((x) => x.id === p!.parent) : undefined) chain.push(p);
  return chain;
}

export interface PlacePage<S extends PlaceStory = PlaceStory> {
  place: PlaceData;
  /** The stories of the place and of its districts, in the order they were given (the site sorts them in time). */
  stories: S[];
  /** The districts that have a page of their own. */
  districts: PlacePage<S>[];
  /** The id of the smallest place each story belongs to (a story of Belém on the page of Lisboa: "belem"). */
  owner: Record<string, string>;
}

/** The places that have a page for these stories (the stories of one day: the caller keeps out the drafts, the queue and the cabinet). */
export function placePages<S extends PlaceStory>(places: readonly PlaceData[], stories: readonly S[], min = PLACE_MIN_STORIES): PlacePage<S>[] {
  const chains = stories.map((s) => {
    const place = placeOf(s, places);
    return { story: s, own: place?.id, ids: new Set(place ? placeChain(place, places).map((p) => p.id) : []) };
  });
  const pages = places
    .map((place) => ({ place, stories: chains.filter((c) => c.ids.has(place.id)).map((c) => c.story), districts: [] as PlacePage<S>[], owner: {} as Record<string, string> }))
    .filter((p) => p.stories.length >= min);
  for (const page of pages) {
    page.districts = pages.filter((d) => d.place.parent === page.place.id);
    for (const c of chains) if (c.ids.has(page.place.id) && c.own) page.owner[c.story.id] = c.own;
  }
  return pages;
}

/** The page a story links to ("More stories of ..."): the smallest place of its chain that has a page. */
export function pageOfStory<S extends PlaceStory>(story: PlaceStory, places: readonly PlaceData[], pages: readonly PlacePage<S>[]): PlacePage<S> | undefined {
  const place = placeOf(story, places);
  if (!place) return undefined;
  return placeChain(place, places).map((p) => pages.find((page) => page.place.id === p.id)).find((page) => page !== undefined);
}

/** The page of a point (the place where a story happened): the smallest place whose circle holds it and that has a page, else the page of its parent. The `area` of a story is about its bridge and is not used here. */
export function pageOfPoint<S extends PlaceStory>(point: { lat: number; lon: number }, places: readonly PlaceData[], pages: readonly PlacePage<S>[]): PlacePage<S> | undefined {
  return pageOfStory({ id: '', bridge: point }, places, pages);
}

/** "Nearby": the places that the data names, then the nearest ones (no further than NEAR_KM), never the parent or a district of the page itself. */
export function neighbourPages<S extends PlaceStory>(page: PlacePage<S>, pages: readonly PlacePage<S>[], max = MAX_NEIGHBOURS): PlacePage<S>[] {
  const others = pages.filter((p) => p.place.id !== page.place.id && p.place.id !== page.place.parent && p.place.parent !== page.place.id);
  const named = (page.place.neighbours ?? []).map((id) => others.find((p) => p.place.id === id)).filter((p): p is PlacePage<S> => p !== undefined);
  const near = others
    .filter((p) => !named.includes(p))
    .map((p) => ({ page: p, km: distanceKm(page.place.center, p.place.center) }))
    .filter((c) => c.km <= NEAR_KM)
    .sort((a, b) => a.km - b.km)
    .map((c) => c.page);
  return [...named, ...near].slice(0, max);
}

/** The pages of the top level (the index lists them; a district is listed under its city), the one with the most stories first, the names in order among equals. */
export const topPages = <S extends PlaceStory>(pages: readonly PlacePage<S>[], lang: Lang = 'pt'): PlacePage<S>[] =>
  pages
    .filter((p) => !p.place.parent || !pages.some((q) => q.place.id === p.place.parent))
    .sort((a, b) => b.stories.length - a.stories.length || a.place.name[lang].localeCompare(b.place.name[lang], lang));

// ---- the introduction ----

interface IntroStory extends PlaceStory {
  title: { [L in Lang]: string };
  year: number | { from: number; to: number };
  importance: 1 | 2 | 3;
}

/** The stories the generated introduction names and the preview picture shows. */
export const AUTO_TITLES = 3;

/**
 * The most important stories of a page (importance, then the order of the page), in the order of the page. A page with districts takes the best story of
 * each district first (a city shows its different parts, not three stories of one square); the rest is filled with the best of what is left.
 */
export function featuredStories<S extends PlaceStory & { importance: number }>(page: PlacePage<S>, n = AUTO_TITLES): S[] {
  const order = new Map(page.stories.map((s, i) => [s.id, i]));
  const ranked = [...page.stories].sort((a, b) => b.importance - a.importance || order.get(a.id)! - order.get(b.id)!);
  const picked: S[] = [];
  if (page.districts.length > 0) {
    const seen = new Set<string>();
    for (const s of ranked) {
      const own = page.owner[s.id] ?? '';
      if (picked.length < n && !seen.has(own)) {
        seen.add(own);
        picked.push(s);
      }
    }
  }
  for (const s of ranked) if (picked.length < n && !picked.includes(s)) picked.push(s);
  return picked.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** The stories of the preview picture: `og_stories` of the place when it names them (the ones that are on the page, in the order named), else the featured ones. */
export function ogStories<S extends PlaceStory & { importance: number }>(page: PlacePage<S>, n = AUTO_TITLES): S[] {
  const named = (page.place.og_stories ?? []).map((id) => page.stories.find((s) => s.id === id)).filter((s): s is S => s !== undefined);
  return named.length > 0 ? named.slice(0, n) : featuredStories(page, n);
}

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const roman = (n: number): string => ROMAN.reduce((out, [value, sign]) => { while (n >= value) { out += sign; n -= value; } return out; }, '');
const ordinal = (n: number): string => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;

/** The century of a year after the common era as the language writes it: "XV" (pt, ru: Roman numerals), "15th" (en). */
export const centuryLabel = (year: number, lang: Lang): string => (lang === 'en' ? ordinal(Math.ceil(year / 100)) : roman(Math.ceil(year / 100)));

/**
 * The introduction of a page: the hand-written one in this language, else a text built from the data: how many stories, from which century to which, and
 * the titles of the three most important ("6 историй с XV по XX век: «…», «…», «…»"). An introduction in another language than the page is worse than none,
 * so a missing language is never borrowed. A page whose stories begin before the common era names the years instead of the centuries.
 */
export function placeIntro(page: PlacePage<IntroStory>, lang: Lang): { text: string; written: boolean } {
  const own = page.place.intro?.[lang]?.trim();
  if (own) return { text: own, written: true };
  const ranges = page.stories.map((s) => yearRange(s));
  const from = Math.min(...ranges.map((r) => r[0]));
  const to = Math.max(...ranges.map((r) => r[1]));
  const titles = featuredStories(page)
    .map((s) => t(lang, 'places.quote').replace('{t}', s.title[lang].trim()))
    .join(', ');
  const stories = plural(lang, 'plural.stories', page.stories.length);
  const [first, last] = [Math.ceil(from / 100), Math.ceil(to / 100)];
  const text =
    from < 1
      ? t(lang, 'places.auto_years').replace('{stories}', stories).replace('{from}', yearText(from, lang)).replace('{to}', yearText(to, lang))
      : first === last
        ? t(lang, 'places.auto_single').replace('{stories}', stories).replace('{c}', centuryLabel(from, lang))
        : t(lang, 'places.auto_span').replace('{stories}', stories).replace('{from}', centuryLabel(from, lang)).replace('{to}', centuryLabel(to, lang));
  return { text: `${text.replace('{titles}', titles)}`, written: false };
}

/** Does the page lack a hand-written introduction in some language? (the line "can add an introduction" of npm run schedule). */
export const introMissing = (place: PlaceData): Lang[] => (['pt', 'en', 'ru'] as const).filter((l) => !place.intro?.[l]?.trim());

// ---- search titles ----

/** The <title> of a page: "History of Sintra: N stories and places to see | site"; longer than SEO_TITLE_MAX (check:cards): without the site, as a story title does. */
export function placeSeoTitle(place: PlaceData, n: number, lang: Lang): string {
  const name = place.name[lang];
  const of = lang === 'en' ? name : place.name_of?.[lang as 'pt' | 'ru'];
  const stories = plural(lang, 'plural.stories', n);
  const full = t(lang, of ? 'places.title_of' : 'places.title_plain').replace('{name}', name).replace('{of}', of ?? '').replace('{stories}', stories);
  const withSite = `${full} | ${t(lang, 'site.name')}`;
  return withSite.length <= SEO_TITLE_MAX ? withSite : full;
}

/** "More stories of Sintra →": the link on a story and in the search. Uses the form "of" where the data has one (pt "da Baixa e do Rossio", ru "Синтры"). */
export function placeMoreLabel(place: PlaceData, lang: Lang): string {
  const name = place.name[lang];
  const of = lang === 'en' ? name : place.name_of?.[lang as 'pt' | 'ru'];
  return t(lang, of ? 'places.more_of' : 'places.more_plain').replace('{name}', name).replace('{of}', of ?? '');
}

/** "All stories of Sintra →": the line of a group of markers of the map that lies wholly inside a place that has a page. */
export function placeAllLabel(place: PlaceData, lang: Lang): string {
  const name = place.name[lang];
  const of = lang === 'en' ? name : place.name_of?.[lang as 'pt' | 'ru'];
  return t(lang, of ? 'places.all_of' : 'places.all_plain').replace('{name}', name).replace('{of}', of ?? '');
}

/**
 * The places of a map: for every place that has a page, the ids of its stories and the line that leads to the page. A group of markers whose stories are all
 * in one of them offers that page (src/scripts/map-island.ts); the smallest such place is taken.
 */
export function mapPlaces<S extends PlaceStory>(pages: readonly PlacePage<S>[], lang: Lang, href: (id: string) => string): { href: string; label: string; ids: string[] }[] {
  return [...pages].sort((a, b) => a.stories.length - b.stories.length || a.place.radius_km - b.place.radius_km).map((p) => ({ href: href(p.place.id), label: placeAllLabel(p.place, lang), ids: p.stories.map((s) => s.id) }));
}

/** The description: the introduction, cut at a word. */
export const placeSeoDescription = (intro: string): string => cutAtWord(intro.replace(/\s+/g, ' ').trim(), SEO_DESCRIPTION_MAX - 5);

// ---- what to see today ----

export interface PlaceBridge<S> {
  /** The name of the place in the language of the page. */
  title: string;
  /** The name as written on the spot, when it differs. */
  local?: string;
  address: string;
  lat: number;
  lon: number;
  mapsUrl?: string;
  /** The stories of the place, in the order given. */
  stories: S[];
}

type BridgeStory = { bridge: { name: string; title?: { [L in Lang]?: string | undefined } | undefined; address: string; lat: number; lon: number; maps_url?: string | undefined } };

/** Bridges of different stories closer than this are one place to a visitor (a museum and its copy of a map, a square and the theatre on it). */
export const SAME_BRIDGE_KM = 0.06;

/**
 * The bridges of the stories of a page, one card for a place that several stories lead to: the stories whose bridges lie within SAME_BRIDGE_KM of the first one
 * share it. The card carries the shortest of the names (the plainest: "Museu de Marinha", not "Museu de Marinha (cópia do mapa de Cantino)") and its own address.
 */
export function placeBridges<S extends BridgeStory>(stories: readonly S[], lang: Lang): PlaceBridge<S>[] {
  const out: PlaceBridge<S>[] = [];
  for (const s of stories) {
    const b = s.bridge;
    const title = b.title?.[lang]?.trim() || b.name;
    const card: Omit<PlaceBridge<S>, 'stories'> = { title, ...(title !== b.name ? { local: b.name } : {}), address: b.address, lat: b.lat, lon: b.lon, ...(b.maps_url ? { mapsUrl: b.maps_url } : {}) };
    const known = out.find((o) => distanceKm(o, b) <= SAME_BRIDGE_KM);
    if (!known) {
      out.push({ ...card, stories: [s] });
      continue;
    }
    known.stories.push(s);
    if (title.length < known.title.length) {
      const { stories: keep } = known;
      for (const key of ['local', 'mapsUrl'] as const) delete known[key];
      Object.assign(known, card, { stories: keep });
    }
  }
  return out;
}

// ---- when a page comes out (for npm run schedule) ----

/** A story as the scripts read it from its file. */
export interface DatedStory extends PlaceStory {
  /** The day it comes out (YYYY-MM-DD). */
  day: string;
}

/**
 * The day a place gets its page: the day its PLACE_MIN_STORIES-th story comes out. The stories are the ones that will be on the lists
 * (ready, not of the cabinet) with the day each comes out. undefined: the place does not get a page with the stories there are.
 */
export function pageDay(place: PlaceData, places: readonly PlaceData[], stories: readonly DatedStory[], min = PLACE_MIN_STORIES): string | undefined {
  const days = stories
    .filter((s) => {
      const p = placeOf(s, places);
      return p !== undefined && placeChain(p, places).some((c) => c.id === place.id);
    })
    .map((s) => s.day)
    .sort();
  return days[min - 1];
}
