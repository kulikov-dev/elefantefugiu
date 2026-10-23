// Pure helpers for the pictures of cards and epochs. No Astro imports, so they run in plain unit tests.
// The files themselves are made by Astro (src/lib/picture-assets.ts); this file decides which picture a card shows and what its caption says.
import type { z } from 'astro/zod';
import type { picture } from '../data/schemas';
import type { Lang } from '../i18n/routes';
import type { Localized } from './localize';

export type PictureData = Localized<z.infer<typeof picture>>;

/** The picture of an epoch for the cards that have none of their own. The provisional path (a string, Estado Novo) is not a picture: nothing is shown. */
export const epochPicture = (epoch: { fallback_image?: PictureData | string | undefined }): PictureData | undefined =>
  typeof epoch.fallback_image === 'object' ? epoch.fallback_image : undefined;

/** The picture on a card of a list (grid tile, timeline thumbnail, "Next"): its own image, else the epoch's. */
export const cardPicture = (event: { image?: PictureData | undefined }, epoch: { fallback_image?: PictureData | string | undefined }): PictureData | undefined =>
  event.image ?? epochPicture(epoch);

/** The picture of a card where it may be seen without the reader having chosen it (the home page, link previews): a heavy topic gives its place to the epoch's picture. */
export const previewPicture = (event: { image?: PictureData | undefined; sensitive?: boolean }, epoch: { fallback_image?: PictureData | string | undefined }): PictureData | undefined =>
  event.sensitive ? epochPicture(epoch) : cardPicture(event, epoch);

/** The author in the language of the page. */
export const authorText = (p: Pick<PictureData, 'author'>, lang: Lang): string => (typeof p.author === 'string' ? p.author : p.author[lang]);

/** CC BY and CC BY-SA ask for the author and the licence text; the page links the licence. */
export const needsAttribution = (license: string): boolean => /^CC BY(-SA)?\b/i.test(license.trim());

/** The name of the site a picture comes from, for the link "Source: Wikimedia Commons". */
export function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'commons.wikimedia.org' ? 'Wikimedia Commons' : host;
  } catch {
    return url;
  }
}

/** The value of object-position for a crop (`undefined` = the centre). */
export const focusPosition = (p: Pick<PictureData, 'focus'>): string | undefined => p.focus;
