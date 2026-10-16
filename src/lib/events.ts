// Pure helpers for card pages. No Astro imports, so they run in plain unit tests.
import type { z } from 'astro/zod';
import type { eventSchema } from '../data/schemas';
import type { Lang } from '../i18n/routes';

export type EventData = z.infer<typeof eventSchema>;

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

export const MAX_RELATED = 7;

/**
 * "Mais perto" (docs/spec.md section 8, simple version):
 * 1. manual `related` links in the order of the data,
 * 2. then the nearest cards by distance (same epoch first when the distance is equal),
 * up to `max` cards. `allowed` hides cards (family mode: by age and heavy topic).
 */
export function relatedCards(
  event: EventData,
  all: readonly EventData[],
  options: { max?: number; allowed?: (e: EventData) => boolean } = {},
): EventData[] {
  const max = options.max ?? MAX_RELATED;
  const allowed = options.allowed ?? (() => true);
  const pool = all.filter((e) => e.id !== event.id && isPublished(e) && allowed(e));
  const byId = new Map(pool.map((e) => [e.id, e]));

  const picked: EventData[] = [];
  const seen = new Set<string>();
  for (const id of event.related ?? []) {
    const found = byId.get(id);
    if (found && !seen.has(id)) {
      picked.push(found);
      seen.add(id);
    }
  }

  const rest = pool
    .filter((e) => !seen.has(e.id))
    .map((e) => ({ e, km: distanceKm(event.place, e.place) }))
    .sort((a, b) => {
      const byDistance = a.km - b.km;
      if (Math.abs(byDistance) > 1e-9) return byDistance;
      const aSame = a.e.epoch === event.epoch ? 0 : 1;
      const bSame = b.e.epoch === event.epoch ? 0 : 1;
      return aSame - bSame || compareChronological(a.e, b.e);
    });

  return [...picked, ...rest.map((r) => r.e)].slice(0, max);
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
export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
