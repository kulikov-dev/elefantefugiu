// Makes the preview card (1200x630 JPEG, scripts/lib/og-card.mjs) of every published story, in every language, for og:image and twitter:image.
// Run by `npm run build` before astro build:   node scripts/make-og.mjs [--force]
//   .og-cache/<hash>.jpg     the cache: the hash is made of the picture, its focus, the pattern, the logo, the colours of the epoch, the name of the
//                            epoch in the language and the version of the drawing, so a card is drawn again only when one of them changes
//   .og-cache/manifest.json  which file belongs to which story and language (src/lib/og-cards.ts reads it for the page head)
//   public/og-cards/<lang>/<slug>-<hash>.jpg   what the site publishes; the hash in the name makes the messengers fetch a changed card anew
// Neither .og-cache nor public/og-cards is in the repository. In GitHub Actions .og-cache is kept by actions/cache.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { cardHash, cardInputs, composeCard, epochTitle } from './lib/og-card.mjs';
import { composeEpochCard, composeHomeCard, epochYears, liveEpochs, pageCardInputs } from './lib/og-page-card.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cacheDir = join(root, '.og-cache');
const outDir = join(root, 'public/og-cards');
const force = process.argv.includes('--force');
const LANGS = ['pt', 'en', 'ru'];
const started = Date.now();

const read = (p) => parse(readFileSync(join(root, p), 'utf8'));
const epochs = read('src/content/epochs.yaml');
const events = readdirSync(join(root, 'src/content/events'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => read(`src/content/events/${f}`))
  .filter((e) => e.status === 'ready');

mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
const manifest = {};
const wanted = new Set();
let drawn = 0;
let cached = 0;
for (const event of events) {
  const epoch = epochs.find((e) => e.id === event.epoch);
  // The picture of the story, else that of its epoch (the same rule as the page: cardPicture in src/lib/pictures.ts).
  const picture = event.image ?? (typeof epoch?.fallback_image === 'object' ? epoch.fallback_image : undefined);
  if (!picture) continue;
  for (const lang of LANGS) {
    const epochName = epochTitle(epoch.name, lang);
    const args = { file: picture.file, focus: picture.focus, epochId: event.epoch, epochName };
    const hash = cardHash(cardInputs(args));
    const cache = join(cacheDir, `${hash}.jpg`);
    if (force || !existsSync(cache)) {
      writeFileSync(cache, await composeCard(args));
      drawn += 1;
    } else cached += 1;
    const slug = event.slug[lang] ?? event.slug.en ?? event.slug.pt;
    const rel = `og-cards/${lang}/${slug}-${hash}.jpg`;
    const target = join(root, 'public', rel);
    mkdirSync(dirname(target), { recursive: true });
    if (!existsSync(target)) copyFileSync(cache, target);
    wanted.add(target);
    (manifest[event.id] ??= {})[lang] = rel;
  }
}
// The cards of the live epochs (an epoch with a page: a published story and a picture of its own) and of the home page, in every language.
// An epoch that is not open has no page and no card; when it opens, the next build makes its card. The key in the manifest is "epoch:<id>" or "home".
/** The picture of the home page card: the story the site begins with (the rhinoceros and the elephant of 1515); no caption on the plate. */
const HOME_STORY = 'rinoceronte-1515';
async function page(key, lang, slug, args, inputs, draw) {
  const hash = cardHash(inputs);
  const cache = join(cacheDir, `${hash}.jpg`);
  if (force || !existsSync(cache)) {
    writeFileSync(cache, await draw(args));
    drawn += 1;
  } else cached += 1;
  const rel = `og-cards/${lang}/${slug}-${hash}.jpg`;
  const target = join(root, 'public', rel);
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target)) copyFileSync(cache, target);
  wanted.add(target);
  (manifest[key] ??= {})[lang] = rel;
}
for (const epoch of liveEpochs(epochs, events)) {
  for (const lang of LANGS) {
    const args = { file: epoch.fallback_image.file, focus: epoch.fallback_image.focus, epochId: epoch.id, epochName: epochTitle(epoch.name, lang), years: epochYears(epoch, lang) };
    const inputs = pageCardInputs({ kind: 'epoch', file: args.file, focus: args.focus, epochId: epoch.id, text: args.epochName, years: args.years });
    await page(`epoch:${epoch.id}`, lang, `epoch-${epoch.slug[lang] ?? epoch.slug.en}`, args, inputs, composeEpochCard);
  }
}
const homeStory = events.find((e) => e.id === HOME_STORY);
if (homeStory?.image) {
  for (const lang of LANGS) {
    const args = { variant: 'panel', file: homeStory.image.file, focus: homeStory.image.focus, caption: '' };
    await page('home', lang, 'home', args, pageCardInputs({ kind: 'home', file: args.file, focus: args.focus, epochId: 'home', variant: 'panel' }), composeHomeCard);
  }
}
// Cards of earlier versions and of stories that are gone do not stay in public/.
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
for (const file of walk(outDir)) if (!wanted.has(file)) rmSync(file);
writeFileSync(join(cacheDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
// The cache keeps only what the manifest still names.
const live = new Set(Object.values(manifest).flatMap((m) => Object.values(m)).map((rel) => rel.replace(/^.*-([0-9a-f]{10})\.jpg$/, '$1.jpg')));
for (const file of readdirSync(cacheDir)) if (file.endsWith('.jpg') && !live.has(file)) rmSync(join(cacheDir, file));
console.log(`Preview cards: ${wanted.size} (${drawn} drawn, ${cached} from the cache) in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
