// Pure helpers for card pages. No Astro imports, so they run in plain unit tests.
import type { z } from 'astro/zod';
import type { eventSchema } from '../data/schemas';
import { LOCALES, type Lang } from '../i18n/routes';
import type { Localized } from './localize';

/** An event as the pages read it: every text object has a `ru` (see localize.ts). */
export type EventData = Localized<z.infer<typeof eventSchema>>;

/** Only `ready` events are published (docs/spec.md section 7). */
export const isPublished = (event: Pick<EventData, 'status'>): boolean => event.status === 'ready';

export function yearRange(event: Pick<EventData, 'year'>): [number, number] {
  return typeof event.year === 'number' ? [event.year, event.year] : [event.year.from, event.year.to];
}

/** Text shown for the year: `year_label` if given, else "1385" or "1385–1390". */
export function formatYear(event: Pick<EventData, 'year' | 'year_label'>, lang: Lang): string {
  const label = event.year_label?.[lang]?.trim();
  if (label) return label;
  const [from, to] = yearRange(event);
  return from === to ? String(from) : `${from}\u2013${to}`;
}

/**
 * Language tag of the card texts when it differs from the page: placeholder filler is Latin (Cyrillic filler on a
 * Russian-ready card is Russian-looking and takes the page language), and a card not written in Russian shows English on /ru/.
 */
export function textLangOf(event: Pick<EventData, 'placeholder' | 'ru_ready'>, lang: Lang): string | undefined {
  const standIn = lang === 'ru' && !event.ru_ready;
  if (event.placeholder) return lang === 'ru' && event.ru_ready ? undefined : 'la';
  return standIn ? 'en' : undefined;
}

/** The Russian page of a card that is not ready in Russian: English text, a banner, noindex, no hreflang. */
export const isRuStandIn = (event: Pick<EventData, 'ru_ready'>, lang: Lang): boolean => lang === 'ru' && !event.ru_ready;

/** The epoch whose colour is grey; the carnation red is kept for the cards that begin in 1974 (data-flash). */
export const FLASH_EPOCH = 'estado-novo-e-25-de-abril';
export const FLASH_YEAR = 1974;

/** A moment of the carnation red: a card of the Estado Novo epoch that begins in 1974. */
export function isFlashMoment(event: Pick<EventData, 'epoch' | 'year'>): boolean {
  return event.epoch === FLASH_EPOCH && yearRange(event)[0] === FLASH_YEAR;
}

/** Chronological order inside an epoch: start year, end year, then id for a stable result. */
export function compareChronological(a: EventData, b: EventData): number {
  const [aFrom, aTo] = yearRange(a);
  const [bFrom, bTo] = yearRange(b);
  return aFrom - bFrom || aTo - bTo || a.id.localeCompare(b.id);
}

/** Previous and next published card in the same epoch (null at the ends). */
export function cardNeighbours(
  event: EventData,
  all: readonly EventData[],
  allowed: (e: EventData) => boolean = () => true,
): { prev: EventData | null; next: EventData | null } {
  // The card itself always stays in the list (it may be one the mode hides, opened once); other cards must be allowed.
  const inEpoch = all.filter((e) => isPublished(e) && e.epoch === event.epoch && (e.id === event.id || allowed(e))).sort(compareChronological);
  const index = inEpoch.findIndex((e) => e.id === event.id);
  if (index < 0) return { prev: null, next: null };
  return { prev: inEpoch[index - 1] ?? null, next: inEpoch[index + 1] ?? null };
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "Nearby" shows stories whose point is at most this far from the point of the current story (kilometres). */
export const NEARBY_RADIUS_KM = 5;
export const MAX_NEARBY = 3;

export interface NearbyCard {
  event: EventData;
  /** Distance between the two points, in kilometres. */
  km: number;
}

/**
 * "Nearby": up to MAX_NEARBY other stories within NEARBY_RADIUS_KM of this story, nearest first. The point of a story is
 * its bridge to today (the place that can be visited, the one the map marks), not the place where the event happened,
 * which may be anywhere in the world. Equal distance: the same epoch first, then chronological. `allowed` hides cards
 * (family mode: by age and heavy topic). An empty list means the block is not shown at all.
 */
export function nearbyCards(event: EventData, all: readonly EventData[], options: { allowed?: (e: EventData) => boolean } = {}): NearbyCard[] {
  const allowed = options.allowed ?? (() => true);
  return all
    .filter((e) => e.id !== event.id && isPublished(e) && allowed(e))
    .map((e) => ({ event: e, km: distanceKm(event.bridge, e.bridge) }))
    .filter((c) => c.km <= NEARBY_RADIUS_KM)
    .sort((a, b) => {
      const byDistance = a.km - b.km;
      if (Math.abs(byDistance) > 1e-9) return byDistance;
      const aSame = a.event.epoch === event.epoch ? 0 : 1;
      const bSame = b.event.epoch === event.epoch ? 0 : 1;
      return aSame - bSame || compareChronological(a.event, b.event);
    })
    .slice(0, MAX_NEARBY);
}

// Words after which a full stop does not end a sentence (European Portuguese and English).
const ABBREVIATIONS = new Set([
  'd', 'dr', 'dra', 'sr', 'sra', 'st', 'sta', 'séc', 'sec', 'av', 'pe', 'n', 'nº', 'cf', 'etc',
  'c', 'ca', 'p', 'pp', 'vol', 'fig', 'no', 'mr', 'mrs', 'ms', 'prof', 'eng', 'arq',
]);

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-\u2013]+$/u, '')}\u2026`;
}

/**
 * First sentence of a text, for the meta description (docs/spec.md section 5.3).
 * Skips full stops after common abbreviations and initials, and stops that are followed by a
 * lower-case letter. Long results are cut at a word boundary to `maxLength` characters.
 */
export function firstSentence(text: string, maxLength = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const stop = /[.!?\u2026]+["\u201d')\]]*\s+/gu;
  let match: RegExpExecArray | null;
  while ((match = stop.exec(clean))) {
    const end = match.index + match[0].length;
    const next = clean[end];
    if (match[0][0] === '.') {
      const word = clean.slice(0, match.index).match(/(\p{L}+)$/u)?.[1]?.toLowerCase();
      if (word && (word.length === 1 || ABBREVIATIONS.has(word))) continue;
    }
    if (next && /\p{Ll}/u.test(next)) continue;
    return truncate(clean.slice(0, match.index + match[0].trimEnd().length), maxLength);
  }
  return truncate(clean, maxLength);
}

/** Long date in the page language, in UTC so that the stored day does not shift. */
/**
 * The short name of a place for cards and lists: "Lisbon". The data's `place.short` in the language of the page when there is
 * one; otherwise the part of the full name before the first comma or bracket ("Lisboa, Paço da Ribeira (hoje Praça do Comércio)"
 * gives "Lisboa"). The full name stays on the page of the story itself.
 */
export function placeShort(
  place: { name: { pt: string; en: string; ru: string }; short?: { pt: string; en: string; ru: string } | undefined },
  lang: Lang,
): string {
  const own = place.short?.[lang]?.trim();
  if (own) return own;
  const full = place.name[lang];
  return full.split(/[,(]/)[0]!.trim() || full;
}

/** A short numeric date (15/10/2026, in Russian 15.10.2026) for places where the long form is too much. */
export function formatShortDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
