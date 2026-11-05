// The preview picture of the page of a finished panel (docs/spec.md 5.2): 1200x630 JPEG, the whole panel (no cutting: the panels are 3:2, a cut to 1.91:1
// would take the top and the bottom of the picture) at the height of 630 px in the middle, on fields of the paper of the epoch (the light --epoch-tint).
// Run by the build before astro build (npm run build):   node scripts/make-panno-og.mjs
//   public/og-panno/<epoch id>-<hash>.jpg   what the site publishes (the hash in the name makes the messengers fetch a changed picture anew)
//   .og-cache/panno.json                    which file belongs to which epoch (src/lib/og-cards.ts pannoCardPath reads it)
// Neither is in the repository.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import { epochPalette, tokensCss } from './lib/og-card.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'public/og-panno');
const cacheDir = join(root, '.og-cache');
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const W = 1200;
const H = 630;
const MAX_BYTES = 190 * 1024; // the check of the preview cards allows 200 KB

/** The panel whole on fields of `tint`: the largest size that fits 1200x630 with no cutting, in the middle. */
async function composePannoCard(file, tint) {
  const cut = sharp(file).resize(W, H, { fit: 'contain', background: tint });
  let buffer = await cut.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  for (let quality = 78; buffer.length > MAX_BYTES && quality >= 50; quality -= 4) buffer = await cut.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
  return buffer;
}

const epochs = parse(readFileSync(join(root, 'src/content/epochs.yaml'), 'utf8'));
const manifest = {};
const keep = new Set();
for (const epoch of epochs) {
  if (!epoch.panno) continue;
  const file = join(root, 'src/assets/panno', epoch.panno.image);
  if (!existsSync(file)) throw new Error(`make-panno-og: src/assets/panno/${epoch.panno.image} of ${epoch.id} does not exist`);
  const buffer = await composePannoCard(file, epochPalette(tokensCss, epoch.id).tint);
  const name = `${epoch.id}-${createHash('sha1').update(buffer).digest('hex').slice(0, 10)}.jpg`;
  writeFileSync(join(outDir, name), buffer);
  manifest[epoch.id] = `og-panno/${name}`;
  keep.add(name);
}
for (const f of readdirSync(outDir)) if (!keep.has(f)) rmSync(join(outDir, f));
writeFileSync(join(cacheDir, 'panno.json'), JSON.stringify(manifest, null, 1));
console.log(`Panel previews: ${keep.size} picture(s) in public/og-panno/.`);

