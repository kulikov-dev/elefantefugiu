import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { buildRss, feedStories, rssDate, xmlEscape, type FeedItem } from '../../src/lib/rss';
import { isLive } from '../../src/lib/publication.mjs';
import { parseFeed } from '../../scripts/lib/xml.mjs';

const channel = { title: 'O Elefante Fugiu', link: 'https://elefantefugiu.pt/pt/', description: 'Histórias & mais', language: 'pt-PT', self: 'https://elefantefugiu.pt/pt/rss.xml' };
const item = (n: number, extra: Partial<FeedItem> = {}): FeedItem => ({
  title: `Story ${n} <b> & "q"`,
  link: `https://elefantefugiu.pt/pt/historia/story-${n}/`,
  published: `2026-10-${String(10 + n).padStart(2, '0')}`,
  description: `Hook ${n}. First sentence ${n}.`,
  ...extra,
});

describe('buildRss', () => {
  it('is well-formed XML with a channel and one item per story; text is escaped', () => {
    const feed = parseFeed(buildRss(channel, [item(1), item(2)], new Date('2026-11-01T05:00:00Z')));
    expect(feed.channel.title).toBe('O Elefante Fugiu');
    expect(feed.channel.description).toBe('Histórias & mais');
    expect(feed.channel.language).toBe('pt-PT');
    expect(feed.channel.link).toBe('https://elefantefugiu.pt/pt/');
    expect(feed.selfLink).toBe('https://elefantefugiu.pt/pt/rss.xml');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0].title).toBe('Story 1 <b> & "q"');
  });
  it('the guid is the link, the date is the day of publication, the description is what was given (no full text)', () => {
    const [first] = parseFeed(buildRss(channel, [item(3)])).items;
    expect(first.guid).toBe(first.link);
    expect(first.guidIsPermaLink).toBe('true');
    expect(first.pubDate).toBe('Tue, 13 Oct 2026 12:00:00 GMT');
    expect(first.description).toBe('Hook 3. First sentence 3.');
  });
  it('a picture is an enclosure with its address, size and type; no picture, no enclosure', () => {
    const withPicture = parseFeed(buildRss(channel, [item(1, { enclosure: { url: 'https://elefantefugiu.pt/_astro/x.webp', length: 1234, type: 'image/webp' } }), item(2)])).items;
    expect(withPicture[0].enclosures).toEqual([{ url: 'https://elefantefugiu.pt/_astro/x.webp', length: '1234', type: 'image/webp' }]);
    expect(withPicture[1].enclosures).toEqual([]);
  });
  it('nothing in it is a bare & or < (the sax parser in strict mode would stop)', () => {
    expect(() => parseFeed(buildRss(channel, [item(1, { title: 'A & B < C > D' })]))).not.toThrow();
    expect(xmlEscape('a & <b> "c"')).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });
  it('rssDate is noon UTC of the day', () => {
    expect(rssDate('2026-10-30')).toBe('Fri, 30 Oct 2026 12:00:00 GMT');
  });
});

describe('feedStories: the stories of a feed', () => {
  const s = (id: string, published: string, ru_ready?: boolean) => ({ id, published, ru_ready });
  const all = [s('a', '2026-10-01', true), s('b', '2026-10-03'), s('c', '2026-10-03', true), s('d', '2026-10-02', false)];
  it('newest first, the same day by id', () => {
    expect(feedStories(all, 'pt').map((x) => x.id)).toEqual(['b', 'c', 'd', 'a']);
  });
  it('the Russian feed has only the stories written in Russian (ru_ready), not the stand-in pages', () => {
    expect(feedStories(all, 'ru').map((x) => x.id)).toEqual(['c', 'a']);
  });
});

describe('the feeds against the data', () => {
  // The numbers come from the YAML files of the stories, with today's rule of visibility.
  const events = readdirSync('src/content/events')
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(`src/content/events/${f}`, 'utf8'), { schema: 'core' }) as { id: string; status: string; published: string; ru_ready?: boolean; placeholder?: boolean });
  const live = events.filter((e) => isLive(e) && e.placeholder !== true);
  it('a feed holds exactly the stories that are on the site in its language, never a draft', () => {
    expect(live.length).toBeGreaterThan(0);
    expect(feedStories(live, 'pt')).toHaveLength(live.length);
    expect(feedStories(live, 'en')).toHaveLength(live.length);
    expect(feedStories(live, 'ru')).toHaveLength(live.filter((e) => e.ru_ready === true).length);
    for (const lang of ['pt', 'en', 'ru']) for (const e of feedStories(live, lang)) expect(e.status, `${lang} ${e.id}`).toBe('ready');
  });
});
