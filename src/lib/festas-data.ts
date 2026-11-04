// The holidays of src/data/festas.yaml, read and checked once. For pages and for the pins of the showcase; the dates and windows are in festas.ts.
import { parse } from 'yaml';
import raw from '../data/festas.yaml?raw';
import { festaListSchema, type FestaData, type FestaText } from '../data/schemas';
import { festaPath, type Lang } from '../i18n/routes';
import { festaDay, festaDays, festaNow, isInWindow, windowOf, type FestaNow } from './festas';
import { buildToday } from './publication.mjs';
import type { Pin, Say } from './start-set';

export const FESTAS: readonly FestaData[] = festaListSchema.parse(parse(raw));

/** What a holiday says in a language; undefined when it has no text there (then it shows nothing in that language). */
export const festaText = (festa: FestaData, lang: Lang): FestaText | undefined => festa.text[lang];

/** The holidays that have a text in `lang`. */
export const festasIn = (lang: Lang): FestaData[] => FESTAS.filter((f) => festaText(f, lang));

/** The holiday of the build: the one on today or the nearest to come (its markup stands on the pages, hidden outside the window). */
export const builtFesta = (today = buildToday()): FestaNow | undefined => festaNow(FESTAS, today);

/** The days for the head script (festas.ts festaDays) and the ids that `?festa=` may name. */
export const headFestas = (today = buildToday()): { days: [string, string][]; ids: string[] } => ({
  days: festaDays(FESTAS, Number(today.slice(0, 4))),
  ids: FESTAS.filter((f) => Object.keys(f.text).length > 0).map((f) => f.id),
});

/** May the page of the holiday be indexed on this build? The holiday is on and the day of the build is in its window. */
export const festaIndexable = (festa: FestaData, today = buildToday()): boolean => festa.enabled && isInWindow(festa, today);

// The pins of the showcase live here, not in start-pins.ts: that file goes to the browser, and this one reads the YAML file.
/**
 * The holiday pins of `year` for the showcase of one language: the enabled holidays that have a text in it (src/data/festas.yaml). The window of a holiday is the 3 days
 * before it and the day itself; Easter and Carnival are computed. The pin leads to the page of the holiday; `story` of the holiday is the story it stands for.
 */
export function holidayPins(year: number, lang: Lang): Pin[] {
  return FESTAS.flatMap((festa): Pin[] => {
    const text = festaText(festa, lang);
    if (!festa.enabled || !text) return [];
    const to = festaDay(festa.date, year);
    const say = (value: string): Say => ({ pt: value, en: value, ru: value });
    return [
      {
        id: `holiday:${festa.id}`,
        kind: 'holiday',
        from: windowOf(to).from,
        to,
        priority: 0,
        label: say(text.pin_label),
        target: { type: 'page', href: festaPath(lang, festa.slug), title: say(text.head_title), hook: say(text.head_line) },
        ...(festa.story ? { covers: festa.story } : {}),
      },
    ];
  });
}


/** The holiday pins of the year of the build and of the next one (a reader on the other side of New Year), for one language. */
export function builtHolidays(lang: Lang, today = buildToday()): Pin[] {
  const year = Number(today.slice(0, 4));
  return [...holidayPins(year, lang), ...holidayPins(year + 1, lang)];
}
