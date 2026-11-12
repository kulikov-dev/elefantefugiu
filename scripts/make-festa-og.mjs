// The preview picture of each holiday that has a drawing (src/data/festas.yaml, src/lib/festa-art.mjs): 1200x630 PNG, the drawing in the light theme on the
// paper of the site, no text. Run by the build before astro build (npm run build); the home page in the window of a holiday and the page of the holiday share it.
//   public/og-festas/<id>-<hash>.png   what the site publishes (the hash in the name makes the messengers fetch a changed picture anew)
//   .og-cache/festas.json              which file belongs to which holiday (src/lib/og-cards.ts festaCardPath reads it)
//   public/festas/favicon-<name>.svg, -32.png, -180.png   the icon of the tab in the window of a holiday (festas.yaml `favicon`); 180 is the touch icon of iOS
// None of these is in the repository. The colours are the light values of the --festa-* tokens of src/styles/tokens.css.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import { ART, ICONS } from '../src/lib/festa-art.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'public/og-festas');
const cacheDir = join(root, '.og-cache');
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });
const iconDir = join(root, 'public/festas');
mkdirSync(iconDir, { recursive: true });

const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
/** The light value of a colour token: `light-dark(<light>, <dark>)`. */
const light = (name) => {
  const line = tokens.split('\n').find((l) => l.trim().startsWith(`${name}:`)) ?? '';
  const m = /light-dark\(\s*(#[0-9a-fA-F]{3,8})\s*,/.exec(line);
  if (!m) throw new Error(`make-festa-og: ${name} is not a light-dark() colour in tokens.css`);
  return m[1];
};
const colors = { '--festa-ink': light('--festa-ink'), '--festa-warm': light('--festa-warm'), '--festa-wash': light('--festa-wash'), '--festa-shell': light('--festa-shell'), '--festa-plate': light('--festa-wash'), '--festa-cherry': light('--festa-cherry'), '--festa-angelica': light('--festa-angelica'), '--festa-peel': light('--festa-peel'), '--festa-glaze': light('--festa-glaze'), '--festa-glaze-deep': light('--festa-glaze-deep') };
const paper = light('--color-bg');
/** The dark value of a colour token: the second colour of `light-dark(<light>, <dark>)`. */
const dark = (name) => {
  const line = tokens.split('\n').find((l) => l.trim().startsWith(`${name}:`)) ?? '';
  const m = /light-dark\(\s*#[0-9a-fA-F]{3,8}\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/.exec(line);
  if (!m) throw new Error(`make-festa-og: ${name} has no dark colour in tokens.css`);
  return m[1];
};
const iconColors = { ink: light('--festa-ink'), warm: light('--festa-warm'), inkDark: dark('--festa-ink'), warmDark: dark('--festa-warm'), cherry: light('--festa-cherry'), cherryDark: dark('--festa-cherry'), angelica: light('--festa-angelica'), angelicaDark: dark('--festa-angelica'), shell: light('--festa-shell'), shellDark: dark('--festa-shell') };

const W = 1200;
const H = 630;
const festas = parse(readFileSync(join(root, 'src/data/festas.yaml'), 'utf8'));
const manifest = {};
const keep = new Set();
/** The picture of the owner (festas.yaml `image`, a file in src/assets/; the other of .png / .jpg is tried when it is missing), or undefined. */
const ownPicture = (festa) => {
  if (!festa.image) return undefined;
  const swap = festa.image.endsWith('.png') ? festa.image.replace(/\.png$/, '.jpg') : festa.image.replace(/\.jpg$/, '.png');
  return [festa.image, swap].map((rel) => join(root, 'src/assets', rel)).find((file) => existsSync(file));
};
for (const festa of festas) {
  if (Object.keys(festa.text ?? {}).length === 0) continue;
  const own = ownPicture(festa);
  if (own) {
    // Cut to 1200x630 from the middle, a JPEG like the cards of the stories; the hash of the file is in the name.
    // The quality goes down until the picture is under 190 KB (the check of the preview cards allows 200 KB).
    const cut = sharp(own).resize(W, H, { fit: 'cover', position: 'centre' });
    let buffer = await cut.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    for (let quality = 78; buffer.length > 190 * 1024 && quality >= 50; quality -= 4) buffer = await cut.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    const name = `${festa.id}-${createHash('sha1').update(buffer).digest('hex').slice(0, 10)}.jpg`;
    writeFileSync(join(outDir, name), buffer);
    manifest[festa.id] = `og-festas/${name}`;
    keep.add(name);
    continue;
  }
  if (!festa.art || !ART[festa.art] || Object.keys(festa.text ?? {}).length === 0) continue;
  let inner = ART[festa.art].inner;
  for (const [name, value] of Object.entries(colors)) inner = inner.split(`var(${name})`).join(value);
  // The rays stand at the middle of their glow.
  inner = inner.replace('class="festa-rays"', 'opacity="0.45"');
  const scale = 2.2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${paper}"/>` +
    `<g transform="translate(${(W - 400 * scale) / 2} ${(H - 230 * scale) / 2}) scale(${scale})">${inner}</g></svg>`;
  const hash = createHash('sha1').update(svg).digest('hex').slice(0, 10);
  const name = `${festa.id}-${hash}.png`;
  await sharp(Buffer.from(svg), { density: 96 }).resize(W, H).png({ compressionLevel: 9 }).toFile(join(outDir, name));
  manifest[festa.id] = `og-festas/${name}`;
  keep.add(name);
}
// The icons of the tab: an SVG for the browsers that take it (it follows the colour scheme of the device) and PNG 32 and 180 in the light colours.
// The touch icon has the paper of the site behind the crown (iOS fills a transparent one with black).
const icons = new Set([...new Set(festas.map((f) => f.favicon).filter(Boolean))]);
const iconFiles = new Set();
for (const name of icons) {
  const make = ICONS[name];
  if (!make) throw new Error(`make-festa-og: no icon "${name}" in src/lib/festa-art.mjs`);
  writeFileSync(join(iconDir, `favicon-${name}.svg`), make(iconColors));
  const light1 = Buffer.from(make(iconColors, 'light'));
  await sharp(light1, { density: 384 }).resize(32, 32).png({ compressionLevel: 9 }).toFile(join(iconDir, `favicon-${name}-32.png`));
  const crown = await sharp(light1, { density: 1152 }).resize(124, 124).png().toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: paper } }).composite([{ input: crown, left: 28, top: 28 }]).png({ compressionLevel: 9 }).toFile(join(iconDir, `favicon-${name}-180.png`));
  for (const f of [`favicon-${name}.svg`, `favicon-${name}-32.png`, `favicon-${name}-180.png`]) iconFiles.add(f);
}
for (const file of readdirSync(iconDir)) if (!iconFiles.has(file)) rmSync(join(iconDir, file));
for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(join(outDir, file));
writeFileSync(join(cacheDir, 'festas.json'), JSON.stringify(manifest, null, 1));
console.log(`Holiday previews: ${keep.size} picture(s) in public/og-festas/, ${icons.size} tab icon(s) in public/festas/.`);
