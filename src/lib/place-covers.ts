// The covers of the pages of places (scripts/make-place-covers.mjs makes the WebP files before the build). The page asks here for the picture of a place;
// without one (no `cover` in places.yaml, or a build that skipped the script) the page and the card have no picture.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBase } from '../i18n/routes';

export interface PlaceCover {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

type Manifest = Record<string, { width: number; height: number; files: { name: string; width: number }[] }>;
let manifest: Manifest | undefined;

/** The cover of a place: the widest file as `src`, all of them in `srcset`; undefined when there is none. */
export function placeCover(id: string, cwd = process.cwd()): PlaceCover | undefined {
  if (manifest === undefined) {
    try {
      manifest = JSON.parse(readFileSync(join(cwd, '.og-cache/place-covers.json'), 'utf8')) as Manifest;
    } catch {
      manifest = {};
    }
  }
  const entry = manifest[id];
  const files = (entry?.files ?? []).filter((f) => existsSync(join(cwd, 'public', f.name)));
  if (!entry || files.length === 0) return undefined;
  const widest = files[files.length - 1]!;
  return { src: withBase(widest.name), srcset: files.map((f) => `${withBase(f.name)} ${f.width}w`).join(', '), width: entry.width, height: entry.height };
}
