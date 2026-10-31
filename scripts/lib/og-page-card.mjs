// The preview cards of the pages that are not a story: a live epoch and the home page (layout "panel": a wide field of the pattern, a panel with a picture
// in the middle, a plate under it). Same size, same drawing helpers and same cache as the cards of the stories (og-card.mjs). The plate stays inside the
// central square (630x630), like the picture's subject should: the panel is wider than the square, the plate is not.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { isLive } from '../../src/lib/publication.mjs';
import { FRAME, H, SAFE, W, asset, cardHash, cropBox, epochPalette, loadFonts, paper, patternName, patternSource, rounded, textPath, tileBody, tokensCss } from './og-card.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const PAGE_CARD_VERSION = 'p1';
/** The panel with the picture (inside it, the picture; around it a rim of the paper of the epoch). */
export const PANEL = { width: 780, height: 410, top: 50, rim: 14 };
/** The plate under the panel: inside the central square. */
export const PAGE_PLATE = { width: 600, height: 72, tall: 96 };
const MAX_BYTES = 190 * 1024;
const PAPER = '#fbf8f1';

// ---- pure helpers ----

const i18n = (lang) => JSON.parse(readFileSync(`${root}src/i18n/${lang}.json`, 'utf8'));

/** The years of an epoch as the header of its page says them (src/lib/epochs.ts epochYearsText): the label of the data, else "from-to" with "a.C." for the years before our era. */
export function epochYears(epoch, lang) {
  if (epoch.years_label?.[lang]) return epoch.years_label[lang];
  if (!epoch.years) return '';
  const year = (n) => (n < 0 ? i18n(lang).card.year_bc.replace('{n}', String(-n)) : String(n));
  const { from, to } = epoch.years;
  return from === to ? year(from) : `${year(from)}–${year(to)}`;
}

/**
 * Which epochs get a card: those that have a page, that is a published story, and a picture of their own (fallback_image as a file). An epoch that is not open
 * has no page, so it has no card; when it opens, the next build makes it.
 */
export function liveEpochs(epochs, events) {
  return epochs.filter((e) => events.some((s) => isLive(s) && s.epoch === e.id) && typeof e.fallback_image === 'object' && e.fallback_image?.file);
}

// ---- drawing ----

/** The field: the pattern over the whole card (tiles of FRAME px, as the pattern lies in a band), in the colour. */
async function field(epochId, color) {
  const name = patternName(epochId);
  const { size, body } = tileBody(name, color);
  const k = FRAME / size;
  const cols = Math.ceil(W / FRAME);
  const rows = Math.ceil(H / FRAME);
  const tiles = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) tiles.push(`<g transform="translate(${c * FRAME} ${r * FRAME}) scale(${k})">${body}</g>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${tiles.join('')}</svg>`;
  return sharp(Buffer.from(svg), { density: 288 }).resize(W, H).png().toBuffer();
}

/** The panel: a rim of paper (the tint of the epoch) with the picture or the elephant inside, round corners. */
async function panel(palette, inner) {
  const { width, height, rim } = PANEL;
  const w = width + 2 * rim;
  const h = height + 2 * rim;
  const base = await paper(w, h, 24, palette.tint);
  return sharp(base).composite([{ input: inner, left: rim, top: rim }]).png().toBuffer();
}

async function picture(file, focus) {
  const { width, height } = PANEL;
  const meta = await sharp(asset('src/assets/stories', file)).metadata();
  const flat = await sharp(asset('src/assets/stories', file)).extract(cropBox(meta.width, meta.height, width, height, focus)).resize(width, height).png().toBuffer();
  return sharp(flat).composite([{ input: rounded(width, height, 14), blend: 'dest-in' }]).png().toBuffer();
}

/** The elephant (the pose "run") on paper, instead of a picture. */
async function elephant(palette) {
  const { width, height } = PANEL;
  const run = await sharp(asset('public/mascot/run.webp')).resize({ height: height - 20 }).png().toBuffer();
  const meta = await sharp(run).metadata();
  const base = await paper(width, height, 14, PAPER);
  return sharp(base).composite([{ input: run, left: Math.round((width - meta.width) / 2), top: 10 }]).png().toBuffer();
}

/** Width of text at a size, in paths (the same measure the drawing uses). */
const measure = (faces, text, size) => textPath(faces, text, size, 0, 0).width;

/**
 * The plate: the head of the elephant, "O Elefante Fugiu" and one line under it, made of runs [{text, faces, fill}] (the name of the epoch and its years).
 * The line shrinks to fit the plate down to `minScale`; when it still does not fit, `dropWhenLong` leaves it out (a caption that is too long has no place).
 * Returns { png, height, hasLine }.
 */
