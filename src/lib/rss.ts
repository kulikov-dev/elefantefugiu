// The RSS feeds of the stories (/pt/rss.xml, /en/rss.xml, /ru/rss.xml; the endpoint is src/pages/[lang]/rss.xml.ts). Pure functions, no Astro imports, so the
// rules run in plain unit tests. Only stories that are on the site (the same rule as the sitemap: src/lib/publication.mjs) and are written in the language of the feed
// (a Russian page that stands in for a story without a Russian text is not in the Russian feed), newest first; no full text, no tracking address.

export interface FeedItem {
  title: string;
  /** The absolute address of the story page; it is also the guid. */
  link: string;
  /** The day of publication, YYYY-MM-DD. */
  published: string;
  description: string;
  /** The picture of the story, when it has one: address, size of the file in bytes, type. */
  enclosure?: { url: string; length: number; type: string } | undefined;
}

export interface FeedChannel {
  title: string;
  /** The home page of the language. */
  link: string;
  description: string;
  /** BCP 47: pt-PT, en-US, ru. */
  language: string;
  /** The address of the feed itself (atom:link rel="self"). */
  self: string;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
export const xmlEscape = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** A day as an RFC 822 date at noon UTC (a reader in any time zone shows the same day). */
export const rssDate = (day: string): string => new Date(`${day}T12:00:00Z`).toUTCString();

/** The stories of a feed: written in the language (ru needs ru_ready), newest first (by the day of publication, then by id so the order is fixed). */
export function feedStories<T extends { id: string; published: string; ru_ready?: boolean | undefined }>(stories: readonly T[], lang: string): T[] {
  return stories
    .filter((s) => lang !== 'ru' || s.ru_ready === true)
    .sort((a, b) => (a.published === b.published ? a.id.localeCompare(b.id) : a.published < b.published ? 1 : -1));
}

/** The feed as XML text. `builtAt` is lastBuildDate. */
export function buildRss(channel: FeedChannel, items: readonly FeedItem[], builtAt: Date = new Date()): string {
  const body = items
    .map(
      (item) =>
        [
          '    <item>',
          `      <title>${xmlEscape(item.title)}</title>`,
          `      <link>${xmlEscape(item.link)}</link>`,
          `      <guid isPermaLink="true">${xmlEscape(item.link)}</guid>`,
          `      <pubDate>${rssDate(item.published)}</pubDate>`,
          `      <description>${xmlEscape(item.description)}</description>`,
          item.enclosure ? `      <enclosure url="${xmlEscape(item.enclosure.url)}" length="${item.enclosure.length}" type="${xmlEscape(item.enclosure.type)}" />` : '',
          '    </item>',
        ]
          .filter(Boolean)
          .join('\n'),
    )
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${xmlEscape(channel.title)}</title>`,
    `    <link>${xmlEscape(channel.link)}</link>`,
    `    <description>${xmlEscape(channel.description)}</description>`,
    `    <language>${xmlEscape(channel.language)}</language>`,
    `    <lastBuildDate>${builtAt.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${xmlEscape(channel.self)}" rel="self" type="application/rss+xml" />`,
    body,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
