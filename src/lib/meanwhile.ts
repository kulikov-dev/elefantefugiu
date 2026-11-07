// "Meanwhile" (pt "Entretanto", en "Meanwhile", ru "А в это время"): one well-known fact from elsewhere, near the year of a story.
// Pure helpers, no Astro imports: the schema, check:data, the page and the tests all read the rules from here.
import { t } from '../i18n';
import type { Lang } from '../i18n/routes';

/** `world` is for every reader; the others are for the pages of that language only (ru: Russia, en: England / the USA, pt: Brazil). */
export const MEANWHILE_SCOPES = ['world', 'ru', 'en', 'pt'] as const;
export type MeanwhileScope = (typeof MEANWHILE_SCOPES)[number];

/** How far the event may be from the first year of the story, in years. */
export const MEANWHILE_MAX_YEARS = 15;
/** A line is up to this many words (a warning, not an error). */
export const MEANWHILE_MAX_WORDS = 15;
/** At most one line of each scope (ru, en, pt, world), so four in the data; a page shows one: the line of its own language, else the world line. */
export const MEANWHILE_MAX_ITEMS = MEANWHILE_SCOPES.length;

export interface MeanwhileItemLike {
  scope: MeanwhileScope;
  /** The year of the event; before the common era it is negative (-138 is 138 BC). */
  year: number;
  text: { pt?: string | undefined; en?: string | undefined; ru?: string | undefined };
  source: string;
}

export interface MeanwhileProblem {
  level: 'error' | 'warn';
  /** Position in the list. */
  index: number;
  message: string;
}

/** The year the distance is counted from: a single year, or the first year of a period ("1717–1730" gives 1717). */
export function storyStartYear(year: number | { from: number; to: number }): number {
  return typeof year === 'number' ? year : year.from;
}

/**
 * Years from the story to the event (negative: before the story). There is no year 0, so 1 BC and 1 AD are one year apart
 * and the years are counted across it: 9 BC to 1 AD is 9 years.
 */
export function yearDelta(eventYear: number, storyYear: number): number {
  const d = eventYear - storyYear;
  if (storyYear > 0 && eventYear < 0) return d + 1;
  if (storyYear < 0 && eventYear > 0) return d - 1;
  return d;
}

export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** The rules of the field, for the schema (errors) and for check:data (warnings). `storyYear` is the first year of the story. */
export function meanwhileProblems(items: readonly MeanwhileItemLike[], storyYear: number): MeanwhileProblem[] {
  const out: MeanwhileProblem[] = [];
  const seen = new Set<MeanwhileScope>();
  items.forEach((item, index) => {
    const add = (level: 'error' | 'warn', message: string) => out.push({ level, index, message });
    if (seen.has(item.scope)) add('error', `more than one line with the scope "${item.scope}"`);
    seen.add(item.scope);
    const langs = (['pt', 'en', 'ru'] as const).filter((l) => (item.text[l] ?? '').trim() !== '');
    if (item.scope === 'world') {
      for (const l of ['pt', 'en', 'ru'] as const) if (!langs.includes(l)) add('error', `a world line needs the text in ${l}`);
    } else if (langs.length !== 1 || langs[0] !== item.scope) {
      add('error', `a "${item.scope}" line has the text in ${item.scope} only (found: ${langs.join(', ') || 'none'})`);
    }
    if (!Number.isInteger(item.year) || item.year === 0) add('error', 'year is a whole number, not 0 (before the common era it is negative)');
    else if (Math.abs(yearDelta(item.year, storyYear)) > MEANWHILE_MAX_YEARS) {
      add('error', `year ${item.year} is ${Math.abs(yearDelta(item.year, storyYear))} years from the story (${storyYear}); the limit is ${MEANWHILE_MAX_YEARS}`);
    }
    if (!/^https?:\/\/\S+$/.test(item.source)) add('error', 'source is an http(s) address');
    for (const l of langs) {
      const n = wordCount(item.text[l] ?? '');
      if (n > MEANWHILE_MAX_WORDS) add('warn', `${l}: ${n} words, a line is up to ${MEANWHILE_MAX_WORDS}`);
      if (/!/.test(item.text[l] ?? '')) add('warn', `${l}: no exclamation marks`);
    }
  });
  if (items.length > MEANWHILE_MAX_ITEMS) out.push({ level: 'error', index: items.length - 1, message: `at most ${MEANWHILE_MAX_ITEMS} lines` });
  return out;
}

export interface MeanwhileLine {
  scope: MeanwhileScope;
  year: number;
  text: string;
  source: string;
  /** The words in front of the line when the year number would mislead ("about 150 million years ago"); without it `meanwhileYearText` writes the year. */
  label?: string;
}

/** The line for the page of a language (at most one, so a list of 0 or 1): its own, else the world one. A line without a text in that language is left out. */
export function meanwhileFor(items: readonly MeanwhileItemLike[] | undefined, lang: Lang): MeanwhileLine[] {
  const pick = (scope: MeanwhileScope): MeanwhileLine[] =>
    (items ?? [])
      .filter((i) => i.scope === scope)
      .flatMap((i) => (i.text[lang]?.trim() ? [{ scope: i.scope, year: i.year, text: i.text[lang]!, source: i.source }] : []))
      .slice(0, 1);
  return [...pick(lang), ...pick('world')].slice(0, 1);
}

/** The year in front of a line: "1755"; before the common era "9 BC" / "9 a.C." / "9 до н. э."; the first centuries (under 1000) "AD 8" / "8 d.C." / "8 н. э.". */
export function meanwhileYearText(lang: Lang, year: number): string {
  if (year < 0) return t(lang, 'card.year_bc').replace('{n}', String(-year));
  return year < 1000 ? t(lang, 'card.year_ad').replace('{n}', String(year)) : String(year);
}
