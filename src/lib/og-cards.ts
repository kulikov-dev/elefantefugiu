// The preview cards of the stories (scripts/make-og.mjs makes them before the build: 1200x630 JPEG, one per story and language). The page head asks
// here for the address of a card; without a card (the dev server before the first `npm run build`, a build that skipped make-og) it keeps the
// picture it had before.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lang } from '../i18n/routes';

export const OG_CARD = { width: 1200, height: 630, type: 'image/jpeg' } as const;

type Manifest = Record<string, Partial<Record<Lang, string>>>;
let manifest: Manifest | undefined;

/** The path of the card inside public/ (no base path), or undefined when there is none. `key` is a story id, "epoch:<id>" or "home" (the manifest of make-og.mjs). */
export function cardPath(key: string, lang: Lang, cwd = process.cwd()): string | undefined {
  if (manifest === undefined) {
    try {
      manifest = JSON.parse(readFileSync(join(cwd, '.og-cache/manifest.json'), 'utf8')) as Manifest;
    } catch {
      manifest = {};
    }
  }
  const rel = manifest[key]?.[lang];
  return rel && existsSync(join(cwd, 'public', rel)) ? rel : undefined;
}

/** The card of a story, of a live epoch and of the home page. */
export const storyCardPath = (id: string, lang: Lang): string | undefined => cardPath(id, lang);
export const epochCardPath = (id: string, lang: Lang): string | undefined => cardPath(`epoch:${id}`, lang);
export const homeCardPath = (lang: Lang): string | undefined => cardPath('home', lang);
