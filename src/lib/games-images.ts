// The pictures of the games (scripts/make-games-images.mjs makes them from docs/images/games/*.jpg before the build): the picture whole, 3:2, in two widths, and the preview pictures (1200x630).
// A missing picture is `undefined`: the page then goes without it (the build warns, `npm run check:games`).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBase } from '../i18n/routes';

export type GameName = 'myths' | 'order';
type Entry = { sizes: Record<string, { file: string; width: number; height: number }>; og: string };
type Manifest = Partial<Record<GameName, Entry>> & { games?: { og: string } };
let manifest: Manifest | undefined;

function read(cwd: string): Manifest {
  if (manifest === undefined) {
    try {
      manifest = JSON.parse(readFileSync(join(cwd, '.og-cache/games.json'), 'utf8')) as Manifest;
    } catch {
      manifest = {};
    }
  }
  return manifest;
}

export interface GamePicture {
  src: string;
  srcset: string;
  /** The size of the biggest file, for the width and height attributes (the box is kept before the picture comes). */
  width: number;
  height: number;
  /** The preview picture of the page of the game (a path inside public/, without the base path). */
  og: string;
}

/** The picture of a game for a page (base path in the addresses), or undefined. */
export function gamePicture(game: GameName, cwd = process.cwd()): GamePicture | undefined {
  const entry = read(cwd)[game];
  if (!entry) return undefined;
  const sizes = Object.values(entry.sizes).filter((s) => existsSync(join(cwd, 'public', s.file))).sort((a, b) => a.width - b.width);
  const biggest = sizes.at(-1);
  if (!biggest || !existsSync(join(cwd, 'public', entry.og))) return undefined;
  return { src: withBase(biggest.file), srcset: sizes.map((s) => `${withBase(s.file)} ${s.width}w`).join(', '), width: biggest.width, height: biggest.height, og: entry.og };
}

/** The preview picture of the page "Games" (docs/images/games/games.jpg): a path inside public/, or undefined. */
export function gamesCollagePath(cwd = process.cwd()): string | undefined {
  const og = read(cwd).games?.og;
  return og && existsSync(join(cwd, 'public', og)) ? og : undefined;
}

/** The size of a preview picture of the games (for og:image:width, height and type). */
export const GAME_OG = { width: 1200, height: 630, type: 'image/jpeg' } as const;
