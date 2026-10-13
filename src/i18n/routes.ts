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
