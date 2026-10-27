// Checks the schema.org markup (JSON-LD) of the built pages (part of postbuild; also `npm run check:schema`).
//  - every indexable page has exactly one JSON-LD script that parses, with WebSite and Organization (no email address);
//  - a story page has an Article (headline, description equal to the meta description, image, inLanguage, datePublished,
//    dateModified, author and publisher, about = Event with a start date and a place, contentLocation with geo, citation) and a BreadcrumbList;
//  - an epoch page has a CollectionPage, an ItemList of its stories and a BreadcrumbList; map, thread, About, Method and Legal have a
//    WebPage (AboutPage) and a BreadcrumbList;
//  - every address in the markup is absolute and on the domain of the site (the citations are the sources and may be anywhere);
//  - the picture named in `image` is in dist/;
//  - pages with noindex have no markup.
// A story with no `published` date stops the data check long before this one; this is the last gate on what the pages say.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

const sitemapFirst = readFileSync(join(dist, 'sitemap.xml'), 'utf8').match(/<loc>([^<]+)<\/loc>/)?.[1];
const origin = new URL(process.env.SITE_URL || sitemapFirst).origin;
if (process.env.SITE_URL && sitemapFirst && new URL(sitemapFirst).origin !== origin) {
  console.error(`Schema check failed: SITE_URL is ${origin} but the sitemap is for ${new URL(sitemapFirst).origin}.`);
  process.exit(1);
}
const raw = (process.env.BASE_PATH || '').trim();
const base = raw && raw !== '/' ? `/${raw.replace(/^\/+|\/+$/g, '')}/` : '/';

const STORY = /^(pt\/historia|en\/story|ru\/istoriya)\/[^/]+\/index\.html$/;
const EPOCH = /^(pt\/epoca|en\/era|ru\/epoha)\/[^/]+\/index\.html$/;
const HOME = /^(pt|en|ru)\/index\.html$/;
const ABOUT = /^(pt\/sobre|en\/about|ru\/o-proekte)\/index\.html$/;
const LOCALE = { pt: 'pt-PT', en: 'en-GB', ru: 'ru-RU' };

const errors = [];
const smallImages = [];
let checked = 0;
let stories = 0;

const asArray = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const filled = (v) => typeof v === 'string' && v.trim() !== '';
const isoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// Addresses in the markup: the keys below hold one; `citation` is left alone (the sources of the story are on other sites).
const URL_KEYS = new Set(['url', '@id', 'item', 'image', 'logo', 'mainEntityOfPage']);
function addresses(value, path, out) {
  if (Array.isArray(value)) value.forEach((v, i) => addresses(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'citation') continue;
      if (URL_KEYS.has(k) && typeof v === 'string') out.push([`${path}.${k}`, v]);
      else addresses(v, `${path}.${k}`, out);
    }
  }
}

function imageSize(file) {
  const b = readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) return undefined;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return undefined;
}

