// The preview picture of the page of one claim of "Myth or fact" (docs/spec.md 5.8): 1200x630 JPEG, the claim in large type on light paper with a grid of tiles, two "buttons"
// (Myth / Fact in the language of the page) and the logo. No answer, no verdict. One picture per claim and language.
// Run by the build before astro build (npm run build):   node scripts/make-myth-og.mjs
//   public/og-myths/<id>-<lang>-<hash>.jpg   what the site publishes (the hash in the name makes the messengers fetch a changed picture anew)
//   .og-cache/myths.json                     which file belongs to which claim and language (src/lib/og-cards.ts mythCardPath reads it)
// Neither is in the repository. The text is drawn as paths from the fonts of the site (the machine that builds has none installed), like the other cards (scripts/lib/og-card.mjs).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import { isLive } from './../src/lib/publication.mjs';
import { H, MAX_BYTES, W, asset, loadFonts, textPath } from './lib/og-card.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'public/og-myths');
const cacheDir = join(root, '.og-cache');
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

/** Changes whenever the drawing changes, so the names of the files start over. */
const VERSION = 'm1';
const PAPER = '#f7f3ea';
const GRID = '#2f5d9a';
const INK = '#1e2e4a';
const LABELS = { pt: { label: 'Mito ou verdade?', buttons: ['Mito', 'Verdade'] }, en: { label: 'Myth or fact?', buttons: ['Myth', 'Fact'] }, ru: { label: 'Миф или правда?', buttons: ['Миф', 'Правда'] } };
const TILE = 150;
const COLUMN = { left: 150, width: 900 };

/** The words of `text` in lines no wider than `width` at `size` px. */
function wrap(faces, text, size, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textPath(faces, next, size, 0, 0).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function draw(lang, statement) {
  const f = loadFonts();
  const t = LABELS[lang];
  // The largest size at which the claim takes at most four lines.
  let size = 68;
  let lines = wrap(f.serif, statement, size, COLUMN.width);
  while (lines.length > 4 && size > 36) {
    size -= 2;
    lines = wrap(f.serif, statement, size, COLUMN.width);
  }
  const lead = Math.round(size * 1.22);
  const labelSize = 28;
  const pillH = 64;
  const gaps = { label: 26, pills: 44 };
  const total = labelSize + gaps.label + lines.length * lead + gaps.pills + pillH;
  let y = Math.round((H - total) / 2);
  const parts = [];
  // The grid of tiles.
  for (let x = TILE; x < W; x += TILE) parts.push(`<path d="M${x} 0V${H}" stroke="${GRID}" stroke-opacity="0.16" stroke-width="1.5"/>`);
  for (let yy = TILE; yy < H; yy += TILE) parts.push(`<path d="M0 ${yy}H${W}" stroke="${GRID}" stroke-opacity="0.16" stroke-width="1.5"/>`);
  parts.push(textPath(f.label, t.label.toUpperCase(), labelSize, COLUMN.left, y + labelSize, `fill="${GRID}"`).svg);
  y += labelSize + gaps.label;
  // Playfair is a variable font: through fontkitten only its default weight has outlines, so the bold is drawn with a stroke (as the wordmark of the other cards).
  const bold = `fill="${INK}" stroke="${INK}" stroke-width="${(size / 40).toFixed(2)}" stroke-linejoin="round"`;
  for (const line of lines) {
    parts.push(textPath(f.serif, line, size, COLUMN.left, y + Math.round(size * 0.9), bold).svg);
    y += lead;
  }
  y += gaps.pills;
  let x = COLUMN.left;
  for (const word of t.buttons) {
    const label = word.toUpperCase();
    const w = textPath(f.label, label, 30, 0, 0).width;
    const pillW = Math.round(w + 80);
    parts.push(`<rect x="${x + 1.5}" y="${y + 1.5}" width="${pillW - 3}" height="${pillH - 3}" rx="${pillH / 2}" fill="none" stroke="${INK}" stroke-width="3"/>`);
    parts.push(textPath(f.label, label, 30, x + (pillW - w) / 2, y + pillH / 2 + 11, `fill="${INK}"`).svg);
    x += pillW + 20;
  }
  // The logo: the head of the elephant and the name of the site, bottom right.
  const logoH = 64;
  const head = await sharp(asset('public/mascot/head.webp')).resize({ height: logoH }).png().toBuffer();
  const headW = (await sharp(head).metadata()).width;
  const name = textPath(f.serif, 'O Elefante Fugiu', 30, 0, 0);
  const left = COLUMN.left + COLUMN.width - (headW + 14 + name.width);
  const top = H - 44 - logoH;
  parts.push(textPath(f.serif, 'O Elefante Fugiu', 30, left + headW + 14, top + logoH / 2 + 10, `fill="${GRID}" stroke="${GRID}" stroke-width="0.9" stroke-linejoin="round"`).svg);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${PAPER}"/>${parts.join('')}</svg>`;
  const base = await sharp(Buffer.from(svg)).composite([{ input: head, left: Math.round(left), top }]).png().toBuffer();
  let out = Buffer.alloc(0);
  for (let quality = 88; quality >= 50; quality -= 4) {
    out = await sharp(base).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length <= MAX_BYTES) break;
  }
  return out;
}

// The pool of the game: every story that is on the site (the same `isLive` as the sitemap) with a `myth` and without `sensitive`; a story of a later day gets no picture.
const myths = readdirSync(join(root, 'src/content/events'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(join(root, 'src/content/events', f), 'utf8')))
  .filter((e) => e.myth && !e.sensitive && isLive(e))
  .map((e) => ({ ...e.myth, id: e.myth.id ?? e.id }));
const manifest = {};
const keep = new Set();
for (const myth of myths) {
  for (const lang of ['pt', 'en', 'ru']) {
    const statement = myth.statement[lang];
    const buffer = await draw(lang, statement);
    const hash = createHash('sha1').update(VERSION).update(buffer).digest('hex').slice(0, 10);
    const name = `${myth.id}-${lang}-${hash}.jpg`;
    writeFileSync(join(outDir, name), buffer);
    (manifest[myth.id] ??= {})[lang] = `og-myths/${name}`;
    keep.add(name);
  }
}
for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(join(outDir, file));
writeFileSync(join(cacheDir, 'myths.json'), JSON.stringify(manifest, null, 1));
console.log(`Myth previews: ${keep.size} picture(s) in public/og-myths/.`);
