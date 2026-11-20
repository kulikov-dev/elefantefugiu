// The objects of the shelves of the cabinet of rarities (docs/spec.md "Кабинет редкостей"): a PNG with a transparent background for each object.
// Run by the build before astro build (npm run build), and by hand when a picture changes:   node scripts/make-cabinet-shelf.mjs
//   in    docs/images/cabinet/shelf-src/kNN-name.jpg   the object on a pure white background (the owner's pictures)
//   out   docs/images/cabinet/shelf/kNN-name.png       kept in the repository (to compare by eye)
//         public/cabinet-shelf/kNN-name.png            the copy the site serves (not in the repository)
// The background is the near-white (min(r,g,b) > 232) area that touches the edge of the picture (a fill from the edges: white inside the object stays); it becomes transparent,
// the edge is blurred by one pixel, the picture is cropped to the object and fitted into 420 x 300 (about twice the largest size it is shown at: 160 px high, a column wide).
// The same cut makes the two pictures of the sardines (docs/images/cabinet/sardine-src.jpg and tin-src.jpg, white inside the key of the tin cut out too):
//   docs/images/cabinet/art/sardine.png, tin.png, sardine-outline.svg (the dashed outline of the place of a sardine not found yet)   and the copy in public/cabinet-art/
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'docs/images/cabinet/shelf-src');
const outDir = join(root, 'docs/images/cabinet/shelf');
const publicDir = join(root, 'public/cabinet-shelf');
const WHITE = 232;
const MAX = { width: 420, height: 300 };
const artDir = join(root, 'docs/images/cabinet/art');
const publicArtDir = join(root, 'public/cabinet-art');

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

/** White that does not touch the edge but is a hole of its own (the eye of the key of the tin): the pieces of at least `minArea` pixels of near-white become transparent. */
export function dropHoles(alpha, data, width, height, channels, minArea) {
  const seen = new Uint8Array(width * height);
  for (let start = 0; start < alpha.length; start++) {
    if (alpha[start] !== 255 || seen[start] || Math.min(data[start * channels], data[start * channels + 1], data[start * channels + 2]) <= WHITE) continue;
    const piece = [start];
    seen[start] = 1;
    for (let k = 0; k < piece.length; k++) {
      const i = piece[k];
      const x = i % width;
      const y = (i - x) / width;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (alpha[j] === 255 && !seen[j] && Math.min(data[j * channels], data[j * channels + 1], data[j * channels + 2]) > WHITE) (seen[j] = 1, piece.push(j));
      }
    }
    if (piece.length >= minArea) for (const i of piece) alpha[i] = 0;
  }
}

export async function cutOut(file, { max = MAX, holes = 0 } = {}) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alpha = backgroundMask(data, width, height, channels);
  dropSpecks(alpha, width, height);
  if (holes > 0) dropHoles(alpha, data, width, height, channels, holes);
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
    .resize({ ...max, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** The outer outline of a picture with alpha as a dashed SVG path (Moore tracing of a mask 120 units wide, then Douglas-Peucker): a mask for the place of a sardine not found yet. */
export async function outlineSvg(png, units = 120) {
  const { data, info } = await sharp(png).resize({ width: units }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const on = (x, y) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] > 110;
  let sx = -1;
  let sy = -1;
  for (let y = 0; y < height && sx < 0; y++) for (let x = 0; x < width; x++) if (on(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([dx, dy]) => on(x + dx, y + dy)).length >= 4) { sx = x; sy = y; break; }
  // Moore tracing, clockwise (screen coordinates): `back` is the direction from the pixel to the background pixel it was entered from.
  const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const indexOf = (dx, dy) => dirs.findIndex(([a, b]) => a === dx && b === dy);
  const points = [[sx, sy]];
  let [x, y] = [sx, sy];
  let back = 6;
  for (let guard = 0; guard < width * height * 4; guard++) {
    let moved = false;
    for (let k = 1; k <= 8; k++) {
      const nd = (back + k) % 8;
      const [nx, ny] = [x + dirs[nd][0], y + dirs[nd][1]];
      if (on(nx, ny)) {
        const prev = dirs[(nd + 7) % 8];
        back = indexOf(x + prev[0] - nx, y + prev[1] - ny);
        [x, y, moved] = [nx, ny, true];
        break;
      }
    }
    if (!moved || (x === sx && y === sy)) break;
    points.push([x, y]);
  }
  const far = (p, a, b) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dx, dy) || 1;
    return Math.abs(dx * (a[1] - p[1]) - (a[0] - p[0]) * dy) / len;
  };
  const simplify = (pts, eps) => {
    if (pts.length < 3) return pts;
    let [index, worst] = [0, 0];
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = far(pts[i], pts[0], pts.at(-1));
      if (dist > worst) [index, worst] = [i, dist];
    }
    if (worst <= eps) return [pts[0], pts.at(-1)];
    return [...simplify(pts.slice(0, index + 1), eps).slice(0, -1), ...simplify(pts.slice(index), eps)];
  };
  // A closed loop: cut at the point farthest from the start, simplify both halves.
  let mid = 1;
  for (let i = 1; i < points.length; i++) if (Math.hypot(points[i][0] - sx, points[i][1] - sy) > Math.hypot(points[mid][0] - sx, points[mid][1] - sy)) mid = i;
  const path = [...simplify(points.slice(0, mid + 1), 0.7).slice(0, -1), ...simplify([...points.slice(mid), points[0]], 0.7)];
  const d2 = path.map(([px, py], i) => `${i ? 'L' : 'M'}${px + 0.5} ${py + 0.5}`).join('') + 'Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path d="${d2}" fill="none" stroke="#000" stroke-width="1.6" stroke-linejoin="round" stroke-dasharray="4 3"/></svg>
`;
}

async function makeArt() {
  const sardine = join(root, 'docs/images/cabinet/sardine-src.jpg');
  const tin = join(root, 'docs/images/cabinet/tin-src.jpg');
  mkdirSync(artDir, { recursive: true });
  mkdirSync(publicArtDir, { recursive: true });
  const made = [];
  if (existsSync(sardine)) {
    const png = await cutOut(sardine, { max: { width: 360, height: 160 } });
    const meta = await sharp(png).metadata();
    writeFileSync(join(artDir, 'sardine.png'), png);
    writeFileSync(join(artDir, 'sardine-outline.svg'), await outlineSvg(png));
    made.push(`sardine ${meta.width}x${meta.height}`);
  }
  if (existsSync(tin)) {
    const png = await cutOut(tin, { max: { width: 720, height: 400 }, holes: 1500 });
    const meta = await sharp(png).metadata();
    writeFileSync(join(artDir, 'tin.png'), png);
    made.push(`tin ${meta.width}x${meta.height}`);
  }
  for (const f of readdirSync(artDir)) copyFileSync(join(artDir, f), join(publicArtDir, f));
  console.log(`make-cabinet-shelf: art ${made.join(', ') || 'none (no sardine-src.jpg, tin-src.jpg)'}`);
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
  }
  console.log(`make-cabinet-shelf: ${names.length} object(s) cut out into docs/images/cabinet/shelf and public/cabinet-shelf`);
}
await makeArt();
