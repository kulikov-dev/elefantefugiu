// The <title> and <meta name="description"> of a page as a search engine shows them. Pure functions, no Astro imports.
// They are not the name and the hook the reader sees (h1, hook, og:title, og:description, the feed and the JSON-LD stay as they are):
// they carry the words people search for, the place and the time ("Torre de Belém · Lisboa, 1515").
// A story may give its own in `seo: { title, description }`; this template is for every story that does not.
import { t } from '../i18n';
import type { Lang } from '../i18n/routes';
import { formatYear, type EventData } from './events';
import type { EpochData } from './epochs';
import { cutAtWord } from './og-text';

/** Over these two, check:data warns and check:cards fails (search results cut a title at about 60 and a description at about 155). */
export const SEO_TITLE_MAX = 65;
export const SEO_DESCRIPTION_MAX = 160;
/** What the template aims at. */
const TITLE_TARGET = 60;
const DESCRIPTION_TARGET = 155;

type SeoEvent = Pick<EventData, 'title' | 'hook' | 'year' | 'year_label' | 'years_ago' | 'place' | 'bridge'> & { seo?: EventData['seo'] };

/** The first candidate that fits `max`; otherwise the first within the hard limit; otherwise the last (the shortest). */
function fit(candidates: string[], max: number): string {
  return candidates.find((c) => c.length <= max) ?? candidates.find((c) => c.length <= SEO_TITLE_MAX) ?? candidates[candidates.length - 1]!;
}

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** "Torre de Belém (Lisboa)" → "Torre de Belém": the part before the first comma, bracket or dash. */
const shortName = (name: string): string => name.split(/\s*[,(–—]\s*|\s+-\s+/)[0]!.trim();

/** The short names of the place for the title, the best first: the place to visit today (bridge), then the place of the event ("Museu de Marinha", then "Lisboa"). */
export function seoPlaces(event: Pick<SeoEvent, 'place' | 'bridge'>, lang: Lang): string[] {
  const bridge = event.bridge.title?.[lang]?.trim() || event.bridge.name.trim();
  const own = event.place.short?.[lang]?.trim() || shortName(event.place.name[lang]);
  return [...new Set([bridge && shortName(bridge), own].filter(Boolean))];
}

/** The <title> of a story page: "{name} · {place}, {year} | {site}"; too long: without the site, then without the year, then the same with the place of the event, then the name alone (the name is never cut). */
export function storySeoTitle(event: SeoEvent, lang: Lang): string {
  const own = event.seo?.title?.[lang]?.trim();
  if (own) return own;
  const name = event.title[lang].trim();
  const site = t(lang, 'site.name');
  const year = formatYear(event, lang);
  // A place that is already in the name of the story is not repeated.
  const places = seoPlaces(event, lang).filter((p) => !fold(name).includes(fold(p)));
  const line = (place: string | undefined, withYear: boolean, withSite: boolean): string => {
    const where = [place, withYear ? year : ''].filter(Boolean).join(', ');
    return `${name}${where ? ` · ${where}` : ''}${withSite ? ` | ${site}` : ''}`;
  };
  const candidates = (places.length > 0 ? places : [undefined]).flatMap((p) => [line(p, true, true), line(p, true, false), line(p, false, false)]);
  return fit([...candidates, name], TITLE_TARGET);
}

/** The words of a text, folded (no accents, lower case), as a list. */
const wordsOf = (s: string): string[] => fold(s).match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Does the hook already carry the name of the story (or its main words)? A search that types the name of the story ("рим не платит предателям") must find
 * the words in the description, or the engine takes a piece of the page instead (the service line under the heading). The main words are the ones
 * of four letters and more; one is found when a word of the hook starts with its first five letters (so "предателям" is found in "предатели").
 */
export function hookHasName(title: string, hook: string): boolean {
  const hookWords = wordsOf(hook);
  if (hookWords.join(' ').includes(wordsOf(title).join(' '))) return true;
  const main = wordsOf(title).filter((w) => w.length >= 4);
  return main.length > 0 && main.every((w) => hookWords.some((h) => h.startsWith(w.slice(0, Math.min(w.length, 5)))));
}

/** The text with a full stop at the end (a question or exclamation mark, a quote or a bracket after the mark stays as it is). */
const closeSentence = (s: string): string => (/[.!?…]["”')\]»]*$/u.test(s) ? s : `${s}.`);

/**
 * The description of a story page: the name of the story when the hook does not carry it, the hook, and one sentence about the place to visit today
 * (without a place, the epoch); up to about 155 characters. Too long: the sentence with the short place of the event instead, then no place sentence at all
 * (the name and the hook stay; only a text that is too long even without the place is cut at a word). `named: false` is the template of before the name was added.
 */
export function storySeoDescription(event: SeoEvent, lang: Lang, epochName: string, { named = true }: { named?: boolean } = {}): string {
  const own = event.seo?.description?.[lang]?.trim();
  if (own) return own;
  const hook = event.hook[lang].trim();
  const name = event.title[lang].trim();
  const head = named && !hookHasName(name, hook) ? `${closeSentence(name)} ${closeSentence(hook)}` : closeSentence(hook);
  const places = seoPlaces(event, lang);
  const sentences = places.length > 0 ? places.map(closeSentence) : [`${epochName}.`];
  const whole = sentences.map((sentence) => `${head} ${sentence}`).find((d) => d.length <= DESCRIPTION_TARGET);
  return whole ?? cutAtWord(head, DESCRIPTION_TARGET);
}

/**
 * The first sentence of a text ("Alfama is the oldest quarter of Lisbon, ..."). A full stop after a short word or a known abbreviation ("a.C.", "в.", "séc.") does not end it.
 * A sentence over `max` is cut at a word.
 */
export function firstSentence(text: string, max = DESCRIPTION_TARGET): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const abbreviations = new Set(['sec', 'cap', 'ed', 'trad', 'sta', 'tel', 'vol', 'etc', 'млн', 'тыс', 'млрд', 'гг', 'рис']);
  const boundary = /[.!?…]["”')\]»]*\s+(?=[\p{Lu}«"“(\d])/gu;
  for (let m = boundary.exec(clean); m; m = boundary.exec(clean)) {
    const before = clean.slice(0, m.index + 1).match(/(\p{L}+)\.$/u)?.[1];
    if (before && (before.length <= 2 || abbreviations.has(fold(before)))) continue;
    return cutAtWord(clean.slice(0, m.index + m[0].trimEnd().length), max);
  }
  return cutAtWord(clean, max);
}

/**
 * The description of an epoch page: its own `description` when the data has one; otherwise the first sentence of the introduction (the epoch itself, not a list of
 * its stories); otherwise the theme phrase.
 */
export function epochSeoDescription(epoch: Pick<EpochData, 'description' | 'intro' | 'theme' | 'name'>, lang: Lang): string {
  const own = epoch.description?.[lang]?.trim();
  if (own) return own;
  const intro = epoch.intro?.[lang]?.trim();
  if (intro) return firstSentence(intro);
  return epoch.theme?.[lang]?.trim() || epoch.name[lang];
}

/** The <title> of an epoch page: "{name} ({years}): stories from Portugal | {site}"; too long: without the site, then without the years, then the name with the years only, then the name. */
export function epochSeoTitle(epoch: Pick<EpochData, 'name' | 'years_label' | 'seo'>, lang: Lang): string {
  const own = epoch.seo?.title?.[lang]?.trim();
  if (own) return own;
  const name = epoch.name[lang].trim();
  const years = epoch.years_label?.[lang]?.trim();
  const named = years ? `${name} (${years})` : name;
  const full = t(lang, 'seo.epoch_title').replace('{name}', named);
  const withoutYears = t(lang, 'seo.epoch_title').replace('{name}', name);
  return fit([`${full} | ${t(lang, 'site.name')}`, full, withoutYears, named, name], TITLE_TARGET);
}
