// Preview cards on dist/ (scripts/make-og.mjs, src/lib/og-cards.ts). Every indexable story page, every page of a live epoch and the home page of every
// language must have:
//   - og:image with an absolute address on our own domain (the one of its canonical address), og:image:width / height / type that match the file,
//     twitter:image the same as og:image and twitter:card summary_large_image;
//   - the file in dist/, a JPEG of 1200 x 630, at most 200 KB, with the hash in its name (a changed card is fetched anew by the messengers).
// A page of an epoch or the home page must have a card when the manifest of make-og.mjs has one for it.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist/');
const MAX = 200 * 1024;
const errors = [];
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, attr, name) => new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1];
let manifest = {};
try {
  manifest = JSON.parse(readFileSync(join(root, '.og-cache/manifest.json'), 'utf8'));
} catch {
  // No manifest (a build that skipped make-og.mjs): only the rules below apply.
}

const EPOCH_PAGE = /^(pt\/epoca|en\/era|ru\/epoha)\/[^/]+\/index\.html$/;
const HOME_PAGE = /^(pt|en|ru)\/index\.html$/;
const FESTA_PAGE = /^(pt|en|ru)\/festa\/[^/]+\/index\.html$/;
const counts = { story: 0, epoch: 0, home: 0, festa: 0 };
let cards = 0;
for (const file of walk(dist).filter((f) => f.endsWith('index.html'))) {
  const html = readFileSync(file, 'utf8');
  const rel = relative(dist, file).split(sep).join('/');
  const isStory = meta(html, 'property', 'og:type') === 'article';
  const kind = isStory ? 'story' : EPOCH_PAGE.test(rel) ? 'epoch' : HOME_PAGE.test(rel) ? 'home' : FESTA_PAGE.test(rel) ? 'festa' : null;
  if (!kind || /<meta name="robots" content="noindex"/.test(html)) continue;
  counts[kind] += 1;
  const fail = (what) => errors.push(`${rel}: ${what}`);
  const og = meta(html, 'property', 'og:image');
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  if (!og) {
    fail('no og:image');
    continue;
  }
  let url;
  let site;
  try {
    url = new URL(og);
    site = new URL(canonical);
  } catch {
    fail(`og:image "${og}" or the canonical address is not an absolute address`);
    continue;
  }
  if (url.origin !== site.origin) fail(`og:image is on ${url.origin}, not on our domain ${site.origin}`);
  // The base path of the site: the canonical path is base + the path of the page.
  const base = site.pathname.slice(0, site.pathname.length - `/${rel}`.replace(/index\.html$/, '').length);
  const path = decodeURIComponent(url.pathname).slice(base.length).replace(/^\/+/, '');
  const imageFile = join(dist, path);
  if (!existsSync(imageFile)) {
    fail(`og:image ${og} is not in dist/ (${path})`);
    continue;
  }
  const size = statSync(imageFile).size;
  const info = await sharp(imageFile).metadata();
  if (info.width !== 1200 || info.height !== 630) fail(`${path} is ${info.width}x${info.height}, not 1200x630`);
  if (size > MAX) fail(`${path} is ${(size / 1024).toFixed(0)} KB, more than 200 KB`);
  const isCard = /^og-cards\/(pt|en|ru)\/.+-[0-9a-f]{10}\.jpg$/.test(path);
  const epochId = /<html[^>]* data-epoch="([^"]+)"/.exec(html)?.[1];
  const key = kind === 'story' || kind === 'festa' ? undefined : kind === 'home' ? 'home' : `epoch:${epochId}`;
  const lang = rel.split('/')[0];
  // The page of a holiday and the home page in its window share the picture of the holiday (scripts/make-festa-og.mjs): 1200x630, the hash in its name, a PNG (the drawing)
  // or a JPEG (the picture of the owner, festas.yaml `image`).
  const isFesta = (kind === 'home' || kind === 'festa') && /^og-festas\/[a-z0-9-]+-[0-9a-f]{10}\.(png|jpg)$/.test(path);
  if (isFesta && info.format !== (path.endsWith('.jpg') ? 'jpeg' : 'png')) fail(`${path} is not a ${path.endsWith('.jpg') ? 'JPEG' : 'PNG'}`);
  if (kind === 'festa' && / · O Elefante Fugiu$/.test(decode(meta(html, 'property', 'og:title') ?? ''))) fail('og:title of the page of a holiday is the name and the date, with no name of the site');
  if (kind === 'festa' && !isFesta) fail(`og:image ${path} is not the picture of the holiday (og-festas/<id>-<hash>)`);
  const mustHaveCard = kind === 'story' || (key && manifest[key]?.[lang]);
  if (mustHaveCard && !isCard && !isFesta) fail(`og:image ${path} is not a card with a hash in its name (og-cards/<lang>/<slug>-<hash>.jpg)`);
  if (isCard) {
    cards += 1;
    if (key && manifest[key]?.[lang] && manifest[key][lang] !== path) fail(`og:image ${path} is not the card of the manifest (${manifest[key][lang]})`);
    if (meta(html, 'property', 'og:image:width') !== String(info.width) || meta(html, 'property', 'og:image:height') !== String(info.height)) fail('og:image:width / og:image:height are missing or do not match the file');
    if (meta(html, 'property', 'og:image:type') !== 'image/jpeg' || info.format !== 'jpeg') fail('og:image:type is missing or is not image/jpeg');
  }
  if (!meta(html, 'property', 'og:image:alt')) fail('no og:image:alt');
  if (kind === 'story') {
    // The title of a story is its name (not the hook), at most 60 characters; the description is the hook, at most 200.
    const ogTitle = decode(meta(html, 'property', 'og:title') ?? '');
    const ogDescription = decode(meta(html, 'property', 'og:description') ?? '');
    if (!ogTitle) fail('no og:title');
    else if ([...ogTitle].length > 60) fail(`og:title is ${[...ogTitle].length} characters, more than 60: "${ogTitle}"`);
    if (meta(html, 'name', 'twitter:title') !== meta(html, 'property', 'og:title')) fail('twitter:title is not the same as og:title');
    if (!ogDescription) fail('no og:description');
    else if ([...ogDescription].length > 200) fail(`og:description is ${[...ogDescription].length} characters, more than 200`);
    if (meta(html, 'name', 'twitter:description') !== meta(html, 'property', 'og:description')) fail('twitter:description is not the same as og:description');
    if (ogTitle && ogTitle === ogDescription) fail('og:title and og:description are the same text (the title must be the name of the story, the description its hook)');
  }
  if (meta(html, 'name', 'twitter:image') !== og) fail('twitter:image is not the same as og:image');
  if (meta(html, 'name', 'twitter:card') !== 'summary_large_image') fail('twitter:card is not summary_large_image');
}
if (counts.story === 0) errors.push('no story page found in dist/');
if (counts.home !== 3) errors.push(`${counts.home} home pages checked, expected 3 (pt, en, ru; a noindex home page is not checked)`);
for (const key of Object.keys(manifest).filter((k) => k.startsWith('epoch:'))) {
  for (const lang of ['pt', 'en', 'ru']) if (!existsSync(join(dist, manifest[key][lang]))) errors.push(`${manifest[key][lang]} of ${key} is not in dist/`);
}

if (errors.length) {
  console.error(`Preview card check failed (${errors.length}):`);
  for (const e of errors.slice(0, 40)) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Preview card check passed: ${counts.story} story pages, ${counts.epoch} epoch pages, ${counts.home} home pages, ${cards} with a card (1200x630 JPEG, up to 200 KB, absolute address on our domain, size and type in the head).`);
