// Makes the preview pictures (PNG, 1200x630) of the pages that have no picture of their own: the home page, the five threads
// and every other page of the site. No text (the title and the description come from the page; a picture with text would have
// to exist in three languages) and no elephant on the threads and the plain pages: a thread holds heavy topics.
// Made from the azulejo patterns of src/assets/azulejo and the mascot of public/mascot. Run by hand when something changes,
// and commit the PNG files:
//   node scripts/make-site-og.mjs
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'public/images/og');
mkdirSync(out, { recursive: true });

const W = 1200;
const H = 630;
const PAPER = '#f6f1e7'; // --color-bg, light theme (src/styles/tokens.css)
const INK = '#6b5a43';

const svg = (name) => readFileSync(join(root, 'src/assets/azulejo', `${name}.svg`), 'utf8');
const paint = (source, color) => source.replace(/#000/g, color);

/** A pattern file tiled over the whole picture: the colour at the given opacity. */
async function tiled(name, color, opacity, size) {
  const tile = await sharp(Buffer.from(paint(svg(name), color)), { density: 300 }).resize(size, size).png().toBuffer();
  const cols = Math.ceil(W / size);
  const rows = Math.ceil(H / size);
  const inputs = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) inputs.push({ input: tile, left: c * size, top: r * size });
  const layer = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(inputs)
    .png()
    .toBuffer();
  // The whole layer at the given opacity (the alpha channel is scaled; the colours stay).
  return sharp(layer).linear([1, 1, 1, opacity], [0, 0, 0, 0]).png().toBuffer();
}

async function make(file, { pattern, color, opacity, tile, mascot, band }) {
  const layers = [{ input: await tiled(pattern, color, opacity, tile) }];
  if (band) layers.push({ input: await sharp({ create: { width: W, height: 22, channels: 3, background: color } }).png().toBuffer(), left: 0, top: H - 22 });
  if (mascot) {
    const m = await sharp(join(root, 'public/mascot', `${mascot}.webp`)).resize(540, 540).png().toBuffer();
    layers.push({ input: m, left: W - 540 - 90, top: H - 540 - 40 });
  }
  const path = join(out, file);
  await sharp({ create: { width: W, height: H, channels: 3, background: PAPER } })
    .composite(layers)
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(path);
  console.log(`${file} (${(statSync(path).size / 1024).toFixed(0)} KB)`);
}

// The home page: the compass of the Discoveries and the standing elephant. The only picture here with the mascot.
await make('home.png', { pattern: 'bussola', color: '#1f6f8b', opacity: 0.12, tile: 150, mascot: 'stay' });
// Every other page (About, Method, Legal, Map, ...): the compass in the colour of the ink, nothing else.
await make('page.png', { pattern: 'bussola', color: INK, opacity: 0.14, tile: 150 });
// A thread: the rhombus in the colour of the thread, a band of the same colour along the bottom.
const threads = parse(readFileSync(join(root, 'src/content/threads.yaml'), 'utf8'));
for (const thread of threads) await make(`fio-${thread.id}.png`, { pattern: 'rombo', color: thread.color, opacity: 0.16, tile: 150, band: true });
