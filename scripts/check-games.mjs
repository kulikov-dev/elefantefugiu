// Checks the pictures of the games (docs/spec.md 5.10) in the build: the three pictures 3:2 of docs/images/games (myths, order, games), the preview pictures (1200x630 JPEG, up to 200 KB) the pages point to.
// Part of postbuild. A missing source picture is a WARNING, never an error (the pages go without it); a preview picture the build points to that is not there, or is the wrong size, is an error.
// CHECK_DIST=<dir> checks another build.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = process.env.CHECK_DIST || join(root, 'dist');
const GAMES = ['myths', 'order', 'games'];
const PAGES = { myths: { pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' }, order: { pt: 'o-que-veio-primeiro', en: 'which-came-first', ru: 'chto-bylo-ranshe' }, games: { pt: 'jogos', en: 'games', ru: 'igry' } };

const warnings = [];
const errors = [];
for (const game of GAMES) {
  const file = join(root, 'docs/images/games', `${game}.jpg`);
  if (!existsSync(file)) {
    warnings.push(`docs/images/games/${game}.jpg is missing: the pages of the game go without its picture and use the preview picture of the site`);
    continue;
  }
  const meta = await sharp(file).metadata();
  if (Math.abs(meta.width / meta.height - 1.5) > 0.02) warnings.push(`docs/images/games/${game}.jpg is ${meta.width}x${meta.height}, not 3:2: it is shown whole, the box will not match`);
  if (meta.width < 1200) warnings.push(`docs/images/games/${game}.jpg is only ${meta.width} px wide (1200 and more is wanted)`);
}

// Every game page that is built points to a preview picture of ours: it exists, 1200x630, up to 200 KB.
for (const [key, byLang] of Object.entries(PAGES)) {
  const own = existsSync(join(root, 'docs/images/games', `${key}.jpg`));
  if (!own) continue;
  for (const [lang, slug] of Object.entries(byLang)) {
    const page = join(dist, lang, slug, 'index.html');
    if (!existsSync(page)) {
      errors.push(`${lang}/${slug}/ was not built`);
      continue;
    }
    const html = readFileSync(page, 'utf8');
    const image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
    const m = image && /\/(og-games\/[^/?#]+)$/.exec(image);
    if (!m) {
      errors.push(`${lang}/${slug}/: og:image is not a picture of the games (${image ?? 'none'})`);
      continue;
    }
    const path = join(dist, m[1]);
    if (!existsSync(path)) {
      errors.push(`${lang}/${slug}/: ${m[1]} is not in dist/`);
      continue;
    }
    const meta = await sharp(path).metadata();
    if (meta.width !== 1200 || meta.height !== 630 || meta.format !== 'jpeg') errors.push(`${m[1]} is ${meta.width}x${meta.height} ${meta.format}, not a 1200x630 JPEG`);
    if (statSync(path).size > 200 * 1024) errors.push(`${m[1]} is over 200 KB`);
  }
}

for (const w of warnings) console.warn(`WARNING  ${w}`);
if (errors.length) {
  console.error(`Games check failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`Games check passed: ${GAMES.length - warnings.filter((w) => w.includes('is missing')).length} of ${GAMES.length} pictures, the preview pictures of the pages are 1200x630 JPEG up to 200 KB${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
