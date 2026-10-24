// Checks the link previews (Open Graph, Twitter) of every page of dist/ (part of postbuild).
//  - every page has og:image and twitter:image, the same address, and the file is in dist/;
//  - the picture is a PNG or a JPEG of 1200 x 630 (an SVG is not accepted by social networks); a picture made from a source that
//    is smaller than that has the same proportion (1.91 : 1) at the largest size the source allows, not under 600 px wide;
//  - the elephant is on the preview of the home page only: the plain site picture (images/og/home.png) is not on any other
//    page, so a card, a thread or an epoch with a heavy topic never shows the mascot in a link preview.
// Not checked: 404, the QR pages (/p/...) and the language chooser at the root (they are not shared).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const rawBase = (process.env.BASE_PATH || '').trim();
const base = rawBase && rawBase !== '/' ? `/${rawBase.replace(/^\/+|\/+$/g, '')}` : '';
const errors = [];
const sizes = new Map();
const smaller = new Set();
let pages = 0;

const sizeOf = async (path) => {
  if (!sizes.has(path)) {
    const m = await sharp(path).metadata();
    sizes.set(path, { text: `${m.format} ${m.width}x${m.height}`, format: m.format, width: m.width, height: m.height });
  }
  return sizes.get(path);
};

for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
  const rel = relative(dist, file).replace(/\\/g, '/');
  if (rel === '404.html' || rel === 'index.html' || rel.startsWith('p/')) continue;
  const html = readFileSync(file, 'utf8');
  pages += 1;
  const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const tw = html.match(/<meta name="twitter:image" content="([^"]+)"/)?.[1];
  if (!og) {
    errors.push(`${rel}: no og:image`);
    continue;
  }
  if (og !== tw) errors.push(`${rel}: og:image and twitter:image differ`);
  const path = new URL(og).pathname;
  if (!path.startsWith(`${base}/`)) {
    errors.push(`${rel}: the preview ${og} is outside the base path ${base}/`);
    continue;
  }
  const local = join(dist, path.slice(base.length));
  if (!existsSync(local)) {
    errors.push(`${rel}: the preview file ${path} is not in dist/`);
    continue;
  }
  const size = await sizeOf(local);
  const proportion = Math.abs(size.width / size.height - 1200 / 630) < 0.02;
  if (!['png', 'jpeg'].includes(size.format) || !proportion || size.width < 600 || size.width > 1200) {
    errors.push(`${rel}: the preview ${path} is ${size.text}, it must be a PNG or JPEG of 1200x630 (smaller only in the same proportion, from 600 px wide)`);
  }
  if (size.width !== 1200) smaller.add(`${path.split('/').pop()} ${size.text}`);
  const isHome = /^(pt|en|ru)\/index\.html$/.test(rel);
  if (path.endsWith('/images/og/home.png') && !isHome) errors.push(`${rel}: the preview with the mascot is only for the home page`);
  if (isHome && !path.endsWith('/images/og/home.png')) errors.push(`${rel}: the home page must use images/og/home.png`);
}

if (errors.length) {
  console.error(`Preview check failed:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`Preview check passed: ${pages} pages, every one with a PNG or JPEG preview of 1200x630; the mascot only on the home page.`);
if (smaller.size) console.log(`  NOTE: smaller than 1200x630 (the source is smaller, same proportion): ${[...smaller].join('; ')}`);
