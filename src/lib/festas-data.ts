// The holidays of src/data/festas.yaml, read and checked once. For pages; the dates and windows are in festas.ts.
import { parse } from 'yaml';
import raw from '../data/festas.yaml?raw';
import { festaListSchema, type FestaData, type FestaText } from '../data/schemas';
import { withBase, type Lang } from '../i18n/routes';
import { festaDays, festaNow, isInWindow, type FestaNow } from './festas';
import { buildToday } from './publication.mjs';
import type { HeadFestas } from './head-script';

export const FESTAS: readonly FestaData[] = festaListSchema.parse(parse(raw));

/** What a holiday says in a language; undefined when it has no text there (then it shows nothing in that language). */
export const festaText = (festa: FestaData, lang: Lang): FestaText | undefined => festa.text[lang];

/** The holidays that have a text in `lang`. */
export const festasIn = (lang: Lang): FestaData[] => FESTAS.filter((f) => festaText(f, lang));

/** The holiday of the build: the one on today or the nearest to come (its markup stands on the pages, hidden outside the window). */
export const builtFesta = (today = buildToday()): FestaNow | undefined => festaNow(FESTAS, today);

/** The icon files of a holiday's tab (made by scripts/make-festa-og.mjs into public/festas/). */
export const festaIcons = (festa: FestaData): { svg: string; png: string; apple: string } | undefined =>
  festa.favicon ? { svg: withBase(`festas/favicon-${festa.favicon}.svg`), png: withBase(`festas/favicon-${festa.favicon}-32.png`), apple: withBase(`festas/favicon-${festa.favicon}-180.png`) } : undefined;

/** What the head script needs for a language (festas.ts festaDays, the ids that `?festa=` may name, the icons) and whether this build is in a window with an icon (the <link> icons are then the holiday's). */
export function headFestas(lang: Lang, today = buildToday()): HeadFestas {
  const built = builtFesta(today);
  const now = built?.inWindow ? FESTAS.find((f) => f.id === built.id && f.enabled && festaText(f, lang)) : undefined;
  return {
    days: festaDays(FESTAS, Number(today.slice(0, 4))),
    ids: FESTAS.filter((f) => Object.keys(f.text).length > 0).map((f) => f.id),
    // A language with no text for the holiday keeps the usual icon: nothing of the holiday shows there.
    icons: Object.fromEntries(FESTAS.flatMap((f) => { const icons = festaText(f, lang) ? festaIcons(f) : undefined; return icons ? [[f.id, icons] as const] : []; })),
    built: now ? festaIcons(now) !== undefined : false,
  };
}

/** May the page of the holiday be indexed on this build? The holiday is on and the day of the build is in its window. */
export const festaIndexable = (festa: FestaData, today = buildToday()): boolean => festa.enabled && isInWindow(festa, today);
