// The files of the pictures: src/assets/stories/*, made into sizes by Astro's image processing. Like site-data.ts this file
// imports from Astro (the pure rules are in pictures.ts).
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import type { PictureData } from './pictures';

const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 630;

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/stories/*.{webp,jpg,jpeg,png}', { eager: true });

/** The metadata (and the import) of a picture file; a name that is not in src/assets/stories stops the build. */
export function pictureSource(file: string): ImageMetadata {
  const found = files[`../assets/stories/${file}`];
  if (!found) throw new Error(`Picture "${file}" is not in src/assets/stories/`);
  return found.default;
}

/**
 * The preview picture for Open Graph and Twitter: JPEG, 1200x630 (the widest format every site that unfurls a link reads).
 * Astro does not enlarge, and a source with a side shorter than that would come out uncropped, in the wrong proportion: such a
 * picture is cropped to the same proportion at the largest size it allows (the 998 px wide engraving of 1755 gives 998x524).
 * Returns the address inside the site (with the base path).
 */
export async function previewImageUrl(picture: PictureData): Promise<string> {
  const src = pictureSource(picture.file);
  const scale = Math.min(1, src.width / PREVIEW_WIDTH, src.height / PREVIEW_HEIGHT);
  const image = await getImage({
    src,
    width: Math.floor(PREVIEW_WIDTH * scale),
    height: Math.floor(PREVIEW_HEIGHT * scale),
    fit: 'cover',
    format: 'jpeg',
    quality: 80,
  });
  return image.src;
}

const pannos = import.meta.glob<{ default: ImageMetadata }>('../assets/panno/*.{jpg,jpeg,png,webp}', { eager: true });

/** The picture of an epoch panel (src/assets/panno/); a name that is not there stops the build. */
export function pannoSource(file: string): ImageMetadata {
  const found = pannos[`../assets/panno/${file}`];
  if (!found) throw new Error(`Panel picture "${file}" is not in src/assets/panno/`);
  return found.default;
}
