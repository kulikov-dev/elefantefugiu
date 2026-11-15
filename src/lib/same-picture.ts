// Do two picture files show the same picture? A holiday whose azulejo is the picture of its story of the day does not repeat it on the card (FestaView).
// Both files are shrunk to 32x32 grey and compared pixel by pixel, so a different format or size of the same picture still matches; a build-time check only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SIZE = 32;
/** The mean difference of a grey level (0..255) under which two pictures count as one. */
const SAME_BELOW = 6;
const cache = new Map<string, Promise<Buffer>>();

const thumb = (file: string): Promise<Buffer> => {
  let found = cache.get(file);
  if (!found) {
    found = sharp(readFileSync(file)).resize(SIZE, SIZE, { fit: 'fill' }).greyscale().raw().toBuffer();
    cache.set(file, found);
  }
  return found;
};

/** `a` and `b` are paths relative to src/assets/ (for example "stories/x.webp", "festas/y.jpg"). */
export async function samePicture(a: string, b: string, cwd = process.cwd()): Promise<boolean> {
  const [x, y] = await Promise.all([thumb(join(cwd, 'src/assets', a)), thumb(join(cwd, 'src/assets', b))]);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i]! - y[i]!);
  return sum / x.length < SAME_BELOW;
}
