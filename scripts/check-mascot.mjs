// Checks where the elephant mascot appears in the built pages (dist/), docs/visual-direction.md section 6.
// Part of postbuild. Rules:
//  - the picture exists, has an alt (empty for the logo and the home page, a description on the service pages) and its width and height;
//  - the mascot is not on a card page at all (cards can be heavy, 16+, or about the regime), nor on the pages of the Estado Novo epoch;
//  - on the other pages there are at most 3 pictures besides the logo (the walking one by the pager, and two empty states of which
//    only one is ever shown at a time);
//  - the logo (the head) is in the header of every page.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const errors = [];
let pages = 0;
let withMascot = 0;

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const stripped = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');

for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
  const rel = relative(dist, file).split(sep).join('/');
  const html = stripped(readFileSync(file, 'utf8'));
  const imgs = [...html.matchAll(/<img\b[^>]*\bclass="[^"]*\bmascot\b[^"]*"[^>]*>/g)].map((m) => m[0]);
  if (imgs.length === 0 && rel !== '404.html') {
    // Redirect pages and similar carry no header; every real page has the logo.
    if (/<header class="site-header"/.test(html)) errors.push(`${rel}: the logo (mascot head) is missing from the header`);
    continue;
  }
  pages += 1;
  const LANGS_N = 3; // the 404 page carries the header of every language
  const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  const logos = imgs.filter((t) => /\bmascot--logo\b/.test(t));
  const figures = imgs.filter((t) => !/\bmascot--logo\b/.test(t));
  if (/<header class="site-header"/.test(html) && logos.length !== (rel === '404.html' ? LANGS_N : 1)) errors.push(`${rel}: expected ${rel === '404.html' ? LANGS_N + ' logos (one header per language, the script keeps one)' : 'one logo'}, found ${logos.length}`);
  for (const tag of imgs) {
    const src = attr(tag, 'src') ?? '';
    // The logo is decorative (the name stands beside it); a figure has an empty alt (home) or a description in the language of its page.
    // An empty alt may be written as alt="" or as a bare alt (both mean the same).
    const alt = /\salt(?=[\s>/])/.test(tag) ? '' : attr(tag, 'alt');
    if (alt === undefined) errors.push(`${rel}: a mascot picture needs an alt attribute`);
    if (/mascot--logo/.test(tag) && alt !== '') errors.push(`${rel}: the logo must have an empty alt (decorative)`);
    if (!attr(tag, 'width') || !attr(tag, 'height')) errors.push(`${rel}: a mascot picture needs width and height`);
    const name = src.split('/').pop();
    if (!name || !existsSync(join(dist, 'mascot', name))) errors.push(`${rel}: ${src} is not in dist/mascot`);
  }
  if (figures.length > 0) withMascot += 1;
  if (figures.length > 3) errors.push(`${rel}: ${figures.length} mascot pictures besides the logo, at most 3`);
  if (/^(pt|en|ru)\/(historia|story|istoriya)\//.test(rel) && figures.length > 0) errors.push(`${rel}: the mascot must not appear on a card page`);
  if (/^(pt|en|ru)\/(epoca|era|epoha)\/(estado-novo-e-25-de-abril|estado-novo-and-25-april|eshtadu-novu-i-revolyuciya-gvozdik)\//.test(rel) && figures.length > 0) {
    errors.push(`${rel}: the mascot must not appear on the pages of the regime epoch`);
  }
}

if (errors.length > 0) {
  console.error(`Mascot check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Mascot check passed (${pages} pages with the logo or the mascot, ${withMascot} with a figure).`);
