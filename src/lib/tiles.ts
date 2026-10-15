// Map tile source and its attribution, from the environment (TILE_URL, TILE_ATTRIBUTION).
// The default is the public OpenStreetMap server: fine for development, not meant for steady public traffic
// (open question in docs/STATE.md: a provider or own tiles are needed before a public launch).

export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

export interface TileConfig {
  url: string;
  /** HTML (links allowed). Comes from the build environment, never from visitors. */
  attribution: string;
  /** True when the defaults (public OpenStreetMap server) are used. */
  isDefault: boolean;
}

/** Reads TILE_URL and TILE_ATTRIBUTION. Empty values mean "use the default"; a URL without {z}, {x}, {y} fails the build. */
export function tileConfig(env: Record<string, string | undefined>): TileConfig {
  const url = (env.TILE_URL ?? '').trim();
  const attribution = (env.TILE_ATTRIBUTION ?? '').trim();
  if (url) {
    if (!/^https:\/\//.test(url)) throw new Error(`TILE_URL must start with https:// (got "${url}")`);
    for (const part of ['{z}', '{x}', '{y}']) {
      if (!url.includes(part)) throw new Error(`TILE_URL must contain ${part} (got "${url}")`);
    }
    if (!attribution) throw new Error('TILE_ATTRIBUTION is required when TILE_URL is set: every tile provider needs attribution');
  }
  return {
    url: url || DEFAULT_TILE_URL,
    attribution: url ? attribution : attribution || DEFAULT_TILE_ATTRIBUTION,
    isDefault: !url,
  };
}
