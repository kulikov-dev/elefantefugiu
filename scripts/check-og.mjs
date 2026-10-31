// Preview cards of the stories on dist/ (scripts/make-og.mjs, src/lib/og-cards.ts). Every indexable story page must have:
//   - og:image with an absolute address on our own domain (the one of its canonical address), og:image:width / height / type that match the file,
//     twitter:image the same as og:image and twitter:card summary_large_image;
//   - the file in dist/, a JPEG of 1200 x 630, at most 200 KB, with the hash in its name (a changed card is fetched anew by the messengers).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const MAX = 200 * 1024;
const errors = [];
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const meta = (html, attr, name) => new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1];

let stories = 0;
let cards = 0;
for (const file of walk(dist).filter((f) => f.endsWith('index.html'))) {
  const html = readFileSync(file, 'utf8');
  if (meta(html, 'property', 'og:type') !== 'article' || /<meta name="robots" content="noindex"/.test(html)) continue;
  const rel = relative(dist, file).split(sep).join('/');
  stories += 1;
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
  if (!/^og-cards\/(pt|en|ru)\/.+-[0-9a-f]{10}\.jpg$/.test(path)) fail(`og:image ${path} is not a card with a hash in its name (og-cards/<lang>/<slug>-<hash>.jpg)`);
  else cards += 1;
  if (meta(html, 'property', 'og:image:width') !== String(info.width) || meta(html, 'property', 'og:image:height') !== String(info.height)) fail('og:image:width / og:image:height are missing or do not match the file');
  if (meta(html, 'property', 'og:image:type') !== 'image/jpeg' || info.format !== 'jpeg') fail('og:image:type is missing or is not image/jpeg');
  if (!meta(html, 'property', 'og:image:alt')) fail('no og:image:alt');
  if (meta(html, 'name', 'twitter:image') !== og) fail('twitter:image is not the same as og:image');
  if (meta(html, 'name', 'twitter:card') !== 'summary_large_image') fail('twitter:card is not summary_large_image');
}
if (stories === 0) errors.push('no story page found in dist/');

if (errors.length) {
  console.error(`Preview card check failed (${errors.length}):`);
  for (const e of errors.slice(0, 40)) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Preview card check passed: ${stories} story pages, ${cards} with a card (1200x630 JPEG, up to 200 KB, absolute address on our domain, size and type in the head).`);
