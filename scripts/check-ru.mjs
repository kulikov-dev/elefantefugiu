// Checks the built Russian pages in dist/ against the data (stage RU). Part of postbuild.
//   - an event with ru_ready: true has its own Russian address and text, no banner, hreflang pt, en, ru and x-default;
//   - an event without it has a Russian page at its English address with the English text, the banner "not translated",
//     noindex and no hreflang at all; its Portuguese and English pages name pt, en and x-default only (no ru);
//   - every Russian page is <html lang="ru"> with og:locale ru_RU; epoch, thread, home and static pages exist in Russian;
//   - the three language versions of a page name each other (hreflang) with the same set of languages.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const SEG = { pt: 'historia', en: 'story', ru: 'istoriya' };
const errors = [];
let pages = 0;
const fail = (where, message) => errors.push(`${where}: ${message}`);

const yaml = (path) => parse(readFileSync(path, 'utf8'), { schema: 'core', customTags: ['timestamp'] });
const dir = join(root, 'src/content/events');
const events = readdirSync(dir)
  .filter((n) => n.endsWith('.yaml'))
  .map((n) => yaml(join(dir, n)))
  .filter((e) => e.status === 'ready');
const epochs = yaml(join(root, 'src/content/epochs.yaml'));
const threads = yaml(join(root, 'src/content/threads.yaml'));

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);
const hreflangs = (html) => [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => m[1]);
const attr = (html, re) => html.match(re)?.[1];
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const h1 = (html) => plain(attr(html, /<h1[^>]*>([\s\S]*?)<\/h1>/) ?? '');

/** Checks every Russian page: language, locale. */
function basics(html, where) {
  pages += 1;
  if (!/<html lang="ru"/.test(html)) fail(where, 'is not <html lang="ru">');
  if (!/<meta property="og:locale" content="ru_RU"/.test(html)) fail(where, 'og:locale is not ru_RU');
  // The Russian pages preload their fonts (the late Cyrillic faces made the tags and the hook re-wrap on a phone); the pt and en pages preload three Latin faces (check-cards).
  const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? '';
  const preloads = [...head.matchAll(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g)].map((m) => m[0]);
  if (preloads.length !== 6 || !preloads.every((l) => /crossorigin/.test(l) && /type="font\/woff2"/.test(l))) fail(where, `${preloads.length} font preloads, six (crossorigin, woff2) are expected`);
}

for (const ev of events) {
  const ready = ev.ru_ready === true;
  const slugRu = ready ? ev.slug.ru : ev.slug.en;
  const where = `ru card ${ev.id}`;
  const html = read(join(dist, 'ru', SEG.ru, slugRu, 'index.html'));
  if (!html) {
    fail(where, `page /ru/${SEG.ru}/${slugRu}/ is missing`);
    continue;
  }
  basics(html, where);
  const hasBanner = /data-not-translated/.test(html);
  const noindex = /<meta name="robots" content="noindex"/.test(html);
  const langs = hreflangs(html);
  if (ready) {
    if (!ev.slug.ru) fail(where, 'ru_ready without a Russian slug');
    if (h1(html) !== ev.title.ru) fail(where, `h1 is "${h1(html)}", expected "${ev.title.ru}"`);
    if (hasBanner) fail(where, 'a card ready in Russian must not show the banner');
    if (langs.slice().sort().join() !== ['en', 'pt', 'ru', 'x-default'].sort().join()) fail(where, `hreflang is [${langs}], expected pt, en, ru, x-default`);
    if (!html.includes(`lang="ru"`)) fail(where, 'missing lang');
  } else {
    if (h1(html) !== ev.title.en) fail(where, `h1 is "${h1(html)}", expected the English title "${ev.title.en}"`);
    if (!hasBanner) fail(where, 'the banner "not translated" is missing');
    if (!noindex) fail(where, 'a stand-in Russian page must be noindex');
    if (langs.length > 0) fail(where, `a stand-in Russian page must have no hreflang, found [${langs}]`);
    if (!/<p[^>]*lang="(en|la)"/.test(html)) fail(where, 'the English story text must be marked lang="en" (or la for filler)');
  }
  // the pt and en pages of the same card
  for (const lang of ['pt', 'en']) {
    const other = read(join(dist, lang, SEG[lang], ev.slug[lang], 'index.html'));
    if (!other) continue;
    const got = hreflangs(other).sort().join();
    const want = (ready ? ['en', 'pt', 'ru', 'x-default'] : ['en', 'pt', 'x-default']).sort().join();
    if (got !== want) fail(`${lang} card ${ev.id}`, `hreflang is [${got}], expected [${want}]`);
    if (!ready && /<link rel="alternate" hreflang="ru"/.test(other)) fail(`${lang} card ${ev.id}`, 'names a Russian version that is not ready');
    if (!ready && /og:locale:alternate" content="ru_RU"/.test(other)) fail(`${lang} card ${ev.id}`, 'og:locale:alternate ru_RU for a card not ready in Russian');
  }
}

// Epochs and threads (Russian slugs from the data; every epoch with content and every visible thread has a page)
for (const [kind, list, segment] of [['epoch', epochs.filter((e) => e.mvp), 'epoha'], ['thread', threads, 'niti']]) {
  for (const item of list) {
    const ptPage = existsSync(join(dist, 'pt', kind === 'epoch' ? 'epoca' : 'fio', item.slug.pt, 'index.html'));
    if (!ptPage) continue; // no page in Portuguese (no cards, or thread too small): none in Russian either
    const where = `ru ${kind} ${item.id}`;
    const html = read(join(dist, 'ru', segment, item.slug.ru ?? item.slug.en, 'index.html'));
    if (!html) {
      fail(where, `page /ru/${segment}/${item.slug.ru ?? item.slug.en}/ is missing`);
      continue;
    }
    basics(html, where);
    if (h1(html) !== (item.name.ru ?? item.name.en)) fail(where, `h1 is "${h1(html)}", expected "${item.name.ru ?? item.name.en}"`);
    if (hreflangs(html).slice().sort().join() !== ['en', 'pt', 'ru', 'x-default'].sort().join()) fail(where, `hreflang is [${hreflangs(html)}]`);
    if (/data-not-translated/.test(html)) fail(where, 'must not show the card banner');
  }
}

// Home and static pages
for (const slug of ['', 'o-proekte', 'metod', 'oshibka', 'pravovaya-informaciya', 'karta']) {
  const html = read(join(dist, 'ru', slug, 'index.html'));
  if (!html) {
    fail(`ru /${slug}`, 'page is missing');
    continue;
  }
  basics(html, `ru /${slug}`);
  if (hreflangs(html).slice().sort().join() !== ['en', 'pt', 'ru', 'x-default'].sort().join()) fail(`ru /${slug}`, `hreflang is [${hreflangs(html)}]`);
}

// The root page leads to every language
const root_ = read(join(dist, 'index.html')) ?? '';
for (const lang of ['pt', 'en', 'ru']) if (!new RegExp(`hreflang="${lang}"`).test(root_)) fail('root /', `no link to ${lang}`);

if (errors.length) {
  console.error(`Russian check failed (${errors.length}):`);
  for (const e of errors.slice(0, 40)) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Russian check passed (${pages} Russian pages: lang, locale, own or stand-in text, banner, noindex, hreflang).`);
