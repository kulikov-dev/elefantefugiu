// The objects of the shelves of the cabinet of rarities (docs/spec.md "Кабинет редкостей"): a PNG with a transparent background for each object.
// Run by the build before astro build (npm run build), and by hand when a picture changes:   node scripts/make-cabinet-shelf.mjs
//   in    docs/images/cabinet/shelf-src/kNN-name.jpg   the object on a pure white background (the owner's pictures)
//   out   docs/images/cabinet/shelf/kNN-name.png       kept in the repository (to compare by eye)
//         docs/images/cabinet/shelf/kNN-name-outline.png   the dashed inner outline of the object by its alpha mask (a mask for the page: a rarity not found yet is shown by its shape)
//         public/cabinet-shelf/kNN-name.png            the copy the site serves (not in the repository)
// The background is the near-white (min(r,g,b) > 232) area that touches the edge of the picture (a fill from the edges: white inside the object stays); it becomes transparent,
// the edge is blurred by one pixel, the picture is cropped to the object and fitted into 420 x 300 (about twice the largest size it is shown at: 160 px high, a column wide).
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'docs/images/cabinet/shelf-src');
const outDir = join(root, 'docs/images/cabinet/shelf');
const publicDir = join(root, 'public/cabinet-shelf');
const WHITE = 232;
const MAX = { width: 420, height: 300 };

/** The alpha channel of a picture: 0 for the white that is connected to the edge, 255 for the rest. */
export function backgroundMask(data, width, height, channels) {
  const near = (i) => Math.min(data[i * channels], data[i * channels + 1], data[i * channels + 2]) > WHITE;
  const alpha = new Uint8Array(width * height).fill(255);
  const stack = [];
  const push = (x, y) => {
    const i = y * width + x;
    if (alpha[i] === 255 && near(i)) {
      alpha[i] = 0;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) (push(x, 0), push(x, height - 1));
  for (let y = 0; y < height; y++) (push(0, y), push(width - 1, y));
  while (stack.length > 0) {
    const i = stack.pop();
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return alpha;
}

/** Takes away the specks that are not part of the object: the pieces of the foreground smaller than 1% of the largest one (noise of the picture, a crumb of a shadow). */
export function dropSpecks(alpha, width, height) {
  const label = new Int32Array(width * height);
  const sizes = [0];
  for (let start = 0; start < alpha.length; start++) {
    if (alpha[start] !== 255 || label[start] !== 0) continue;
    const id = sizes.length;
    sizes.push(0);
    const stack = [start];
    label[start] = id;
    while (stack.length > 0) {
      const i = stack.pop();
      sizes[id]++;
      const x = i % width;
      const y = (i - x) / width;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (alpha[j] === 255 && label[j] === 0) (label[j] = id, stack.push(j));
      }
    }
  }
  const largest = Math.max(...sizes);
  for (let i = 0; i < alpha.length; i++) if (alpha[i] === 255 && sizes[label[i]] < largest * 0.01) alpha[i] = 0;
}

export async function cutOut(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alpha = backgroundMask(data, width, height, channels);
  dropSpecks(alpha, width, height);
  // The edge is softened by one pixel: the alpha alone is blurred.
  const soft = await sharp(Buffer.from(alpha), { raw: { width, height, channels: 1 } }).blur(0.8).toColourspace('b-w').raw().toBuffer();
  const rgba = Buffer.alloc(width * height * 4);
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = data[i * channels];
    rgba[i * 4 + 1] = data[i * channels + 1];
    rgba[i * 4 + 2] = data[i * channels + 2];
    rgba[i * 4 + 3] = soft[i];
    if (soft[i] > 8) {
      const x = i % width;
      const y = (i - x) / width;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error(`${file}: nothing but background`);
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ ...MAX, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** The outline of an object by its alpha mask: a band of OUTLINE_WIDTH pixels inside its edge, cut into dashes (diagonal stripes), as an alpha-only PNG of the same size (no fill). */
const OUTLINE_WIDTH = 4;
const DASH = 7;
export async function dashedOutline(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const inside = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) inside[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  // erosion by OUTLINE_WIDTH (square window, two passes), so that inside & ~eroded is the band along the edge
  const pass = (src, horizontal) => {
    const out = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let all = 1;
        for (let d = -OUTLINE_WIDTH; d <= OUTLINE_WIDTH && all; d++) {
          const xx = horizontal ? x + d : x;
          const yy = horizontal ? y : y + d;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height || !src[yy * width + xx]) all = 0;
        }
        out[y * width + x] = all;
      }
    }
    return out;
  };
  const eroded = pass(pass(inside, true), false);
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const band = inside[i] && !eroded[i];
      const dash = Math.floor((x + y) / DASH) % 2 === 0;
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = band && dash ? 255 : 0;
    }
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

if (!existsSync(srcDir)) {
  console.log('make-cabinet-shelf: no docs/images/cabinet/shelf-src, nothing to do');
} else {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  const names = readdirSync(srcDir).filter((f) => /\.jpe?g$/i.test(f));
  for (const name of names) {
    const target = name.replace(/\.jpe?g$/i, '.png');
    const png = await cutOut(join(srcDir, name));
    await sharp(png).toFile(join(outDir, target));
    copyFileSync(join(outDir, target), join(publicDir, target));
    const outline = target.replace(/.png$/, '-outline.png');
    await sharp(await dashedOutline(png)).toFile(join(outDir, outline));
    copyFileSync(join(outDir, outline), join(publicDir, outline));
  }
  console.log(`make-cabinet-shelf: ${names.length} object(s) cut out (with the dashed outline of each) into docs/images/cabinet/shelf and public/cabinet-shelf`);
}
