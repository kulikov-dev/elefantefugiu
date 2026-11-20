// Part of postbuild. The cabinet of rarities (docs/spec.md "Кабинет редкостей") in the built site, against src/content/cabinet.yaml and src/lib/cabinet-config.mjs:
//   - the stories of the cabinet (the field `cabinet`) have a page of their own, noindex, with the ribbon, no read mark and no search index; they are in no other page,
//     feed, sitemap or list (a link to them, a line of the feeds, the pages of the games, the start and surprise lists);
//   - while the cabinet is closed (CABINET_OPENS null or a day to come): no link to the cabinet, no card in the hub, no sardine, no <button> of a hidden word, the cabinet
//     page itself is noindex and out of the sitemap; the words are plain spans, nothing more;
//   - once it is open: html[data-cabinet="open"], the card in the hub of the games, no link in the footer, the page of the cabinet indexable and in the sitemap.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { isCabinetOpen } from '../src/lib/cabinet-config.mjs';
import { isLive } from '../src/lib/publication.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const eventsDir = process.env.CHECK_EVENTS || join(root, 'src/content/events');
const open = isCabinetOpen();
const errors = [];

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const rel = (p) => p.slice(dist.length + 1).replaceAll('\\', '/');
const stories = readdirSync(eventsDir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(join(eventsDir, f), 'utf8'), { schema: 'core' }));
const own = stories.filter((s) => s.cabinet && isLive(s));
const SEGMENT = { pt: 'historia', en: 'story', ru: 'istoriya' };
const CABINET_PAGE = /^(pt\/gabinete|en\/cabinet|ru\/kabinet)\/index\.html$/;
const ownPages = new Map(); // dist path -> story
for (const s of own) for (const lang of ['pt', 'en', 'ru']) ownPages.set(`${lang}/${SEGMENT[lang]}/${s.slug[lang] ?? s.slug.en}/index.html`, s);
const ownHrefs = own.flatMap((s) => ['pt', 'en', 'ru'].map((lang) => `/${lang}/${SEGMENT[lang]}/${s.slug[lang] ?? s.slug.en}/`));

const files = walk(dist).filter((f) => !rel(f).startsWith('pagefind/'));
const pages = files.filter((f) => f.endsWith('.html'));
let words = 0;

for (const file of pages) {
  const name = rel(file);
  const text = readFileSync(file, 'utf8');
  const isOwn = ownPages.has(name);
  const isCabinetPage = CABINET_PAGE.test(name);
  const hrefs = [...text.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  words += (text.match(/<span class="cw" data-cw="/g) ?? []).length;

  // The stories of the cabinet are linked from the cabinet page and from nowhere else (and the page of the rarity leads back to the cabinet).
  if (!isCabinetPage) for (const href of hrefs) if (ownHrefs.some((h) => href.endsWith(h) && !isOwn)) errors.push(`${name}: a link to the story of the cabinet ${href}`);
  if (/<button[^>]*data-cw=/.test(text) || /cab-sardine/.test(text.replace(/<style[\s\S]*?<\/style>/g, ''))) errors.push(`${name}: a button of the cabinet is in the HTML (the script makes them)`);
  const wordIds = [...text.matchAll(/data-cw="([^"]+)"/g)].map((m) => m[1]);
  if (isOwn) {
    if (!/<meta name="robots" content="noindex"/.test(text)) errors.push(`${name}: the story of the cabinet is not noindex`);
    if (text.includes('data-pagefind-body')) errors.push(`${name}: the story of the cabinet is in the search index`);
    if (text.includes('data-story-end')) errors.push(`${name}: the story of the cabinet has a read mark`);
    if (!text.includes('cab-ribbon')) errors.push(`${name}: no ribbon "a rarity from the cabinet"`);
    if (wordIds.length > 0) errors.push(`${name}: the story of the cabinet hides a word`);
    if (open && !/data-cab-back><a href=/.test(text)) errors.push(`${name}: no way back to the cabinet`);
    if (!open && /data-cab-back><a/.test(text)) errors.push(`${name}: a link to the closed cabinet`);
  }

  if (open) {
    // The pages with the chrome of the site (not the redirect pages of /p/ and of the root).
    if (text.includes('class="site-footer"') && !/<html[^>]*data-cabinet="open"/.test(text)) errors.push(`${name}: html[data-cabinet="open"] is missing`);
    if (/(^|\/)(pt|en|ru)\/(jogos|games|igry)\/index\.html$/.test(name) && !text.includes('data-cabinet-card')) errors.push(`${name}: no card of the cabinet in the hub of the games`);
    // The way in is the hub of the games only: no link in the footer.
    if (/class="site-footer"/.test(text) && /<footer[\s\S]*<\/footer>/.exec(text)?.[0].match(/href="[^"]*\/(gabinete|cabinet|kabinet)\/"/)) errors.push(`${name}: a link to the cabinet in the footer`);
    if (isCabinetPage && /<meta name="robots" content="noindex"/.test(text)) errors.push(`${name}: the open cabinet is noindex`);
  } else {
    if (/data-cabinet="open"/.test(text)) errors.push(`${name}: html[data-cabinet="open"] while the cabinet is closed`);
    if (text.includes('data-cabinet-card') || text.includes('data-cabinet-link')) errors.push(`${name}: the card or the link of the cabinet while it is closed`);
    if (!isCabinetPage && hrefs.some((h) => /\/(gabinete|cabinet|kabinet)\/$/.test(h))) errors.push(`${name}: a link to the closed cabinet`);
    if (isCabinetPage && !/<meta name="robots" content="noindex"/.test(text)) errors.push(`${name}: the closed cabinet is not noindex`);
  }
}

// The lists: the sitemap, the feeds and the lists of the games and of "Surprise me" hold nothing of the cabinet's stories; the sitemap holds the cabinet page only when it is open.
const sitemap = existsSync(join(dist, 'sitemap.xml')) ? readFileSync(join(dist, 'sitemap.xml'), 'utf8') : '';
for (const href of ownHrefs) if (sitemap.includes(href)) errors.push(`sitemap.xml: ${href}`);
const inSitemap = /<loc>[^<]*\/(gabinete|cabinet|kabinet)\/<\/loc>/.test(sitemap);
if (open && !inSitemap) errors.push('sitemap.xml: the open cabinet is not in it');
if (!open && inSitemap) errors.push('sitemap.xml: the closed cabinet is in it');
for (const file of files.filter((f) => /\.(xml|json)$/.test(f) && !/sitemap\.xml$|cabinet\.json$/.test(f))) {
  const name = rel(file);
  const text = readFileSync(file, 'utf8');
  for (const s of own) {
    for (const lang of ['pt', 'en', 'ru']) {
      const slug = s.slug[lang] ?? s.slug.en;
      if (text.includes(`/${SEGMENT[lang]}/${slug}/`) || text.includes(`"${s.id}"`)) errors.push(`${name}: the story of the cabinet "${s.id}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Cabinet check failed (${errors.length}):\n${errors.slice(0, 40).map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`Cabinet check passed: the cabinet is ${open ? 'open' : 'closed'}; ${own.length} stor${own.length === 1 ? 'y' : 'ies'} of the cabinet on their own pages only; ${words} hidden word(s) in ${pages.length} pages as plain spans.`);
