// Page weight of the built card, epoch and thread pages: HTML + linked CSS + linked JS, images NOT counted.
// Budget: about 500 KB per card page without interactives (docs/spec.md section 9).
// Usage: node scripts/check-weight.mjs   (after npm run build)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

import { fileURLToPath } from 'node:url';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const BUDGET = 500 * 1024;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const raw = (process.env.BASE_PATH || '').trim();
const base = raw && raw !== '/' ? `/${raw.replace(/^\/+|\/+$/g, '')}/` : '/';
const fromDist = (url) => join(dist, url.slice(base.length).split(/[?#]/)[0]);

const pages = [];
for (const seg of [['pt', 'historia'], ['en', 'story'], ['pt', 'epoca'], ['en', 'era'], ['pt', 'fio'], ['en', 'thread']]) {
  const dir = join(dist, seg[0], seg[1]);
  if (!existsSync(dir)) continue;
  for (const slug of readdirSync(dir)) pages.push(join(dir, slug, 'index.html'));
}
for (const lang of ['pt', 'en']) pages.push(join(dist, lang, 'index.html'));
if (pages.length === 0) {
  console.error('No card pages in dist/. Run npm run build first.');
  process.exit(1);
}

const rows = pages.map((file) => {
  const html = readFileSync(file);
  const text = html.toString('utf8');
  const parts = [html];
  const images = [];
  // Linked stylesheets and scripts count; images are only measured separately.
  for (const [, kind, url] of text.matchAll(/<(link rel="stylesheet" href|script[^>]*\ssrc|img[^>]*\ssrc)="([^"]+)"/g)) {
    if (!url.startsWith(base)) continue;
    const path = fromDist(url);
    if (!existsSync(path)) continue;
    if (kind.startsWith('img')) images.push(statSync(path).size);
    else parts.push(readFileSync(path));
  }
  const all = Buffer.concat(parts);
  return {
    file: file.replace(dist, ''),
    raw: all.length,
    gzip: gzipSync(all).length,
    brotli: brotliCompressSync(all).length,
    images: images.reduce((a, b) => a + b, 0),
  };
});

const max = rows.reduce((a, b) => (b.raw > a.raw ? b : a));
const avg = (key) => rows.reduce((s, r) => s + r[key], 0) / rows.length;
console.log(`Pages checked: ${rows.length} cards, epochs, threads and home pages (HTML + CSS + JS, without images)`);
console.log(`  average: ${kb(avg('raw'))} raw, ${kb(avg('gzip'))} gzip, ${kb(avg('brotli'))} brotli`);
console.log(`  heaviest: ${max.file}: ${kb(max.raw)} raw, ${kb(max.gzip)} gzip, ${kb(max.brotli)} brotli`);
console.log(`  images are not counted (largest on a page: ${kb(Math.max(...rows.map((r) => r.images)))})`);
console.log(`  budget: ${kb(BUDGET)} (raw, without images)`);

// The map: its code is loaded only by pages with a map, and only when the block comes into view.
// Counted apart from the page budget; a page without a map never requests these files.
const astroDir = join(dist, '_astro');
const mapFiles = existsSync(astroDir) ? readdirSync(astroDir).filter((f) => /^(map-island|MapBlock).*\.js$|^leaflet.*\.css$/.test(f) || (f.endsWith('.css') && readFileSync(join(astroDir, f), 'utf8').includes('.map__stage'))) : [];
if (mapFiles.length) {
  const size = (f) => {
    const buf = readFileSync(join(astroDir, f));
    return { raw: buf.length, gzip: gzipSync(buf).length };
  };
  const rowsMap = mapFiles.map((f) => ({ f, ...size(f) }));
  const sum = (key) => rowsMap.reduce((t, r) => t + r[key], 0);
  console.log(`  map code (only on map and epoch pages, the Leaflet chunk only when the block is in view): ${kb(sum('raw'))} raw, ${kb(sum('gzip'))} gzip`);
  for (const r of rowsMap) console.log(`    ${r.f.replace(/\.[A-Za-z0-9_-]{8}\./, '.*.')}: ${kb(r.raw)} raw, ${kb(r.gzip)} gzip`);
}
// Interactives (ArmyDots, ShipScale): their script and styles are emitted into the pages that show them and nowhere else.
// Measured here: the code (inline <script> using data-viz-*, <style> blocks with .viz) of one page per type, gzip, summed over the two
// components (a page never carries both). A page without an interactive must not carry any of it. The aim is at most 5 KB gzip for both.
const VIZ_BUDGET = 5 * 1024;
const vizCode = (text) => {
  const scripts = [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((c) => /data-viz-/.test(c));
  const styles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).filter((c) => /\.viz\b|\.viz__/.test(c));
  return Buffer.from([...scripts, ...styles].join('\n'));
};
const vizByType = new Map();
const vizLeaks = [];
for (const file of pages) {
  const text = readFileSync(file, 'utf8');
  const type = text.match(/data-interactive="([a-z_]+)"/)?.[1];
  const code = vizCode(text);
  // Linked stylesheets and scripts count too: a shared stylesheet that holds the interactive rules would reach every card page.
  const linked = [...text.matchAll(/<(?:link rel="stylesheet" href|script[^>]*\ssrc)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => url.startsWith(base) && existsSync(fromDist(url)))
    .map((url) => readFileSync(fromDist(url), 'utf8'));
  const linkedLeak = linked.some((c) => /\.viz__|data-viz-/.test(c));
  if (!type && (code.length > 0 || linkedLeak)) vizLeaks.push(file.replace(dist, ''));
  if (type && linkedLeak) vizLeaks.push(`${file.replace(dist, '')} (interactive code in a shared file, not inline)`);
  if (type && !vizByType.has(type)) vizByType.set(type, { page: file.replace(dist, ''), raw: code.length, gzip: gzipSync(code).length });
}
if (vizByType.size) {
  const total = [...vizByType.values()].reduce((t, v) => t + v.gzip, 0);
  console.log(`  interactives (code and styles inline in the pages that show them): ${kb([...vizByType.values()].reduce((t, v) => t + v.raw, 0))} raw, ${kb(total)} gzip for both`);
  for (const [type, v] of vizByType) console.log(`    ${type}: ${kb(v.raw)} raw, ${kb(v.gzip)} gzip (${v.page})`);
  const plain = rows.find((r) => r.file.includes('historia/evento-exemplo-01/'));
  for (const [, v] of vizByType) {
    const row = rows.find((r) => r.file === v.page);
    if (plain && row) console.log(`    page with it ${v.page}: ${kb(row.raw)} raw, ${kb(row.gzip)} gzip; without ${plain.file}: ${kb(plain.raw)} raw, ${kb(plain.gzip)} gzip`);
  }
  if (total > VIZ_BUDGET) console.log(`  WARNING: interactive code is over the aim of ${kb(VIZ_BUDGET)} gzip for both components`);
}
if (vizLeaks.length) {
  console.error(`Interactive code found on pages without an interactive: ${vizLeaks.slice(0, 5).join(', ')}`);
  process.exit(1);
}
if (max.raw > BUDGET) {
  console.error('Over budget.');
  process.exit(1);
}
console.log('Within budget.');
