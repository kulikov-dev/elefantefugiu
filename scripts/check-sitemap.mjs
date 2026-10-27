// Checks dist/sitemap.xml against the built pages (part of postbuild, after make-sitemap.mjs).
//  - every built page that may be indexed is in the sitemap, and every address in the sitemap is a built page;
//  - the QR pages (/p/...), the 404 page and the language chooser at the root are not in it;
//  - every hreflang alternate of an entry is itself an entry (the sitemap does not point to a page it leaves out);
//  - every indexable page, Russian ones included, declares hreflang pt, en, ru and x-default.
// Pages with noindex are left out on purpose: the report form and "Surprise me" always, and a page with a test text or a
// placeholder while there is one. The latter are listed as a NOTE, because they are what keeps a page out of the search index.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const ALWAYS_NOINDEX = /^(pt\/corrigir|en\/report|ru\/oshibka|pt\/surpreende-me|en\/surprise-me|ru\/udivi-menya)\/index\.html$/;

const xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const alternates = [...xml.matchAll(/hreflang="[^"]+" href="([^"]+)"/g)].map((m) => m[1]);
const listed = new Set(locs);
const errors = [];
const notes = [];
const canonicals = new Set();
let indexable = 0;

for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
  const path = relative(dist, file).replace(/\\/g, '/');
  if (path === '404.html' || path === 'index.html' || path.startsWith('p/')) continue;
  const html = readFileSync(file, 'utf8');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canonical) canonicals.add(canonical);
  if (/<meta name="robots" content="[^"]*noindex/.test(html)) {
    if (!ALWAYS_NOINDEX.test(path)) notes.push(path);
    continue;
  }
  indexable += 1;
  if (!canonical || !listed.has(canonical)) errors.push(`${path}: may be indexed but is not in the sitemap`);
  // Russian is a language like the others: an indexable page names pt, en, ru and x-default (the pt page) as its alternates.
  const langs = new Set([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)].map((m) => m[1]));
  for (const want of ['pt', 'en', 'ru', 'x-default']) if (!langs.has(want)) errors.push(`${path}: no hreflang="${want}" alternate`);
}

for (const loc of locs) {
  if (/\/p\//.test(new URL(loc).pathname)) errors.push(`${loc}: a QR page is in the sitemap`);
  if (!canonicals.has(loc)) errors.push(`${loc}: no built page has this address`);
}
for (const href of new Set(alternates)) if (!listed.has(href)) errors.push(`${href}: named as an alternate but not an entry of the sitemap`);
if (new Set(locs).size !== locs.length) errors.push('an address is listed twice');

if (errors.length) {
  console.error(`Sitemap check failed:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`Sitemap check passed: ${locs.length} addresses, all ${indexable} indexable pages of dist/ are in it; no QR pages, no 404.`);
if (notes.length) console.log(`  NOTE: ${notes.length} page(s) left out by noindex (test text or placeholder): ${notes.join(', ')}`);
