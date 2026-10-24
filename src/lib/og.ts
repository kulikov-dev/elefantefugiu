// Preview pictures for Open Graph and Twitter cards must be raster images. A picture that is an SVG in public/images is
// replaced by the PNG next to it (made by scripts/make-og-images.mjs) when that file exists.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** `src` is a path inside public/ (no base), for example images/placeholders/epoch-a.svg. */
export function ogImagePath(src: string, publicDir = join(process.cwd(), 'public')): string {
  if (!/\.svg$/i.test(src)) return src;
  const png = src.replace(/\.svg$/i, '.png');
  return existsSync(join(publicDir, png)) ? png : src;
}

/** Preview of a page that has none of its own (path inside public/): the pattern of the site, no text, no mascot. */
export const DEFAULT_PREVIEW = 'images/og/page.png';
/** The home page: the same pattern with the standing elephant. The only preview with the mascot (check-previews.mjs). */
export const HOME_PREVIEW = 'images/og/home.png';
/** A thread: its pattern in the colour of the thread, no mascot (a thread holds heavy topics). */
export const threadPreview = (threadId: string): string => `images/og/fio-${threadId}.png`;
