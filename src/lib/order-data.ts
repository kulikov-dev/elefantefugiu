// The list of "Which came first?" for a language (docs/spec.md 5.9), made at every build from the stories that are published that day (src/lib/order-build.ts): the daily build adds
// the stories whose day has come, a new story and a new epoch get in by themselves. This file adds the thumbnails (Astro's image pipeline).
import { getImage } from 'astro:assets';
import type { Lang } from '../i18n/routes';
import { orderEntry, orderEvents } from './order-build';
import type { OrderStory } from './order';
import { pictureSource } from './picture-assets';
import { cardPicture } from './pictures';
import type { SiteData } from './site-data';

/** The sizes of the thumbnail: the width of a card on a phone and of half a column from 640 px (the card is 16:7). */
export const ORDER_IMAGE_WIDTHS = [360, 720];
export const ORDER_IMAGE_SIZES = '(min-width: 640px) 340px, 100vw';

/** The stories of the game in the language, in chronological order. */
export async function orderStories(site: SiteData, lang: Lang): Promise<OrderStory[]> {
  return Promise.all(
    orderEvents(site.events).map(async (e) => {
      const picture = cardPicture(e, site.epochs.find((ep) => ep.id === e.epoch) ?? {});
      const source = picture ? pictureSource(picture.file) : undefined;
      const image = source ? await getImage({ src: source, widths: ORDER_IMAGE_WIDTHS, sizes: ORDER_IMAGE_SIZES, format: 'webp', quality: 70 }) : undefined;
      const entry = orderEntry(e, lang);
      return image ? { ...entry, img: { src: image.src, ...(image.srcSet.attribute ? { srcset: image.srcSet.attribute } : {}), ...(picture?.focus ? { pos: picture.focus } : {}) } } : entry;
    }),
  );
}
