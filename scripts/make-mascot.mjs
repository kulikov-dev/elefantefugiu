// Makes the mascot pictures for the site from the originals in docs/mascot/originals (cream background, 1024 px):
//   node scripts/make-mascot.mjs
// For every pose it removes the background (a flood fill from the border, so cream inside the picture, such as the
// trousers, stays), softens the edge so no cream halo is left on a dark page, and writes
// public/mascot/<pose>.webp (transparent, MAX px high) plus public/mascot/head.webp, a crop of the head of `stay` for the logo.
// Run by hand when an original changes and commit the result.
import { readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'docs/mascot/originals');
const out = join(root, 'public/mascot');
mkdirSync(out, { recursive: true });

const MAX = 640; // height in px of a pose; the page shows it smaller (at most about 320 px), so this is enough for 2x screens
const HEAD = { left: 170, top: 55, width: 650, height: 430 }; // the head of `stay` (ears, face, trunk), in original pixels
const NEAR = 34; // colour distance from the background colour that still counts as background
const OUTLINE = [26, 26, 30]; // the dark outline colour, used to unmix the edge pixels

const dist = (r, g, b, c) => Math.hypot(r - c[0], g - c[1], b - c[2]);

/** Background colour: the median of the pixels along the border. */
function borderColour(data, w, h) {
  const ch = [[], [], []];
  const take = (x, y) => {
    const i = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) ch[k].push(data[i + k]);
  };
  for (let x = 0; x < w; x++) {
    take(x, 0);
    take(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    take(0, y);
    take(w - 1, y);
  }
  return ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
}

function removeBackground(data, w, h) {
  const bg = borderColour(data, w, h);
  const isBg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (isBg[p]) return;
    const i = p * 4;
    if (dist(data[i], data[i + 1], data[i + 2], bg) > NEAR) return;
    isBg[p] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const span = dist(OUTLINE[0], OUTLINE[1], OUTLINE[2], bg);
  const outData = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      if (isBg[p]) {
        outData[i + 3] = 0;
        continue;
      }
      // Edge: a kept pixel that touches the background is a mix of outline and background; recover the outline share as alpha.
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < w && ny < h && isBg[ny * w + nx];
      });
      if (!edge) continue;
      const d = dist(data[i], data[i + 1], data[i + 2], bg);
      const a = Math.min(1, d / span);
      if (a >= 0.98) continue;
      outData[i + 3] = Math.round(a * 255);
      for (let k = 0; k < 3; k++) {
        const v = (data[i + k] - (1 - a) * bg[k]) / Math.max(a, 0.05);
        outData[i + k] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
  }
  return outData;
}

const files = readdirSync(src).filter((n) => /\.(png|webp|jpe?g)$/i.test(n));
for (const name of files) {
  const pose = name.replace(/\.\w+$/, '');
  const { data, info } = await sharp(join(src, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cleaned = removeBackground(data, info.width, info.height);
  const base = () => sharp(cleaned, { raw: { width: info.width, height: info.height, channels: 4 } });
  await base().resize({ height: MAX }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(join(out, `${pose}.webp`));
  console.log(`${pose}.webp ${(statSync(join(out, `${pose}.webp`)).size / 1024).toFixed(1)} KB`);
  if (pose === 'stay') {
    await base().extract(HEAD).resize({ height: 192 }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(join(out, 'head.webp'));
    console.log(`head.webp ${(statSync(join(out, 'head.webp')).size / 1024).toFixed(1)} KB`);
  }
}
