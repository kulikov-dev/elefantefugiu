// Checks that dist/ holds nothing from cards that are not published: no page, no sitemap line, no map point, no link, no text.
// Part of postbuild. "Not published" is every card in src/content/events that is not `status: ready`, or that is a test fixture
// (`placeholder: true`, the evento-exemplo-* stand-ins). The browser suites (scripts/qa) build such cards into a separate copy of the site
// outside this repository; this check is what keeps them from ever reaching the real one.
//
// What it looks at, in every file of dist/ that is text (html, xml, json, js, css, txt, webmanifest):
//  - the path: no directory or file named after the id or a slug of such a card (the card page, the QR page /p/<id>/, any language);
//  - the content: no id and no slug of such a card, and no `evento-exemplo` at all;
//  - the title of such a card in any language (a card cannot be mentioned by name in a list);
//  - every map configuration (`data-map-config`, `data-home-map-config`): each point is a published card, and there are as many points as published cards.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
// CHECK_DIST=<dir> checks another build (the browser suites use it to prove that the fixture build WOULD be caught).
const dist = process.env.CHECK_DIST || join(root, 'dist');
const eventsDir = join(root, 'src/content/events');
const TEXT = new Set(['.html', '.xml', '.json', '.js', '.css', '.txt', '.webmanifest', '.svg']);

const cards = readdirSync(eventsDir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({ file: f, ...parse(readFileSync(join(eventsDir, f), 'utf8'), { schema: 'core' }) }));
const isPublished = (c) => c.status === 'ready' && c.placeholder !== true;
const published = cards.filter(isPublished);
const hidden = cards.filter((c) => !isPublished(c));

const errors = [];
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const files = walk(dist);

// Words that name a hidden card: its id and its slugs (a slug that is also the id of a published card, or too short to mean anything,
// is not used on its own).
const publishedWords = new Set(published.flatMap((c) => [c.id, ...Object.values(c.slug ?? {})]));
const words = [...new Set(hidden.flatMap((c) => [c.id, ...Object.values(c.slug ?? {})]))].filter((w) => w && w.length >= 6 && !publishedWords.has(w));
const titles = [...new Set(hidden.flatMap((c) => Object.values(c.title ?? {})))].filter((t) => typeof t === 'string' && t.length >= 12);
const wordRe = (w) => new RegExp(`(?<![\\w-])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
const wordRes = words.map((w) => [w, wordRe(w)]);

let looked = 0;
let points = 0;
let mapPages = 0;
for (const file of files) {
  const rel = relative(dist, file).split(sep).join('/');
  for (const w of words) if (rel.split('/').includes(w) || rel.split('/').some((part) => part.replace(/\.[a-z]+$/, '') === w)) errors.push(`${rel}: the path is named after a card that is not published (${w})`);
  if (!TEXT.has(extname(file))) continue;
  const text = readFileSync(file, 'utf8');
  looked += 1;
  if (/evento-exemplo/.test(text)) errors.push(`${rel}: "evento-exemplo" (a test fixture) appears in the file`);
  for (const [w, re] of wordRes) if (re.test(text)) errors.push(`${rel}: the id or slug of a card that is not published appears in the file (${w})`);
  if (extname(file) === '.html') {
    const body = text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    for (const t of titles) if (body.includes(t)) errors.push(`${rel}: the title of a card that is not published appears in the page ("${t}")`);
    for (const m of text.matchAll(/<script[^>]*data-(?:home-)?map-config[^>]*>([\s\S]*?)<\/script>/g)) {
      mapPages += 1;
      let config;
      try {
        config = JSON.parse(m[1]);
      } catch {
        errors.push(`${rel}: a map configuration is not valid JSON`);
        continue;
      }
      const ids = (config.cards ?? config.events ?? []).map((c) => c.id);
      points += ids.length;
      const stray = ids.filter((id) => !published.some((c) => c.id === id));
      if (stray.length > 0) errors.push(`${rel}: map points of cards that are not published: ${stray.join(', ')}`);
      // The map of the whole site (the map page, the home page) holds a point per published card; an epoch map holds the cards of that epoch.
      if (/^(?:pt|en|ru)\/(?:mapa|map|karta)\/index\.html$/.test(rel) || /^(?:pt|en|ru)\/index\.html$/.test(rel)) {
        if (ids.length !== published.length) errors.push(`${rel}: ${ids.length} map points for ${published.length} published cards`);
      }
    }
  }
}

if (published.length === 0) errors.push('no published card found: nothing to check against');
if (errors.length > 0) {
  console.error(`check-published failed (${errors.length}):`);
  for (const e of errors.slice(0, 40)) console.error(`- ${e}`);
  if (errors.length > 40) console.error(`... and ${errors.length - 40} more`);
  process.exit(1);
}
// Not a failure (ALLOW_PLACEHOLDER=false is the gate for a real launch), but worth saying: threads and epochs that still carry provisional fields.
const placeholderPages = ['threads', 'epochs'].flatMap((name) => parse(readFileSync(join(root, `src/content/${name}.yaml`), 'utf8'), { schema: 'core' }).filter((x) => x.placeholder === true || (Array.isArray(x.placeholder) && x.placeholder.length > 0)).map((x) => `${name}/${x.id}${Array.isArray(x.placeholder) ? ` [${x.placeholder.join(', ')}]` : ''}`));
if (placeholderPages.length > 0) console.log(`NOTE  still marked placeholder (their text is not final): ${placeholderPages.join(', ')}`);
console.log(`published check passed: ${published.length} published cards, ${hidden.length} not published (${hidden.map((c) => c.id).join(', ') || 'none'}); ${looked} text files, ${mapPages} map configurations with ${points} points: nothing of the others in dist/`);
