// The RSS feeds on dist/ (src/pages/[lang]/rss.xml.ts, src/lib/rss.ts), part of postbuild. For each language:
//   - the XML is well formed (sax, strict); the channel has a title, the home page of the language, a description, the language and the address of the feed itself;
//   - the items are exactly the stories that are on the site today (ready, published today or before in Lisbon: src/lib/publication.mjs) and written in the language
//     (Russian needs ru_ready): as many items as such stories, each one's address is the address of its page; no story that is not on the site;
//   - every address is absolute, on the same site as the channel, without a query (no ?src); guid is the link; the days are valid and the items are newest first;
//   - the head of the home page of the language points at the feed (<link rel="alternate" type="application/rss+xml">).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { isLive } from '../src/lib/publication.mjs';
import { parseFeed } from './lib/xml.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = process.env.CHECK_DIST || join(root, 'dist');
const eventsDir = process.env.CHECK_EVENTS || join(root, 'src/content/events');
const SEGMENT = { pt: 'historia', en: 'story', ru: 'istoriya' };
const LANGUAGE = { pt: 'pt-PT', en: 'en-US', ru: 'ru' };
const errors = [];

const stories = readdirSync(eventsDir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(join(eventsDir, f), 'utf8'), { schema: 'core' }))
  .filter((s) => isLive(s) && s.placeholder !== true);

let total = 0;
for (const lang of ['pt', 'en', 'ru']) {
  const file = join(dist, lang, 'rss.xml');
  if (!existsSync(file)) {
    errors.push(`${lang}/rss.xml is missing`);
    continue;
  }
  let feed;
  try {
    feed = parseFeed(readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${lang}/rss.xml is not well-formed XML: ${e.message.split('\n')[0]}`);
    continue;
  }
  const { channel, items, selfLink } = feed;
  const fail = (what) => errors.push(`${lang}/rss.xml: ${what}`);
  let origin;
  try {
    origin = new URL(channel.link).origin;
  } catch {
    fail(`the channel link "${channel.link}" is not an absolute address`);
    continue;
  }
  if (!channel.title || !channel.description) fail('the channel needs a title and a description');
  if (channel.link !== `${origin}/${lang}/`) fail(`the channel link is ${channel.link}, not the home page of the language`);
  if (channel.language !== LANGUAGE[lang]) fail(`the language is "${channel.language}", expected ${LANGUAGE[lang]}`);
  if (selfLink !== `${origin}/${lang}/rss.xml`) fail(`atom:link rel="self" is ${selfLink}`);

  // What the feed must hold, from the data (not a number written here).
  const expected = stories.filter((s) => lang !== 'ru' || s.ru_ready === true);
  const wanted = new Set(expected.map((s) => `${origin}/${lang}/${SEGMENT[lang]}/${s.slug[lang]}/`));
  if (items.length !== expected.length) fail(`${items.length} items, but ${expected.length} stories are on the site in this language`);
  const seen = new Set();
  let previous = '9999-99-99';
  for (const item of items) {
    const where = item.link ?? '(no link)';
    for (const key of ['title', 'link', 'guid', 'pubDate', 'description']) if (!item[key]) fail(`${where}: no ${key}`);
    if (!item.link) continue;
    try {
      const u = new URL(item.link);
      if (u.origin !== origin) fail(`${where}: not on the site of the channel (${origin})`);
      if (u.search || u.hash) fail(`${where}: the address has a query or a fragment`);
    } catch {
      fail(`${where}: not an absolute address`);
    }
    if (item.guid !== item.link) fail(`${where}: guid is not the link`);
    if (!wanted.has(item.link)) fail(`${where}: this story is not on the site in this language (a draft, a story of a later day, or a Russian stand-in)`);
    if (seen.has(item.link)) fail(`${where}: twice in the feed`);
    seen.add(item.link);
    const day = Number.isNaN(Date.parse(item.pubDate)) ? undefined : new Date(item.pubDate).toISOString().slice(0, 10);
    if (!day) fail(`${where}: pubDate "${item.pubDate}" is not a date`);
    else {
      if (day > previous) fail(`${where}: the items are not newest first`);
      previous = day;
    }
    for (const e of item.enclosures) {
      try {
        if (new URL(e.url).origin !== origin) fail(`${where}: the picture is not on the site`);
      } catch {
        fail(`${where}: the address of the picture is not absolute`);
      }
      if (!/^image\//.test(e.type ?? '') || !(Number(e.length) > 0)) fail(`${where}: the picture needs a type and a size`);
    }
  }
  for (const link of wanted) if (!seen.has(link)) fail(`${link} is on the site but not in the feed`);
  total += items.length;

  const home = join(dist, lang, 'index.html');
  if (existsSync(home)) {
    const html = readFileSync(home, 'utf8');
    if (!new RegExp(`<link rel="alternate" type="application/rss\\+xml"[^>]*href="${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${lang}/rss\\.xml"`).test(html)) fail('the head of the home page does not point at the feed');
  }
}

if (errors.length) {
  console.error(`RSS check failed (${errors.length}):`);
  for (const e of errors.slice(0, 40)) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`RSS check passed: 3 feeds, ${total} items (the stories on the site in each language), well-formed, absolute addresses, newest first.`);
