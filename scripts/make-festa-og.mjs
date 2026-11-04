// The preview picture of each holiday that has a drawing (src/data/festas.yaml, src/lib/festa-art.mjs): 1200x630 PNG, the drawing in the light theme on the
// paper of the site, no text. Run by the build before astro build (npm run build); the home page in the window of a holiday and the page of the holiday share it.
//   public/og-festas/<id>-<hash>.png   what the site publishes (the hash in the name makes the messengers fetch a changed picture anew)
//   .og-cache/festas.json              which file belongs to which holiday (src/lib/og-cards.ts festaCardPath reads it)
// Neither is in the repository. The colours are the light values of the --festa-* tokens of src/styles/tokens.css.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import { ART } from '../src/lib/festa-art.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'public/og-festas');
const cacheDir = join(root, '.og-cache');
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
/** The light value of a colour token: `light-dark(<light>, <dark>)`. */
const light = (name) => {
  const line = tokens.split('\n').find((l) => l.trim().startsWith(`${name}:`)) ?? '';
  const m = /light-dark\(\s*(#[0-9a-fA-F]{3,8})\s*,/.exec(line);
  if (!m) throw new Error(`make-festa-og: ${name} is not a light-dark() colour in tokens.css`);
  return m[1];
};
const colors = { '--festa-ink': light('--festa-ink'), '--festa-warm': light('--festa-warm'), '--festa-wash': light('--festa-wash'), '--festa-shell': light('--festa-shell') };
const paper = light('--color-bg');

const W = 1200;
const H = 630;
const festas = parse(readFileSync(join(root, 'src/data/festas.yaml'), 'utf8'));
const manifest = {};
const keep = new Set();
for (const festa of festas) {
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
for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(join(outDir, file));
writeFileSync(join(cacheDir, 'festas.json'), JSON.stringify(manifest, null, 1));
console.log(`Holiday previews: ${keep.size} picture(s) in public/og-festas/.`);
