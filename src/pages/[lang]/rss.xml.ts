// The RSS feed of a language: /pt/rss.xml, /en/rss.xml, /ru/rss.xml (rules and format: src/lib/rss.ts). Full text is not in the feed: the hook and the first sentence of the story, and a link.
import type { APIRoute, GetStaticPaths } from 'astro';
import { statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { LANGS, pagePath, storyPath, withBase, type Lang } from '../../i18n/routes';
import { t } from '../../i18n';
import { firstSentence } from '../../lib/events';
import { pictureSource } from '../../lib/picture-assets';
import { buildRss, feedStories, type FeedItem } from '../../lib/rss';
import { loadSite } from '../../lib/site-data';

export const getStaticPaths = (() => LANGS.map((lang) => ({ params: { lang }, props: { lang: lang as Lang } }))) satisfies GetStaticPaths;

const TYPES: Record<string, string> = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const LANGUAGE: Record<Lang, string> = { pt: 'pt-PT', en: 'en-US', ru: 'ru' };

export const GET: APIRoute = async ({ props, site }) => {
  const { lang } = props as { lang: Lang };
  const origin = site ?? new URL('https://elefantefugiu.pt');
  const abs = (path: string): string => new URL(path, origin).href;
  const { events } = await loadSite(); // only the stories that are on the site (src/lib/publication.mjs)
  const items: FeedItem[] = feedStories(events, lang).map((event) => {
    const link = abs(storyPath(lang, event.slug[lang]));
    const picture = event.image;
    let enclosure: FeedItem['enclosure'];
    if (picture) {
      const src = pictureSource(picture.file).src;
      enclosure = { url: abs(src), length: statSync(join(process.cwd(), 'src/assets/stories', picture.file)).size, type: TYPES[extname(picture.file).toLowerCase()] ?? 'image/webp' };
    }
    return { title: event.title[lang], link, published: event.published, description: `${event.hook[lang]} ${firstSentence(event.story[lang], 200)}`.trim(), enclosure };
  });
  const xml = buildRss(
    { title: t(lang, 'site.name'), link: abs(pagePath(lang, 'home')), description: t(lang, 'site.description'), language: LANGUAGE[lang], self: abs(withBase(`${lang}/rss.xml`)) },
    items,
  );
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};

