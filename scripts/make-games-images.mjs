// The pictures of the games (docs/spec.md 5.10): two azulejo pictures 3:2 that the owner puts in docs/images/games/myths.jpg and order.jpg.
// Run by the build before astro build (npm run build):   node scripts/make-games-images.mjs
//   public/games/<game>-<width>-<hash>.webp   the picture whole, 3:2, in two widths (the banner of the result, the card on the page "Games")
//   public/og-games/<game>-<hash>.jpg         the preview picture of the page of a game: 1200x630, the picture whole at the height of 630 in the middle, on fields of the paper (no cutting)
//   public/og-games/games-<hash>.jpg          the preview picture of the page "Games" (docs/images/games/games.jpg): the same, whole at the height of 630 on fields of the paper
//   .og-cache/games.json                      which files belong to which game (src/lib/games-images.ts reads it)
// None of them is in the repository. A missing source picture is not an error: the page goes without that picture and `npm run check:games` warns.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'docs/images/games');
const picDir = join(root, 'public/games');
const ogDir = join(root, 'public/og-games');
const cacheDir = join(root, '.og-cache');
for (const d of [picDir, ogDir, cacheDir]) mkdirSync(d, { recursive: true });

export const GAMES = ['myths', 'order'];
/** The page "Games" has a preview picture of its own, no sizes for the page. */
const PAGE_GAMES = 'games';
const WIDTHS = [480, 960];
const W = 1200;
const H = 630;
const MAX_BYTES = 190 * 1024; // the check of the preview cards allows 200 KB
const VERSION = 'g1';

// The paper of the light theme: the first colour of --color-bg in tokens.css.
const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const paper = /--color-bg:\s*light-dark\(\s*(#[0-9a-f]{6})/i.exec(tokens)?.[1] ?? '#f6f1e7';

const hashOf = (...parts) => createHash('sha1').update(VERSION).update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest('hex').slice(0, 10);

async function jpegUnderLimit(pipeline) {
  let buffer = await pipeline.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  for (let quality = 78; buffer.length > MAX_BYTES && quality >= 40; quality -= 4) buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
  return buffer;
}

const manifest = {};
const keep = { pics: new Set(), og: new Set() };
const sources = {};
for (const game of GAMES) {
  const file = join(srcDir, `${game}.jpg`);
  if (!existsSync(file)) {
    console.warn(`WARNING  docs/images/games/${game}.jpg is missing: the page of the game goes without its picture.`);
    continue;
  }
  const source = readFileSync(file);
  sources[game] = source;
  const hash = hashOf(source);
  const entry = { sizes: {} };
  const meta = await sharp(source).metadata();
  for (const width of WIDTHS) {
    const height = Math.round((width * meta.height) / meta.width);
    const name = `${game}-${width}-${hash}.webp`;
    writeFileSync(join(picDir, name), await sharp(source).resize(width, height).webp({ quality: 80 }).toBuffer());
    entry.sizes[width] = { file: `games/${name}`, width, height };
    keep.pics.add(name);
  }
  const og = await jpegUnderLimit(sharp(source).resize(W, H, { fit: 'contain', background: paper }));
  const ogName = `${game}-${hash}.jpg`;
  writeFileSync(join(ogDir, ogName), og);
  keep.og.add(ogName);
  entry.og = `og-games/${ogName}`;
  manifest[game] = entry;
}

// The preview picture of the page "Games": its own picture, whole, on fields of paper (no cutting).
{
  const file = join(srcDir, `${PAGE_GAMES}.jpg`);
  if (existsSync(file)) {
    const source = readFileSync(file);
    const og = await jpegUnderLimit(sharp(source).resize(W, H, { fit: 'contain', background: paper }));
    const name = `${PAGE_GAMES}-${hashOf(source)}.jpg`;
    writeFileSync(join(ogDir, name), og);
    keep.og.add(name);
    manifest.games = { og: `og-games/${name}` };
  } else {
    console.warn(`WARNING  docs/images/games/${PAGE_GAMES}.jpg is missing: the page "Games" goes with the preview picture of the site.`);
  }
}

for (const f of readdirSync(picDir)) if (!keep.pics.has(f)) rmSync(join(picDir, f));
for (const f of readdirSync(ogDir)) if (!keep.og.has(f)) rmSync(join(ogDir, f));
writeFileSync(join(cacheDir, 'games.json'), JSON.stringify(manifest, null, 1));
console.log(`Game pictures: ${Object.keys(manifest).filter((k) => k !== 'games').length} of ${GAMES.length} picture(s), ${keep.og.size} preview picture(s).`);
