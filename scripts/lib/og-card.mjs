// The preview card of a story (Open Graph / Twitter, 1200x630 JPEG): the illustration of the story cropped to its focal point, under it a strip with
// a plate (the head of the elephant, "O Elefante Fugiu", the name of the epoch in the language of the page), all inside a frame of the azulejo
// pattern of the epoch in the colour of the epoch. No title of the story on the picture. What matters stays in the central square (630x630): Telegram and
// WhatsApp sometimes crop the sides. Pure helpers first (tests/vitest/og-card.spec.ts), then the drawing (sharp, the text turned into paths).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { create as openFont } from 'fontkitten';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

/** Changes whenever the drawing changes: part of the hash of every card, so the cache and the file names start over. */
export const CARD_VERSION = 'b3';
export const W = 1200;
export const H = 630;
/** The width of the frame of pattern. */
export const FRAME = 40;
/** The strip under the illustration. */
export const STRIP = 80;
/** The plate in the strip: it stays inside the central square (SAFE). */
export const PLATE = { width: 600, height: 72 };
/** The central square the messengers leave when they cut the sides. */
export const SAFE = { left: (W - H) / 2, width: H };
/** A card is never larger than this (the limit of the check is 200 KB). */
export const MAX_BYTES = 190 * 1024;

// ---- pure helpers ----

/** "45% 55%" (the focus of a picture, as object-position) as fractions; no focus is the centre. */
export function parseFocus(focus) {
  const m = /^\s*(\d{1,3})%\s+(\d{1,3})%\s*$/.exec(focus ?? '');
  if (!m) return { x: 0.5, y: 0.5 };
  return { x: Math.min(100, Number(m[1])) / 100, y: Math.min(100, Number(m[2])) / 100 };
}

/**
 * The part of a picture (srcW x srcH) that fills a box of the aspect w:h, as object-fit: cover with object-position `focus` would show it:
 * the largest rectangle of that aspect, placed so that the focal point of the picture is at the same place in the crop (x% of the free space).
 */
export function cropBox(srcW, srcH, w, h, focus) {
  const f = parseFocus(focus);
  const aspect = w / h;
  let width = srcW;
  let height = Math.round(srcW / aspect);
  if (height > srcH) {
    height = srcH;
    width = Math.round(srcH * aspect);
  }
  return { left: Math.round((srcW - width) * f.x), top: Math.round((srcH - height) * f.y), width, height };
}

const lightDark = (css, name) => {
  const m = new RegExp(`--${name}:\\s*light-dark\\(\\s*(#[0-9a-fA-F]{3,8})\\s*,\\s*(#[0-9a-fA-F]{3,8})\\s*\\)`).exec(css);
  return m ? m[1].toLowerCase() : null;
};

/**
 * The light colours of an epoch, read from src/styles/tokens.css (the only place that has them): the primary colour (the pattern of the frame), the
 * tint (the paper of the card), the line and the strong primary (the wordmark). An epoch the table does not know gets the colours of the site.
 */
