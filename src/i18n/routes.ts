// Route map: one slug per page and language; a language root is /{lang}/ (see docs/spec.md section 2).
export const LANGS = ['pt', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = { pt: 'Português', en: 'English', ru: 'Русский' };

/** BCP 47 tag per language: plural rules, number and date formats, og:locale (as pt_PT). */
export const LOCALES: Record<Lang, string> = { pt: 'pt-PT', en: 'en-GB', ru: 'ru-RU' };

/** The default language: the root without a saved choice or a matching browser language leads here. */
export const DEFAULT_LANG: Lang = 'pt';

/** Fallback chain of a text that is missing in a language: ru -> en -> pt (the data loader applies it, see lib/localize.ts). */
export const FALLBACK_CHAIN: Record<Lang, readonly Lang[]> = { pt: [], en: ['pt'], ru: ['en', 'pt'] };

export type PageKey = 'home' | 'about' | 'method' | 'report' | 'legal' | 'map';

// An empty slug means the language root (/pt/, /en/).
export const ROUTES: Record<PageKey, Record<Lang, string>> = {
  home: { pt: '', en: '', ru: '' },
  about: { pt: 'sobre', en: 'about', ru: 'o-proekte' },
  method: { pt: 'metodo', en: 'method', ru: 'metod' },
  report: { pt: 'corrigir', en: 'report', ru: 'oshibka' },
  legal: { pt: 'legal', en: 'legal', ru: 'pravovaya-informaciya' },
  map: { pt: 'mapa', en: 'map', ru: 'karta' },
};

/** Id of the epochs section on the home page; the "Épocas" menu item links to it. */
export const EPOCHS_ANCHOR = 'epocas';

/** Prefix a site-internal path with the configured base path. */
export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

/** Base-aware URL of a page in a given language, always with a trailing slash. */
export function pagePath(lang: Lang, key: PageKey): string {
  const slug = ROUTES[key][lang];
  return withBase(slug ? `${lang}/${slug}/` : `${lang}/`);
}

/** Address segment of a card page: /pt/historia/{slug}, /en/story/{slug} (docs/spec.md section 2). */
export const STORY_SEGMENT: Record<Lang, string> = { pt: 'historia', en: 'story', ru: 'istoriya' };

/** Base-aware URL of a card page; the slug comes from the event data for that language. */
export function storyPath(lang: Lang, slug: string): string {
  return withBase(`${lang}/${STORY_SEGMENT[lang]}/${slug}/`);
}

/** Address segments of epoch and thread pages (docs/spec.md section 2). */
export const EPOCH_SEGMENT: Record<Lang, string> = { pt: 'epoca', en: 'era', ru: 'epoha' };
export const THREAD_SEGMENT: Record<Lang, string> = { pt: 'fio', en: 'thread', ru: 'niti' };

/** Base-aware URL of an epoch page; `slug` is the epoch slug for that language. */
export function epochHref(lang: Lang, slug: string): string {
  return withBase(`${lang}/${EPOCH_SEGMENT[lang]}/${slug}/`);
}

/** Base-aware URL of a thread page; `slug` is the thread slug for that language. */
export function threadHref(lang: Lang, slug: string): string {
  return withBase(`${lang}/${THREAD_SEGMENT[lang]}/${slug}/`);
}

/** The same page in every language: `Record<Lang, path>` from a function of the language (for the language switch and hreflang). */
export function altPaths(make: (lang: Lang) => string): Record<Lang, string> {
  return Object.fromEntries(LANGS.map((lang) => [lang, make(lang)])) as Record<Lang, string>;
}
