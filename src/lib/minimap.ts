// The mini-map of a card page: a few map tiles laid side by side as ordinary pictures, with the point of the story in the
// middle. No Leaflet and no script: it works without JavaScript. Pure functions, no Astro imports.
//
// The tiles keep their own size (one tile pixel is one screen pixel, so nothing is blown up and blurred) and are placed in pixels from
// the middle of the frame, where the point is. The frame is as wide as its block, so the grid must reach 2 tiles to each side; the two
// outer columns carry `far`, and the page hides them on a narrow frame (a hidden lazy picture is never fetched).

/** Detail of the map: a street level, where a visitor can find the place. */
export const MINIMAP_ZOOM = 15;
/** Size of a tile in pixels (every OpenStreetMap-style server). */
export const TILE_PX = 256;
/** Tiles to each side of the tile with the point: columns (the outer ring is `far`) and rows. */
export const MINIMAP_COLS = 2;
export const MINIMAP_ROWS = 1;

/** Fractional tile coordinates of a point (Web Mercator, the scheme of every OpenStreetMap-style tile server). */
export function tileXY(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n };
}

/** A tile address from a template with {z}, {x}, {y} and, if present, {s} (one subdomain) and {r} (nothing). */
export function tileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)).replace('{s}', 'a').replace('{r}', '');
}

export interface MiniMapTile {
  url: string;
  /** Offset in pixels of the tile's top left corner from the point (the middle of the frame). */
  dx: number;
  dy: number;
  /** In the outer columns: only a wide frame needs it. */
  far: boolean;
}

/** The tiles around a point, each with its pixel offset from the point. */
export function minimapLayout(lat: number, lon: number, template: string, zoom = MINIMAP_ZOOM): MiniMapTile[] {
  const { x, y } = tileXY(lat, lon, zoom);
  const limit = 2 ** zoom;
  const tiles: MiniMapTile[] = [];
  for (let dr = -MINIMAP_ROWS; dr <= MINIMAP_ROWS; dr++) {
    for (let dc = -MINIMAP_COLS; dc <= MINIMAP_COLS; dc++) {
      const tx = Math.floor(x) + dc;
      const ty = Math.floor(y) + dr;
      if (ty < 0 || ty >= limit) continue; // beyond the poles: no tile
      tiles.push({
        url: tileUrl(template, zoom, ((tx % limit) + limit) % limit, ty),
        dx: Math.round((tx - x) * TILE_PX),
        dy: Math.round((ty - y) * TILE_PX),
        far: Math.abs(dc) === MINIMAP_COLS,
      });
    }
  }
  return tiles;
}
