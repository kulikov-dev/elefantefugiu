// The cabinet of rarities (docs/spec.md, "Кабинет редкостей"): pure helpers, no Astro or DOM imports, so the rules run in plain unit tests.
// src/scripts/cabinet.ts is the page; src/views/CabinetView.astro the shelves.
import type { CabinetItem } from '../data/schemas';
import { isVisibleInMode, normalizeMinAge, normalizeSensitive, type AgeInfo, type MinAge } from './family';

/** The key of the storage: { items: [id], sardines: [n], foundAt: { id: ms } } (the sardine numbers are the numbers of their places, 1 to SARDINES). */
export const CABINET_KEY = 'cabinet.v1';
/** The flag of the preview of the owner (?kabinet=preview) while the cabinet is closed. */
export const PREVIEW_KEY = 'cabinet.preview';
export const SARDINES = 7;

/** The marks that carry a hidden word through the glossary markup (private-use characters): the phrase is wrapped before the glossary and turned into a span after it. */
const MARK_START = '';
const MARK_END = '';

export interface CabinetStore {
  items: string[];
  sardines: number[];
  foundAt: Record<string, number>;
}

export const emptyStore = (): CabinetStore => ({ items: [], sardines: [], foundAt: {} });

/** Reads what the storage kept; anything that is not ours gives an empty cabinet, a damaged part is dropped. */
export function parseStore(raw: string | null | undefined): CabinetStore {
  const store = emptyStore();
  if (!raw) return store;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return store;
  }
  if (typeof data !== 'object' || data === null) return store;
  const { items, sardines, foundAt } = data as Record<string, unknown>;
  if (Array.isArray(items)) store.items = [...new Set(items.filter((x): x is string => typeof x === 'string'))];
  if (Array.isArray(sardines)) store.sardines = [...new Set(sardines.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= SARDINES))].sort((a, b) => a - b);
  if (typeof foundAt === 'object' && foundAt !== null) {
    for (const [id, at] of Object.entries(foundAt)) if (typeof at === 'number' && Number.isFinite(at)) store.foundAt[id] = at;
  }
  return store;
}

/** The store with the rarity added (the same store when it is there already). */
export function withItem(store: CabinetStore, id: string, now: number): CabinetStore {
  if (store.items.includes(id)) return store;
  return { ...store, items: [...store.items, id], foundAt: { ...store.foundAt, [id]: now } };
}

/** The store with the sardine added. */
export function withSardine(store: CabinetStore, n: number, now: number): CabinetStore {
  if (store.sardines.includes(n) || n < 1 || n > SARDINES) return store;
  return { ...store, sardines: [...store.sardines, n].sort((a, b) => a - b), foundAt: { ...store.foundAt, [`sardine-${n}`]: now } };
}

// ---- The word in the text of the host ----

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The phrase as a whole word (or words), exactly as written (the case counts: the word is an exact form). */
export const phraseRegex = (phrase: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(phrase.trim()).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'gu');

/** Where the phrase stands in the texts (in the order of the page): paragraph and offset of each place. */
export function findPhrase(texts: readonly string[], phrase: string): { text: number; at: number }[] {
  const places: { text: number; at: number }[] = [];
  texts.forEach((text, i) => {
    for (const m of text.matchAll(phraseRegex(phrase))) places.push({ text: i, at: m.index });
  });
  return places;
}

/** The place of the rarity word: the `occurrence`-th place of the phrase; without `occurrence` the phrase must stand in one place only. */
export function hiddenPlace(texts: readonly string[], phrase: string, occurrence?: number): { text: number; at: number } | undefined {
  const places = findPhrase(texts, phrase);
  if (occurrence === undefined) return places.length === 1 ? places[0] : undefined;
  return places[occurrence - 1];
}