export function epochPalette(css, epochId) {
  const block = new RegExp(`:root\\[data-epoch='${epochId}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  const primary = lightDark(css, `tone-${epochId}`) ?? lightDark(css, 'color-accent') ?? '#9a3f22';
  return {
    primary,
    tint: lightDark(block, 'epoch-tint') ?? lightDark(css, 'color-bg') ?? '#f6f1e7',
    line: lightDark(block, 'epoch-line') ?? '#d8cdb8',
    strong: lightDark(block, 'epoch-primary-strong') ?? primary,
  };
}

/** The name of the epoch in the language of the page; a language the epoch has no name in falls back (ru, en, pt). */
export const epochTitle = (names, lang) => (names[lang] ?? names.en ?? names.pt ?? '').trim();

/** The hash of everything a card is drawn from; the same inputs, the same hash, the same file name. */
export function cardHash(inputs) {
  const h = createHash('sha256');
  h.update(CARD_VERSION);
  for (const part of inputs) h.update('\0').update(Buffer.isBuffer(part) ? part : String(part));
  return h.digest('hex').slice(0, 10);
}

// ---- text as paths (the fonts of the site; the machine that builds has none of them installed) ----

const fontFile = (pkg, file) => readFileSync(require.resolve(`${pkg}/files/${file}`));
let fonts = null;
export const loadFonts = () =>
  (fonts ??= {
    // Playfair is a variable font: through fontkitten only its default weight has outlines, so the bold of the wordmark is drawn with a stroke.
    serif: [openFont(fontFile('@fontsource-variable/playfair-display', 'playfair-display-latin-wght-normal.woff2')), openFont(fontFile('@fontsource-variable/playfair-display', 'playfair-display-cyrillic-wght-normal.woff2'))],
    label: [openFont(fontFile('@fontsource/oswald', 'oswald-latin-600-normal.woff2')), openFont(fontFile('@fontsource/oswald', 'oswald-cyrillic-600-normal.woff2'))],
  });

/** The text as paths at `size` px, starting at x on the baseline y; returns the markup and the width. */
export function textPath(faces, text, size, x, y, attrs = '') {
  let cursor = 0;
  const parts = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const face = faces.find((f) => f.hasGlyphForCodePoint(cp)) ?? faces[0];
    const glyph = face.glyphForCodePoint(cp);
    const k = size / face.unitsPerEm;
    const d = glyph.path.toSVG(); // fontkit paths have the y axis up: flip around the baseline
    if (d) parts.push(`<path d="${d}" transform="translate(${(x + cursor).toFixed(2)} ${y}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})" ${attrs}/>`);
    cursor += glyph.advanceWidth * k;
  }
  return { svg: parts.join(''), width: cursor };
}

// ---- drawing ----

export const asset = (...p) => readFileSync(`${root}${p.join('/')}`);
export const tokensCss = readFileSync(`${root}src/styles/tokens.css`, 'utf8');
export const AZULEJO = { 'antes-de-portugal': 'pegada', 'avis-e-descobrimentos': 'bussola', 'pombal-e-terramoto': 'rombo', 'estado-novo-e-25-de-abril': 'rosa', 'lusitania-e-roma': 'no', 'suevos-visigodos-e-mouros': 'estrela', 'nascimento-do-reino-e-reconquista': 'xadrez', 'uniao-restauracao-e-ouro-do-brasil': 'tapete', 'monarquia-e-republica': 'onda' };
/** The patterns that run in one direction (src/lib/azulejo.ts DIRECTED): on the sides of the frame the turned file `<name>-v.svg` is used, so the band runs along the side. */
export const DIRECTED = ['no', 'onda', 'pegada', 'xadrez'];
export const patternName = (epochId) => AZULEJO[epochId] ?? 'bussola';
export const patternFile = (name) => asset('src/assets/azulejo', `${name}.svg`).toString('utf8');
export const patternSource = (epochId) => patternFile(patternName(epochId)) + (DIRECTED.includes(patternName(epochId)) ? patternFile(`${patternName(epochId)}-v`) : '');

/** What a card is drawn from, as the list that cardHash takes (the bytes of the picture, the pattern, the logo, the colours, the name, the crop). */
export function cardInputs({ file, focus, epochId, epochName }) {
  const p = epochPalette(tokensCss, epochId);
  return [asset('src/assets/stories', file), focus ?? '', patternSource(epochId), asset('public/mascot/head.webp'), p.primary, p.tint, p.strong, epochName];
}

/**
 * The four bands of the frame. A band is one picture of the pattern drawn as vector (`count` tiles along `length`, `thick` across), so the tiles meet without a seam
 * even when the length of a tile is not a whole number of pixels (the sides: 14 tiles over 550 px, 39.3 px each; the top and the bottom: 28 over 1120, 40 px each).
 * A directed pattern is turned on the sides (the file `-v`). The trail of footprints (pegada) goes round the card clockwise: top to the right, right side down,
 * bottom to the left, left side up (flip: the band is mirrored along its length).
 */
export function frameBands(epochId) {
  const name = patternName(epochId);
  const side = DIRECTED.includes(name) ? `${name}-v` : name;
  const trail = name === 'pegada';
  return [
    { side: 'top', file: name, vertical: false, flip: false, left: FRAME, top: 0, length: W - 2 * FRAME, count: 28 },
    { side: 'bottom', file: name, vertical: false, flip: trail, left: FRAME, top: H - FRAME, length: W - 2 * FRAME, count: 28 },
    { side: 'left', file: side, vertical: true, flip: trail, left: 0, top: FRAME, length: H - 2 * FRAME, count: 14 },
    { side: 'right', file: side, vertical: true, flip: false, left: W - FRAME, top: FRAME, length: H - 2 * FRAME, count: 14 },
  ];
}

/** The inside of a pattern file (without the <svg> element and the comments), in the colour, and the size of its viewBox. */
export function tileBody(file, color) {
  const source = patternFile(file);
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(source)?.[1] ?? 60);
  const body = source.replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { size, body: body.replace(/#000/g, color) };
}

/** The SVG of one band (see frameBands). */
export function bandSvg(band, color) {
  const { size, body } = tileBody(band.file, color);
  const across = FRAME / size;
  const along = band.length / band.count / size;
  const w = band.vertical ? FRAME : band.length;
  const h = band.vertical ? band.length : FRAME;
  const tiles = Array.from({ length: band.count }, (_, i) => {
    const at = (i * band.length) / band.count;
    return `<g transform="${band.vertical ? `translate(0 ${at}) scale(${across} ${along})` : `translate(${at} 0) scale(${along} ${across})`}">${body}</g>`;
  }).join('');
  const flip = band.flip ? (band.vertical ? `translate(0 ${band.length}) scale(1 -1)` : `translate(${band.length} 0) scale(-1 1)`) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g transform="${flip}">${tiles}</g></svg>`;
}

/** The rosette of the four corners: a ring, a dot and four small diamonds, in the colour of the epoch (a tile of its own, so the bands do not end in a cut). */
const cornerSvg = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="13" fill="none" stroke="${color}" stroke-width="3"/><circle cx="20" cy="20" r="5" fill="${color}"/><g fill="${color}"><path d="M20 1.5l3 3-3 3-3-3z"/><path d="M20 32.5l3 3-3 3-3-3z"/><path d="M1.5 20l3-3 3 3-3 3z"/><path d="M32.5 20l3-3 3 3-3 3z"/></g></svg>`;

const patterns = new Map();
/** The frame over the whole card, in the colour of the epoch: the four bands and a rosette in each corner. */
async function patternLayer(epochId, color) {
  const key = `${epochId}${color}`;
  if (!patterns.has(key)) patterns.set(key, drawFrame(epochId, color));
  return patterns.get(key);
}

export async function drawFrame(epochId, color) {
  const inputs = [];
  for (const band of frameBands(epochId)) {
    const w = band.vertical ? FRAME : band.length;
    const h = band.vertical ? band.length : FRAME;
    // Drawn at four times the size and brought down: the edges of the strokes are smooth.
    const img = await sharp(Buffer.from(bandSvg(band, color)), { density: 288 }).resize(w, h).png().toBuffer();
    inputs.push({ input: img, left: band.left, top: band.top });
  }
  const corner = await sharp(Buffer.from(cornerSvg(color)), { density: 288 }).resize(FRAME, FRAME).png().toBuffer();
  for (const [left, top] of [[0, 0], [W - FRAME, 0], [0, H - FRAME], [W - FRAME, H - FRAME]]) inputs.push({ input: corner, left, top });
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(inputs).png().toBuffer();
}

export const rounded = (w, h, r) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
export const paper = (w, h, r, color) => sharp({ create: { width: w, height: h, channels: 4, background: color } }).composite([{ input: rounded(w, h, r), blend: 'dest-in' }]).png().toBuffer();

/** The illustration cropped to its focus, made w x h, with the top corners rounded (the strip is under it). */
async function illustration(file, focus, w, h, r) {
  const meta = await sharp(asset('src/assets/stories', file)).metadata();
  const box = cropBox(meta.width, meta.height, w, h, focus);
  const flat = await sharp(asset('src/assets/stories', file)).extract(box).resize(w, h).png().toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path d="M0 ${h}V${r}Q0 0 ${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h}Z" fill="#fff"/></svg>`);
  return sharp(flat).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

