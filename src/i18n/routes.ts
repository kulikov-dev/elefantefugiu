// Route map: one slug per page and language (see docs/spec.md section 2).
export const LANGS = ['pt', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = { pt: 'Português', en: 'English' };

export type PageKey = 'home' | 'about' | 'method' | 'report' | 'legal' | 'map';

// An empty slug means the language root (/pt/, /en/).
export const ROUTES: Record<PageKey, Record<Lang, string>> = {
  home: { pt: '', en: '' },
  about: { pt: 'sobre', en: 'about' },
  method: { pt: 'metodo', en: 'method' },
  report: { pt: 'corrigir', en: 'report' },
  legal: { pt: 'legal', en: 'legal' },
  // Placeholder so the header link is not dead; the real map arrives in stage 4.
  map: { pt: 'mapa', en: 'map' },
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
export const STORY_SEGMENT: Record<Lang, string> = { pt: 'historia', en: 'story' };

/** Base-aware URL of a card page; the slug comes from the event data for that language. */
export function storyPath(lang: Lang, slug: string): string {
  return withBase(`${lang}/${STORY_SEGMENT[lang]}/${slug}/`);
}

/** Address segments of epoch and thread pages (docs/spec.md section 2). */
export const EPOCH_SEGMENT: Record<Lang, string> = { pt: 'epoca', en: 'era' };
export const THREAD_SEGMENT: Record<Lang, string> = { pt: 'fio', en: 'thread' };

/** Base-aware URL of an epoch page; `slug` is the epoch slug for that language. */
export function epochHref(lang: Lang, slug: string): string {
  return withBase(`${lang}/${EPOCH_SEGMENT[lang]}/${slug}/`);
}

/** Base-aware URL of a thread page; `slug` is the thread slug for that language. */
export function threadHref(lang: Lang, slug: string): string {
  return withBase(`${lang}/${THREAD_SEGMENT[lang]}/${slug}/`);
}
