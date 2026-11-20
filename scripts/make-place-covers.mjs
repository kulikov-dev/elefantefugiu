// The covers of the pages of places (docs/spec.md "Страницы мест"): docs/images/places/<id>.jpg of every place that has `cover` in src/content/places.yaml,
// made into WebP files of three widths for the ribbon above the map and the card of the index.
// Run by `npm run build` before astro build:   node scripts/make-place-covers.mjs
//   public/place-covers/<id>-<hash>-<width>.webp   what the site publishes (the hash of the picture in the name: a new picture is fetched anew)
//   .og-cache/place-covers.json                    which files belong to which place (src/lib/place-covers.ts reads it)
// Neither is in the repository. A place whose file is missing is an error of check:data, not of this script.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'public/place-covers');
/** The widths of the files: a phone, a wide window, a large screen (a ribbon is as wide as the window). */
export const WIDTHS = [640, 1280, 1920];
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, '.og-cache'), { recursive: true });

const places = parse(readFileSync(join(root, 'src/content/places.yaml'), 'utf8'));
const manifest = {};
const keep = new Set();
for (const place of places) {
  if (!place.cover) continue;
  const file = join(root, 'docs/images/places', `${place.id}.jpg`);
  if (!existsSync(file)) continue;
  const bytes = readFileSync(file);
  const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 10);
  const meta = await sharp(bytes).metadata();
  const files = [];
  for (const width of WIDTHS.filter((w) => w <= meta.width).concat(meta.width < WIDTHS[0] ? [meta.width] : [])) {
    const name = `${place.id}-${hash}-${width}.webp`;
    const target = join(outDir, name);
    if (!existsSync(target)) await sharp(bytes).resize({ width }).webp({ quality: 74 }).toFile(target);
    files.push({ name: `place-covers/${name}`, width });
    keep.add(name);
  }
  manifest[place.id] = { width: meta.width, height: meta.height, files };
}
for (const f of readdirSync(outDir)) if (!keep.has(f)) rmSync(join(outDir, f));
writeFileSync(join(root, '.og-cache/place-covers.json'), JSON.stringify(manifest, null, 1));
console.log(`Place covers: ${Object.keys(manifest).length} place(s), ${keep.size} file(s) in public/place-covers/.`);
