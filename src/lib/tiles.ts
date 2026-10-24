// Map tile source and its attribution, from the environment (CARTO_KEY, TILE_URL, TILE_ATTRIBUTION).
// With CARTO_KEY the map uses the CARTO basemaps: Voyager in the light theme, Dark Matter in the dark one. TILE_URL (with its
// attribution) overrides that for another provider. With neither, the default is the public OpenStreetMap server: fine for
// development, not meant for steady public traffic.

export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_LINK = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
export const DEFAULT_TILE_ATTRIBUTION = `&copy; ${OSM_LINK} contributors`;

export const CARTO_LIGHT_URL = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
export const CARTO_DARK_URL = 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png';
export const CARTO_ATTRIBUTION = `&copy; ${OSM_LINK} contributors, &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>`;

export interface TileConfig {
  /** The tiles of the light theme (and of every theme when there is no `urlDark`). */
  url: string;
  /** The tiles of the dark theme, when the provider has a dark style. */
  urlDark?: string;
  /** HTML (links allowed). Comes from the build environment, never from visitors. */
  attribution: string;
  /** True when the defaults (public OpenStreetMap server) are used. */
  isDefault: boolean;
}

/**
 * Reads CARTO_KEY, TILE_URL and TILE_ATTRIBUTION. Empty values mean "not set"; a URL without {z}, {x}, {y} fails the build.
 * TILE_URL wins over CARTO_KEY, CARTO_KEY over the public OpenStreetMap server.
 */
export function tileConfig(env: Record<string, string | undefined>): TileConfig {
  const url = (env.TILE_URL ?? '').trim();
  const attribution = (env.TILE_ATTRIBUTION ?? '').trim();
  const key = (env.CARTO_KEY ?? '').trim();
  if (url) {
    if (!/^https:\/\//.test(url)) throw new Error(`TILE_URL must start with https:// (got "${url}")`);
    for (const part of ['{z}', '{x}', '{y}']) {
      if (!url.includes(part)) throw new Error(`TILE_URL must contain ${part} (got "${url}")`);
    }
    if (!attribution) throw new Error('TILE_ATTRIBUTION is required when TILE_URL is set: every tile provider needs attribution');
    return { url, attribution, isDefault: false };
  }
  if (key) {
    // The key goes into the address of every tile, so it may hold nothing that could change the address.
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error('CARTO_KEY may hold only letters, digits, "-" and "_"');
    return {
      url: `${CARTO_LIGHT_URL}?key=${key}`,
      urlDark: `${CARTO_DARK_URL}?key=${key}`,
      attribution: attribution || CARTO_ATTRIBUTION,
      isDefault: false,
    };
  }
  return { url: DEFAULT_TILE_URL, attribution: attribution || DEFAULT_TILE_ATTRIBUTION, isDefault: true };
}

/** Whether the page is in the dark theme: an explicit choice on <html data-theme>, else the device ("system" or no attribute). */
export const isDarkTheme = (attribute: string | null, systemDark: boolean): boolean =>
  attribute === 'dark' || (attribute !== 'light' && systemDark);

/** The tile address for the theme: the dark style when the provider has one. */
export const tileUrlFor = (tile: Pick<TileConfig, 'url' | 'urlDark'>, dark: boolean): string => (dark && tile.urlDark ? tile.urlDark : tile.url);