/** Wraps the word of each rarity in marks (before the glossary markup; the glossary escapes the text and leaves the marks alone). */
export function wrapWords(texts: readonly string[], words: readonly { id: string; phrase: string; occurrence?: number | undefined }[]): string[] {
  const out = [...texts];
  const marks = words
    .map((w) => ({ w, place: hiddenPlace(texts, w.phrase, w.occurrence) }))
    .filter((m): m is { w: (typeof words)[number]; place: { text: number; at: number } } => m.place !== undefined)
    // From the end of a paragraph to its start, so that an earlier offset stays right.
    .sort((a, b) => b.place.at - a.place.at);
  for (const { w, place } of marks) {
    const text = out[place.text]!;
    const length = text.slice(place.at).match(phraseRegex(w.phrase))![0].length;
    out[place.text] = `${text.slice(0, place.at)}${MARK_START}${w.id}${MARK_END}${text.slice(place.at, place.at + length)}${MARK_START}${MARK_END}${text.slice(place.at + length)}`;
  }
  return out;
}

const OPEN_MARK = new RegExp(`${MARK_START}([^${MARK_END}]+)${MARK_END}`, 'g');
const CLOSE_MARK = new RegExp(`${MARK_START}${MARK_END}`, 'g');

/** The marks of `wrapWords` into the markup of the word: <span class="cw" data-cw="id">phrase</span> (plain text without the script; src/scripts/cabinet.ts makes it a button). */
export const renderWords = (html: string): string => html.replace(OPEN_MARK, (_m, id: string) => `<span class="cw" data-cw="${id}">`).replace(CLOSE_MARK, '</span>');

/** The text with the marks taken out (what the reader sees; for the checks). */
export const stripMarks = (text: string): string => text.replace(OPEN_MARK, '').replace(CLOSE_MARK, '');

// ---- Which rarities are on the site ----

export interface ActiveItem {
  item: CabinetItem;
  /** The age data of the rarity: the stricter of its host and its story (a rarity is shown in a mode only when both are). */
  age: AgeInfo;
}

const MIN_AGE_RANK: Record<MinAge, number> = { all: 0, '12': 1, '16': 2 };

/**
 * A rarity is on the site when its host and its story are published. The unknown ones (a story that is gone, a draft) are dropped silently.
 * `published`: every published story, the stories of the cabinet too; `listed`: the stories of the lists (a host is always one of them).
 */
export function activeItems(items: readonly CabinetItem[], published: ReadonlyMap<string, { min_age: unknown; sensitive: unknown }>, listed: ReadonlySet<string>): ActiveItem[] {
  const out: ActiveItem[] = [];
  for (const item of items) {
    const host = published.get(item.host);
    const story = published.get(item.story);
    if (!host || !story || !listed.has(item.host)) continue;
    const a = normalizeMinAge(host.min_age);
    const b = normalizeMinAge(story.min_age);
    out.push({ item, age: { minAge: MIN_AGE_RANK[a] >= MIN_AGE_RANK[b] ? a : b, sensitive: normalizeSensitive(host.sensitive) || normalizeSensitive(story.sensitive) } });
  }
  return out;
}

/** The rarities a mode shows. */
export const visibleItems = <T extends { age: AgeInfo }>(items: readonly T[], mode: Parameters<typeof isVisibleInMode>[1]): T[] => items.filter((i) => isVisibleInMode(i.age, mode));

/** How many of `found` the rarities hold (ids that are not there are not counted). */
export const foundCount = (items: readonly { item: { id: string } }[], found: readonly string[]): number => items.filter((i) => found.includes(i.item.id)).length;

/** The rarities hidden in the host story, for its page. */
export const itemsOfHost = <T extends { item: CabinetItem }>(items: readonly T[], hostId: string): T[] => items.filter((i) => i.item.host === hostId);

/** Words in a text (for the limits of the summary and the hint). */
export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** The preview of the owner in the query of an address: ?kabinet=preview turns it on, ?kabinet=off turns it off; undefined when the query says nothing. */
export function previewFromQuery(search: string): boolean | undefined {
  const v = new URLSearchParams(search).get('kabinet');
  return v === 'preview' ? true : v === 'off' ? false : undefined;
}
