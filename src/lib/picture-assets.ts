// The files of the pictures: src/assets/stories/*, made into sizes by Astro's image processing. Like site-data.ts this file
// imports from Astro (the pure rules are in pictures.ts).
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import type { PictureData } from './pictures';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/stories/*.{webp,jpg,jpeg,png}', { eager: true });

/** The metadata (and the import) of a picture file; a name that is not in src/assets/stories stops the build. */
export function pictureSource(file: string): ImageMetadata {
  const found = files[`../assets/stories/${file}`];
  if (!found) throw new Error(`Picture "${file}" is not in src/assets/stories/`);
  return found.default;
}

/** The preview picture for Open Graph and Twitter: 1200x630 JPEG (the widest format every site that unfurls a link reads). Returns the address inside the site (with the base path). */
export async function previewImageUrl(picture: PictureData): Promise<string> {
  const image = await getImage({ src: pictureSource(picture.file), width: 1200, height: 630, fit: 'cover', format: 'jpeg', quality: 80 });
  return image.src;
}
