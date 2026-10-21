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