for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
  const path = relative(dist, file).replace(/\\/g, '/');
  if (path === '404.html' || path === 'index.html' || path.startsWith('p/')) continue;
  const html = readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const fail = (what) => errors.push(`${path}: ${what}`);

  if (/<meta name="robots" content="[^"]*noindex/.test(html)) {
    if (scripts.length) fail('a page with noindex carries JSON-LD');
    continue;
  }
  checked += 1;
  if (scripts.length !== 1) {
    fail(`${scripts.length} JSON-LD scripts, expected 1`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(scripts[0]);
  } catch (e) {
    fail(`JSON-LD does not parse (${e.message})`);
    continue;
  }
  if (data['@context'] !== 'https://schema.org') fail('@context is not https://schema.org');
  const nodes = data['@graph'];
  if (!Array.isArray(nodes) || nodes.length === 0) {
    fail('no @graph');
    continue;
  }
  const byType = (type) => nodes.filter((n) => n['@type'] === type);
  const one = (type) => {
    const found = byType(type);
    if (found.length !== 1) fail(`${found.length} nodes of type ${type}, expected 1`);
    return found[0];
  };
  const need = (node, label, field, test = filled) => {
    if (!node || !test(node[field])) fail(`${label}.${field} is missing or empty`);
  };
  const lang = path.slice(0, 2);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const metaDescription = html.match(/<meta name="description" content="([^"]*)"/)?.[1];

  // WebSite and Organization: every page.
  const site = one('WebSite');
  need(site, 'WebSite', 'name');
  need(site, 'WebSite', 'alternateName');
  need(site, 'WebSite', 'url');
  if (site && site.inLanguage !== LOCALE[lang]) fail(`WebSite.inLanguage is "${site.inLanguage}", expected "${LOCALE[lang]}"`);
  const org = one('Organization');
  need(org, 'Organization', 'name');
  need(org, 'Organization', 'url');
  if (org && !/\.png$/i.test(org.logo?.url ?? '')) fail('Organization.logo.url is not a PNG');
  if (/@[\w-]+\.[a-z]{2,}|mailto:/i.test(scripts[0])) fail('an email address is written in the JSON-LD');

  // The page itself.
  let pageNodes = [];
  if (STORY.test(path)) {
    stories += 1;
    const article = one('Article');
    for (const f of ['headline', 'description', 'inLanguage', 'datePublished', 'dateModified']) need(article, 'Article', f);
    if (article) {
      if (!isoDate(article.datePublished)) fail(`Article.datePublished "${article.datePublished}" is not YYYY-MM-DD`);
      if (!isoDate(article.dateModified)) fail(`Article.dateModified "${article.dateModified}" is not YYYY-MM-DD`);
      else if (article.dateModified < article.datePublished) fail('Article.dateModified is earlier than datePublished');
      if (article.inLanguage !== LOCALE[lang]) fail(`Article.inLanguage is "${article.inLanguage}", expected "${LOCALE[lang]}"`);
      if (metaDescription !== undefined && article.description !== metaDescription.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')) fail('Article.description differs from the meta description');
      need(article, 'Article', 'image', (v) => asArray(v).length > 0 && asArray(v).every(filled));
      need(article, 'Article', 'author', (v) => v?.['@id'] !== undefined || filled(v?.name));
      need(article, 'Article', 'publisher', (v) => v?.['@id'] !== undefined || filled(v?.name));
      need(article, 'Article', 'isPartOf', (v) => v && typeof v === 'object');
      const about = article.about;
      if (about?.['@type'] !== 'Event') fail('Article.about is not an Event');
      else {
        need(about, 'about', 'name');
        need(about, 'about', 'startDate', (v) => typeof v === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v));
        need(about, 'about', 'location', (v) => v?.['@type'] === 'Place' && filled(v.name));
      }
      const loc = article.contentLocation;
      if (loc?.['@type'] !== 'Place') fail('Article.contentLocation is not a Place');
      else {
        need(loc, 'contentLocation', 'name');
        const geo = loc.geo;
        if (!geo || typeof geo.latitude !== 'number' || typeof geo.longitude !== 'number' || Math.abs(geo.latitude) > 90 || Math.abs(geo.longitude) > 180) fail('contentLocation.geo has no valid latitude / longitude');
      }
      const citation = asArray(article.citation);
      if (citation.length === 0 || !citation.every((c) => /^https?:\/\//.test(c))) fail('Article.citation is empty or has an address that is not http(s)');
      if (article.url !== canonical) fail(`Article.url differs from the canonical address (${article.url} / ${canonical})`);
    }
    const crumbs = one('BreadcrumbList');
    const items = crumbs?.itemListElement ?? [];
    if (items.length < 2) fail('BreadcrumbList has fewer than 2 items (home, story)');
    if (items.at(-1)?.item !== canonical) fail('the last BreadcrumbList item is not this page');
    pageNodes = [article, crumbs];
  } else if (EPOCH.test(path)) {
    const page = one('CollectionPage');
    for (const f of ['name', 'description', 'url', 'inLanguage']) need(page, 'CollectionPage', f);
    const list = one('ItemList');
    const items = list?.itemListElement ?? [];
    if (items.length === 0) fail('ItemList has no stories');
    if (list && list.numberOfItems !== items.length) fail('ItemList.numberOfItems differs from the number of items');
    items.forEach((it, i) => {
      if (it.position !== i + 1 || !filled(it.url) || !filled(it.name)) fail(`ItemList item ${i + 1} has no position, url or name`);
    });
    const crumbs = one('BreadcrumbList');
    if ((crumbs?.itemListElement ?? []).length < 2) fail('BreadcrumbList has fewer than 2 items');
    pageNodes = [page, list, crumbs];
  } else if (!HOME.test(path)) {
    // Map, thread, About, Method, Legal.
    const type = ABOUT.test(path) ? 'AboutPage' : 'WebPage';
    const page = one(type);
    for (const f of ['name', 'description', 'url', 'inLanguage']) need(page, type, f);
    const crumbs = one('BreadcrumbList');
    if ((crumbs?.itemListElement ?? []).length < 2) fail('BreadcrumbList has fewer than 2 items');
    pageNodes = [page, crumbs];
  }
  if (pageNodes.some((n) => n && n['@type'] !== 'BreadcrumbList' && n.url !== undefined && n.url !== canonical && n['@type'] !== 'ItemList')) fail('the url of the page node differs from the canonical address');

  // Addresses: absolute, on this site; the picture exists.
  const found = [];
  addresses(data, '$', found);
  for (const [where, value] of found) {
    if (!/^https?:\/\//.test(value)) {
      fail(`${where} is not an absolute address: ${value}`);
      continue;
    }
    if (new URL(value).origin !== origin) fail(`${where} is not on ${origin}: ${value}`);
  }
  const article = byType('Article')[0];
  for (const img of [...asArray(article?.image), org?.logo?.url].filter(Boolean)) {
    const rel = decodeURIComponent(new URL(img).pathname);
    const local = join(dist, rel.startsWith(base) ? rel.slice(base.length) : rel);
    if (!existsSync(local)) fail(`the picture ${img} is not in dist/`);
    else if (img !== org?.logo?.url) {
      const size = imageSize(local);
      if (size && size.w < 1200) smallImages.push(`${path} (${size.w}x${size.h})`);
    }
  }
}

if (checked === 0) errors.push('no indexable page found in dist/ (run npm run build first)');
if (errors.length) {
  console.error(`Schema check failed:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`Schema check passed: ${checked} indexable pages have valid JSON-LD (${stories} story pages with Article, Event, geo and breadcrumbs); noindex pages have none.`);
if (smallImages.length) console.log(`  NOTE: ${smallImages.length} story picture(s) narrower than 1200 px (the source file is smaller): ${smallImages.join(', ')}`);
