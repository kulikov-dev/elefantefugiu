// The preview picture (og:image, 1200x630 JPEG) of the page of every place that has one (docs/spec.md "Страницы мест"): the azulejo pictures of the three most
// important stories of the place in a row (the same three as the automatic introduction: src/lib/places.ts featuredStories; a city shows stories of different
// districts; a place may name its own in places.yaml `og_stories`), under them a strip of the colour of the site with the name of the place and "N stories · O Elefante Fugiu" in the language of the page.
// Run by `npm run build` before astro build, through tsx (it reads the lists of src/lib/places.ts):   tsx scripts/make-place-og.mjs [--force]
//   .og-cache/places/<hash>.jpg    the cache: the hash is made of the pictures, their focus, the name, the line, the colours and the version of the drawing,
//                                  so a card is drawn again only when the set of stories, the text or the drawing changes
//   .og-cache/places.json          which file belongs to which place and language (src/lib/og-cards.ts placeCardPath reads it)
//   public/og-places/<id>-<lang>-<hash>.jpg   what the site publishes; the hash in the name makes the messengers fetch a changed card anew
// A place with `cover` in places.yaml (docs/images/places/<id>.jpg): the card is that picture with the strip, no picture of the stories.
// Neither is in the repository. A place that has no page today has no card; when it gets one, the next build draws it.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import { plural } from '../src/i18n/index.ts';
import { ogStories, placePages } from '../src/lib/places.ts';
import { isListed } from '../src/lib/publication.mjs';
import { MAX_BYTES, asset, cardHash, cropBox, epochPalette, loadFonts, textPath, tokensCss } from './lib/og-card.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const force = process.argv.includes('--force');
const LANGS = ['pt', 'en', 'ru'];
const W = 1200;
const H = 630;
/** The strip with the text; the pictures take the rest. */
const STRIP = 150;
/** The gap between two pictures. */
const GAP = 6;
/** The text stays inside the central square the messengers leave when they cut the sides. */
const SAFE_WIDTH = 560;
/** Changes whenever this drawing changes: part of the hash, so the cache and the file names start over. */
const PLACE_CARD_VERSION = 'p1';

const read = (p) => parse(readFileSync(join(root, p), 'utf8'));
const places = read('src/content/places.yaml');
const epochs = read('src/content/epochs.yaml');
const stories = readdirSync(join(root, 'src/content/events'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => read(`src/content/events/${f}`))
  .filter((e) => isListed(e));
const epochOf = (id) => epochs.find((e) => e.id === id);
/** The picture of a story, else that of its epoch (the rule of the page: cardPicture in src/lib/pictures.ts). */
const pictureOf = (story) => story.image ?? (typeof epochOf(story.epoch)?.fallback_image === 'object' ? epochOf(story.epoch).fallback_image : undefined);

const lightDark = (name) => new RegExp(`--${name}:\\s*light-dark\\(\\s*(#[0-9a-fA-F]{3,8})\\s*,`).exec(tokensCss)?.[1].toLowerCase();
const bg = epochPalette(tokensCss, 'none').tint; // the page of the site: --color-bg (no epoch)
const ink = lightDark('color-ink') ?? '#1f1a14';
const muted = lightDark('color-ink-muted') ?? '#5a5044';

const cacheDir = join(root, '.og-cache/places');
const outDir = join(root, 'public/og-places');
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

/** The text of the strip, centred, the name shrunk to fit the safe square. */
function strip(name, line) {
  const f = loadFonts();
  let size = 58;
  while (textPath(f.serif, name, size, 0, 0).width > SAFE_WIDTH && size > 30) size -= 2;
  const bold = `fill="${ink}" stroke="${ink}" stroke-width="0.9" stroke-linejoin="round"`;
  const nameAt = textPath(f.serif, name, size, 0, 0);
  const lineSize = 24;
  const label = line.toUpperCase();
  const lineAt = textPath(f.label, label, lineSize, 0, 0);
  const nameBase = Math.round(STRIP / 2 - 6);
  const x1 = (W - nameAt.width) / 2;
  const x2 = (W - lineAt.width) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${STRIP}">${textPath(f.serif, name, size, x1, nameBase, bold).svg}${textPath(f.label, label, lineSize, x2, nameBase + lineSize + 18, `fill="${muted}"`).svg}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function compose(shots, name, line) {
  const k = shots.length;
  const tileW = Math.floor((W - GAP * (k - 1)) / k);
  const artH = H - STRIP;
  const layers = [];
  for (const [i, s] of shots.entries()) {
    const meta = await sharp(s.bytes).metadata();
    const box = cropBox(meta.width, meta.height, tileW, artH, s.focus);
    layers.push({ input: await sharp(s.bytes).extract(box).resize(tileW, artH).png().toBuffer(), left: i * (tileW + GAP), top: 0 });
  }
  layers.push({ input: await strip(name, line), left: 0, top: artH });
  const base = await sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(layers).png().toBuffer();
  let out = Buffer.alloc(0);
  for (let quality = 84; quality >= 50; quality -= 4) {
    out = await sharp(base).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length <= MAX_BYTES) break;
  }
  return out;
}

const manifest = {};
const wanted = new Set();
let drawn = 0;
let cached = 0;
for (const page of placePages(places, stories)) {
  const coverFile = join(root, 'docs/images/places', `${page.place.id}.jpg`);
  const shots =
    page.place.cover && existsSync(coverFile)
      ? [{ file: `${page.place.id}.jpg`, focus: page.place.cover.focus ?? '', bytes: readFileSync(coverFile) }]
      : ogStories(page)
          .map((s) => ({ s, pic: pictureOf(s) }))
          .filter((x) => x.pic)
          .map(({ pic }) => ({ file: pic.file, focus: pic.focus ?? '', bytes: asset('src/assets/stories', pic.file) }));
  if (shots.length === 0) continue;
  for (const lang of LANGS) {
    const name = page.place.name[lang];
    const line = `${plural(lang, 'plural.stories', page.stories.length)} · O Elefante Fugiu`;
    const hash = cardHash([PLACE_CARD_VERSION, name, line, bg, ink, muted, ...shots.flatMap((x) => [x.focus, x.bytes])]);
    const cache = join(cacheDir, `${hash}.jpg`);
    if (force || !existsSync(cache)) {
      writeFileSync(cache, await compose(shots, name, line));
      drawn += 1;
    } else cached += 1;
    const rel = `og-places/${page.place.id}-${lang}-${hash}.jpg`;
    const target = join(root, 'public', rel);
    if (!existsSync(target)) copyFileSync(cache, target);
    wanted.add(rel.replace('og-places/', ''));
    (manifest[page.place.id] ??= {})[lang] = rel;
  }
}
// Cards of earlier versions and of places that have no page any more do not stay.
for (const f of readdirSync(outDir)) if (!wanted.has(f)) rmSync(join(outDir, f));
const live = new Set(Object.values(manifest).flatMap((m) => Object.values(m)).map((rel) => rel.replace(/^.*-([0-9a-f]{10})\.jpg$/, '$1.jpg')));
for (const f of readdirSync(cacheDir)) if (!live.has(f)) rmSync(join(cacheDir, f));
writeFileSync(join(root, '.og-cache/places.json'), JSON.stringify(manifest, null, 1));
console.log(`Place cards: ${wanted.size} (${drawn} drawn, ${cached} from the cache) in public/og-places/.`);
