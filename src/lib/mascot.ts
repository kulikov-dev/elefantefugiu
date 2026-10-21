// The elephant mascot (docs/visual-direction.md section 6): poses, picture sizes and where it may appear. No Astro imports.
import { FLASH_EPOCH } from './events';

/** Poses that have a picture in public/mascot/<pose>.webp (made by scripts/make-mascot.mjs). `head` is a crop for the logo. */
export const POSES = ['walk', 'run', 'peek', 'map', 'bow', 'think', 'stay', 'sad', 'head'] as const;
export type Pose = (typeof POSES)[number];

/** Pixel size of each picture; the page shows it smaller, the attributes only reserve the space. */
export const POSE_SIZE: Record<Pose, { width: number; height: number }> = {
  walk: { width: 640, height: 640 },
  run: { width: 640, height: 640 },
  peek: { width: 640, height: 640 },
  map: { width: 640, height: 640 },
  bow: { width: 640, height: 640 },
  think: { width: 640, height: 640 },
  stay: { width: 640, height: 640 },
  sad: { width: 640, height: 640 },
  head: { width: 290, height: 192 },
};

/** Where the picture of a pose lies, relative to the site root (before the base path is added). */
export const poseFile = (pose: Pose): string => `mascot/${pose}.webp`;

/**
 * The mascot never appears on a heavy card, a card for readers 16+, or on pages about the regime (the Estado Novo epoch):
 * docs/visual-direction.md section 6, "Rules of appearance". The logo is the brand, not a mascot appearance, and is not subject to this.
 */
export function mascotAllowed(page: { sensitive?: boolean; min_age?: string | number; epoch?: string }): boolean {
  if (page.sensitive) return false;
  if (page.min_age !== undefined && String(page.min_age) === '16') return false;
  if (page.epoch === FLASH_EPOCH) return false;
  return true;
}