async function plate({ palette, runs, size, minScale, dropWhenLong = false, tall = false }) {
  const f = loadFonts();
  const { width } = PAGE_PLATE;
  const height = tall ? PAGE_PLATE.tall : PAGE_PLATE.height;
  let logoH = PAGE_PLATE.height - 12;
  let head;
  const headW = (h) => Math.round((h * 290) / 192);
  const logoW = headW(logoH);
  const gap = 14;
  const bold = `fill="${palette.strong}" stroke="${palette.strong}" stroke-width="0.9" stroke-linejoin="round"`;
  const lineW = (s) => runs.reduce((n, r, i) => n + measure(r.faces, r.text, size * s) + (i ? size * s * 0.35 : 0), 0);
  // With a line under the brand the two share the width beside the head; in a tall plate the line has the whole width under both.
  const room = tall ? width - 48 : width - 48 - logoW - gap;
  let scale = 1;
  let brandSize = 30;
  while (runs.length && lineW(scale) > room && scale > minScale) scale -= 0.02;
  const fits = runs.length > 0 && lineW(scale) <= room + 0.5;
  const showLine = runs.length > 0 && (fits || !dropWhenLong);
  if (!showLine && runs.length) brandSize = 34;
  if (tall && showLine) logoH = 44;
  head = await sharp(asset('public/mascot/head.webp')).resize({ height: logoH }).png().toBuffer();
  const brandW = measure(f.serif, 'O Elefante Fugiu', brandSize);
  let body;
  let top;
  if (tall && showLine) {
    // Row one: the head and the brand, centred. Row two: the line, centred.
    const lw = headW(logoH);
    const rowW = lw + gap + brandW;
    const left = (width - rowW) / 2;
    const brandAt = textPath(f.serif, 'O Elefante Fugiu', brandSize, left + lw + gap, 38, bold);
    const total = lineW(scale);
    let x = (width - total) / 2;
    const parts = runs.map((r, i) => {
      if (i) x += size * scale * 0.35;
      const p = textPath(r.faces, r.text, size * scale, x, height - 16, `fill="${r.fill}"`);
      x += p.width;
      return p.svg;
    });
    body = { svg: brandAt.svg + parts.join(''), headLeft: left, headTop: 6 };
  } else {
    const inner = logoW + gap + Math.max(brandW, showLine ? lineW(scale) : 0);
    const left = (width - inner) / 2;
    const tx = left + logoW + gap;
    const brandY = showLine ? height / 2 - 3 : height / 2 + 10;
    const brandAt = textPath(f.serif, 'O Elefante Fugiu', brandSize, tx, brandY, bold);
    let x = tx;
    const parts = showLine
      ? runs.map((r, i) => {
          if (i) x += size * scale * 0.35;
          const p = textPath(r.faces, r.text, size * scale, x, height / 2 + size * scale - 1, `fill="${r.fill}"`);
          x += p.width;
          return p.svg;
        })
      : [];
    body = { svg: brandAt.svg + parts.join(''), headLeft: left, headTop: (height - logoH) / 2 };
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="${height / 2 - 2}" fill="#fbf8f1" stroke="${palette.primary}" stroke-width="3"/>${body.svg}</svg>`;
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const png = await sharp(base).composite([{ input: head, left: Math.round(body.headLeft), top: Math.round(body.headTop) }]).png().toBuffer();
  return { png, height, hasLine: showLine };
}

async function assemble({ epochId, palette, inner, plateInfo }) {
  const p = await panel(palette, inner);
  const rim = PANEL.rim;
  const left = Math.round((W - (PANEL.width + 2 * rim)) / 2);
  const plateTop = PANEL.top + PANEL.height + 2 * rim + 12;
  const base = await sharp({ create: { width: W, height: H, channels: 3, background: palette.tint } })
    .composite([
      { input: await field(epochId, palette.primary), left: 0, top: 0 },
      { input: p, left, top: PANEL.top },
      { input: plateInfo.png, left: SAFE.left + Math.round((SAFE.width - PAGE_PLATE.width) / 2), top: plateTop },
    ])
    .png()
    .toBuffer();
  let out = Buffer.alloc(0);
  for (let quality = 84; quality >= 50; quality -= 4) {
    out = await sharp(base).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length <= MAX_BYTES) break;
  }
  return out;
}

const NAME_FILL = '#4a4136';
const YEARS_FILL = '#7a6d5d';

/** The card of a live epoch: its pattern and colour, the picture of the epoch in the panel, the plate with the name and the years. */
export async function composeEpochCard({ file, focus, epochId, epochName, years }) {
  const palette = epochPalette(tokensCss, epochId);
  const f = loadFonts();
  const runs = [{ text: epochName.toUpperCase(), faces: f.label, fill: NAME_FILL }, ...(years ? [{ text: years, faces: f.label, fill: YEARS_FILL }] : [])];
  const plateInfo = await plate({ palette, runs, size: 22, minScale: 0.55 });
  return assemble({ epochId, palette, inner: await picture(file, focus), plateInfo });
}

/** The card of the home page: the compass, the colours of the site; a panel with a picture, or the elephant; the plate with the name and, when it fits, the caption. */
export async function composeHomeCard({ variant, file, focus, caption }) {
  const palette = epochPalette(tokensCss, 'home');
  const f = loadFonts();
  const inner = variant === 'elephant' ? await elephant(palette) : await picture(file, focus);
  // The caption (the description of the page) goes in a taller plate, on a line of its own, at 15 px or more; longer than that it is left out.
  const runs = caption ? [{ text: caption, faces: f.serif, fill: NAME_FILL }] : [];
  let plateInfo = await plate({ palette, runs, size: 19, minScale: 15 / 19, dropWhenLong: true, tall: true });
  if (!plateInfo.hasLine) plateInfo = await plate({ palette, runs: [], size: 19, minScale: 1 });
  return assemble({ epochId: 'home', palette, inner, plateInfo });
}

/** Everything a page card is drawn from, for cardHash: the kind, the pattern, the logo, the colours, the text and the picture (or the elephant). */
export function pageCardInputs({ kind, file, focus, epochId, text, years, variant }) {
  const p = epochPalette(tokensCss, epochId);
  const inputs = [PAGE_CARD_VERSION, kind, variant ?? '', patternSource(epochId), asset('public/mascot/head.webp'), p.primary, p.tint, p.strong, text ?? '', years ?? '', focus ?? ''];
  if (variant === 'elephant') inputs.push(asset('public/mascot/run.webp'));
  else if (file) inputs.push(asset('src/assets/stories', file));
  return inputs;
}

export { cardHash };
