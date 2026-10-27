// The schema.org context of a page (src/lib/schema.ts): language, absolute addresses and the names of the site. Uses the i18n
// strings and the base path, so it is not in schema.ts (which has no imports from the site).
import { LOCALES, pagePath, withBase, type Lang } from '../i18n/routes';
import { t } from '../i18n';
import type { SchemaContext } from './schema';

/** The logo for the organization: the PNG icon of the site (512 x 512), a PNG as search engines ask. */
const LOGO = 'web-app-manifest-512x512.png';
const LOGO_SIZE = 512;

export function schemaContext(lang: Lang, site: URL | string | undefined): SchemaContext {
  if (!site) throw new Error('JSON-LD needs `site` (SITE_URL) in the Astro config: every address in it is absolute');
  const abs = (path: string) => new URL(path, site).href;
  return {
    lang,
    inLanguage: LOCALES[lang],
    abs,
    siteName: t(lang, 'site.name'),
    tagline: t(lang, 'site.tagline'),
    homeUrl: abs(pagePath(lang, 'home')),
    homeLabel: t(lang, 'nav.home'),
    logoUrl: abs(withBase(LOGO)),
    logoSize: LOGO_SIZE,
  };
}