/** The plate: the head of the elephant, "O Elefante Fugiu" and the name of the epoch (shrunk to fit when the name is long). */
async function plate(epochName, palette) {
  const { width, height } = PLATE;
  const f = loadFonts();
  const logoH = height - 12;
  const head = await sharp(asset('public/mascot/head.webp')).resize({ height: logoH }).png().toBuffer();
  const logoW = (await sharp(head).metadata()).width;
  const gap = 14;
  const bold = `fill="${palette.strong}" stroke="${palette.strong}" stroke-width="0.9" stroke-linejoin="round"`;
  let brandSize = 30;
  let labelSize = 22;
  const label = epochName.toUpperCase();
  let textW;
  for (;;) {
    textW = Math.max(textPath(f.serif, 'O Elefante Fugiu', brandSize, 0, 0).width, textPath(f.label, label, labelSize, 0, 0).width);
    if (logoW + gap + textW <= width - 48 || labelSize <= 12) break;
    brandSize -= 1;
    labelSize -= 1;
  }
  const left = (width - (logoW + gap + textW)) / 2;
  const tx = left + logoW + gap;
  const brandAt = textPath(f.serif, 'O Elefante Fugiu', brandSize, tx, height / 2 - 3, bold);
  const labelAt = textPath(f.label, label, labelSize, tx, height / 2 + labelSize - 1, 'fill="#4a4136"');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="${height / 2 - 2}" fill="#fbf8f1" stroke="${palette.primary}" stroke-width="3"/>${brandAt.svg}${labelAt.svg}</svg>`;
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(base).composite([{ input: head, left: Math.round(left), top: Math.round((height - logoH) / 2) }]).png().toBuffer();
}

/** The card as a JPEG buffer of at most MAX_BYTES (the quality goes down by steps until it fits). */
export async function composeCard({ file, focus, epochId, epochName }) {
  const palette = epochPalette(tokensCss, epochId);
  const w = W - 2 * FRAME;
  const h = H - 2 * FRAME;
  const artH = h - STRIP;
  const base = await sharp({ create: { width: W, height: H, channels: 3, background: palette.tint } })
    .composite([
      { input: await patternLayer(epochId, palette.primary), left: 0, top: 0 },
      { input: await paper(w, h, 18, palette.tint), left: FRAME, top: FRAME },
      { input: await illustration(file, focus, w, artH, 18), left: FRAME, top: FRAME },
      { input: await plate(epochName, palette), left: SAFE.left + Math.round((SAFE.width - PLATE.width) / 2), top: FRAME + artH + Math.round((STRIP - PLATE.height) / 2) },
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
