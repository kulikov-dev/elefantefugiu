// Route map: one slug per page and language; a language root is /{lang}/ (see docs/spec.md section 2).
export const LANGS = ['pt', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = { pt: 'Português', en: 'English', ru: 'Русский' };

/** BCP 47 tag per language: plural rules, number and date formats, og:locale (as pt_PT). */
export const LOCALES: Record<Lang, string> = { pt: 'pt-PT', en: 'en-US', ru: 'ru-RU' };

/** The default language: the root without a saved choice or a matching browser language leads here. */
export const DEFAULT_LANG: Lang = 'pt';

/** Fallback chain of a text that is missing in a language: ru -> en -> pt (the data loader applies it, see lib/localize.ts). */
export const FALLBACK_CHAIN: Record<Lang, readonly Lang[]> = { pt: [], en: ['pt'], ru: ['en', 'pt'] };

export type PageKey = 'home' | 'about' | 'method' | 'report' | 'share' | 'legal' | 'map' | 'surprise' | 'myths' | 'order' | 'games';

// An empty slug means the language root (/pt/, /en/).
export const ROUTES: Record<PageKey, Record<Lang, string>> = {
  home: { pt: '', en: '', ru: '' },
  about: { pt: 'sobre', en: 'about', ru: 'o-proekte' },
  method: { pt: 'metodo', en: 'method', ru: 'metod' },
  report: { pt: 'corrigir', en: 'report', ru: 'oshibka' },
  share: { pt: 'conheco-uma-historia', en: 'share-a-story', ru: 'znayu-istoriyu' },
  legal: { pt: 'legal', en: 'legal', ru: 'pravovaya-informaciya' },
  map: { pt: 'mapa', en: 'map', ru: 'karta' },
  surprise: { pt: 'surpreende-me', en: 'surprise-me', ru: 'udivi-menya' },
  myths: { pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' },
  order: { pt: 'o-que-veio-primeiro', en: 'which-came-first', ru: 'chto-bylo-ranshe' },
  games: { pt: 'jogos', en: 'games', ru: 'igry' },
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

/** Base-aware URL of the page of one claim of "Myth or fact": /ru/mif-ili-pravda/{id}/ (the same page with every card, that one first; noindex, docs/spec.md 5.8). The id is the same in every language. */
export function mythPath(lang: Lang, id: string): string {
  return withBase(`${lang}/${ROUTES.myths[lang]}/${id}/`);
}

/** The games that have result pages (a shared result: /ru/mif-ili-pravda/zvanie/<rank>/), and the segment of those pages. noindex, the same page as the game (docs/spec.md 5.10). */
export type GameKey = 'myths' | 'order';
export const RANK_SEGMENT: Record<Lang, string> = { pt: 'titulo', en: 'rank', ru: 'zvanie' };
/** The ids of the ranges of a result (the same in every language): the captions of the result by the share of right answers. */
export const RANKS: Record<GameKey, readonly string[]> = { myths: ['low', 'mid', 'high'], order: ['low', 'mid', 'high', 'top'] };

/** Base-aware URL of the page of a result: /ru/chto-bylo-ranshe/zvanie/high/. */
export function rankPath(lang: Lang, game: GameKey, rank: string): string {
  return withBase(`${lang}/${ROUTES[game][lang]}/${RANK_SEGMENT[lang]}/${rank}/`);
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

/** The page of a finished panel (the reward of an epoch read to the end): /ru/panno/{slug}, /pt/painel/{slug}, /en/panel/{slug}. noindex, linked from nowhere but the share. */
export const PANNO_SEGMENT: Record<Lang, string> = { pt: 'painel', en: 'panel', ru: 'panno' };

/** Base-aware URL of a panel page; `slug` is the slug of the epoch for that language. */
export function pannoHref(lang: Lang, slug: string): string {
  return withBase(`${lang}/${PANNO_SEGMENT[lang]}/${slug}/`);
}

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

/** Address segment of the page of a holiday: /ru/festa/{slug}/ (docs/spec.md "Праздники"). */
export const FESTA_SEGMENT = 'festa';

/** Base-aware URL of the page of a holiday; `slug` is the slug in src/data/festas.yaml. */
export function festaPath(lang: Lang, slug: string): string {
  return withBase(`${lang}/${FESTA_SEGMENT}/${slug}/`);
}
