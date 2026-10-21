// Makes the raster preview pictures (PNG, 1200x630) for Open Graph and Twitter cards from the SVG pictures in public/images.
// Social networks do not accept SVG. Run by hand when a picture changes, and commit the PNG files next to the SVG ones:
//   node scripts/make-og-images.mjs
// The page head takes the PNG that sits next to a picture's SVG (src/lib/og.ts); a picture without one keeps its own address.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../public/images/', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

let count = 0;
for (const file of walk(root).filter((f) => f.endsWith('.svg'))) {
  const out = file.replace(/\.svg$/, '.png');
  await sharp(file, { density: 144 }).resize(1200, 630, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(out);
  console.log(`${relative(root, file)} -> ${relative(root, out)} (${(statSync(out).size / 1024).toFixed(1)} KB)`);
  count += 1;
}
console.log(`${count} preview picture(s) written.`);
