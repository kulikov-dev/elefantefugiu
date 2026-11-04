// The data of "Where to start" for the browser (src/scripts/start-set.ts), one file per language: /pt/start/<hash>.json. Only what the function
// and the cards need. The name carries the hash of the content, so the file may be cached for good and a new build gives a new name.
// The page keeps the set it was built with and the script swaps it only after this file has come, so nothing blinks while it loads.
import { createHash } from 'node:crypto';
import { getImage } from 'astro:assets';
import type { Lang } from '../i18n/routes';
import { storyPath, withBase } from '../i18n/routes';
import { formatYear, placeShort, textLangOf, type EventData } from './events';
import { normalizeMinAge, normalizeSensitive, type MinAge } from './family';
import { cardPicture } from './pictures';
import { pictureSource } from './picture-assets';
import { buildToday } from './publication.mjs';
import { START_CARD_QUALITY, START_CARD_SIZES, START_CARD_WIDTHS, type StartCardData } from './start-card';
import { holidayPins } from './start-pins';
import type { Pin, StartStory } from './start-set';
import type { SiteData } from './site-data';

export interface StartData {
  fallback: string[];
  holidays: Pin[];
  stories: (StartStory & { minAge: MinAge })[];
  cards: Record<string, StartCardData>;
}

export const toStart = (e: EventData): StartStory => ({
  id: e.id,
  epoch: e.epoch,
  sensitive: normalizeSensitive(e.sensitive),
  ...(typeof e.year === 'number' ? { year: e.year } : {}),
  ...(e.day ? { day: e.day } : {}),
});

/** The holiday pins of the year of the build and of the next one (a reader on the other side of New Year). */
export function builtHolidays(): Pin[] {
  const year = Number(buildToday().slice(0, 4));
  return [...holidayPins(year), ...holidayPins(year + 1)];
}

async function cardData(site: SiteData, event: EventData, lang: Lang): Promise<StartCardData> {
  const picture = cardPicture(event, site.epochs.find((ep) => ep.id === event.epoch) ?? {});
  const source = picture ? pictureSource(picture.file) : undefined;
  const image = picture && source ? await getImage({ src: source, widths: START_CARD_WIDTHS, sizes: START_CARD_SIZES, format: 'webp', quality: START_CARD_QUALITY }) : undefined;
  const hookLang = textLangOf(event, lang);
  return {
    href: storyPath(lang, event.slug[lang]),
    hook: event.hook[lang],
    title: event.title[lang],
    ...(hookLang ? { hookLang } : {}),
    meta: `${formatYear(event, lang)} · ${placeShort(event.place, lang)}`,
    label: event.label,
    heavy: normalizeSensitive(event.sensitive),
    ...(picture && image
      ? { img: { src: image.src, ...(image.srcSet.attribute ? { srcset: image.srcSet.attribute } : {}), width: source!.width, height: source!.height, alt: picture.alt[lang], ...(picture.focus ? { pos: picture.focus } : {}) } }
      : {}),
  };
}

const memo = new Map<string, Promise<{ json: string; hash: string }>>();

/** The file of a language: its text and the hash for its name. Made once per build. */
export function startFile(site: SiteData, lang: Lang): Promise<{ json: string; hash: string }> {
  let made = memo.get(lang);
  if (!made) {
    made = (async () => {
      const data: StartData = {
        fallback: site.featured.map((e) => e.id),
        // A picture of a pinned page gets the base path of the site here, as the script puts it in the card.
        holidays: builtHolidays().map((pin) => (pin.target.type === 'page' && pin.target.image ? { ...pin, target: { ...pin.target, image: withBase(pin.target.image) } } : pin)),
        stories: site.events.map((e) => ({ ...toStart(e), minAge: normalizeMinAge(e.min_age) })),
        cards: Object.fromEntries(await Promise.all(site.events.map(async (e) => [e.id, await cardData(site, e, lang)] as const))),
      };
      const json = JSON.stringify(data);
      return { json, hash: createHash('sha1').update(json).digest('hex').slice(0, 10) };
    })();
    memo.set(lang, made);
  }
  return made;
}

/** The address of the file of a language (with the base path). */
export const startFileHref = (lang: Lang, hash: string): string => withBase(`${lang}/start/${hash}.json`);
