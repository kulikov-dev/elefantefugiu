// The mini-map on a card page: a few map tiles laid side by side as ordinary pictures, with the point of the story in the
// middle. No Leaflet and no script: it works without JavaScript and costs nothing on a phone, where it is not shown.
// Pure functions, no Astro imports.

export const MINIMAP_ZOOM = 14;
/** Tiles per side of the grid that is laid out (3 x 3), of which the frame shows about 1.5 x 1.1. */
export const MINIMAP_GRID = 3;
/** Width / height of the frame. */
export const MINIMAP_ASPECT = 4 / 3;

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

export interface MiniMapLayout {
  tiles: { url: string; col: number; row: number }[];
  /** Position of the laid-out grid in the frame, in percent of the frame, so that the point sits in the middle. */
  inner: { widthPct: number; leftPct: number; topPct: number };
}

/**
 * Lays out MINIMAP_GRID x MINIMAP_GRID tiles around a point. The grid is 200 % of the frame wide (the frame shows 1.5 tiles
 * across); the percentages place it so that the point is at 50 % / 50 % of the frame.
 */
export function minimapLayout(lat: number, lon: number, template: string, zoom = MINIMAP_ZOOM): MiniMapLayout {
  const { x, y } = tileXY(lat, lon, zoom);
  const x0 = Math.floor(x) - 1;
  const y0 = Math.floor(y) - 1;
  const limit = 2 ** zoom;
  const tiles: MiniMapLayout['tiles'] = [];
  for (let row = 0; row < MINIMAP_GRID; row++) {
    for (let col = 0; col < MINIMAP_GRID; col++) {
      const tx = x0 + col;
      const ty = y0 + row;
      if (ty < 0 || ty >= limit) continue; // beyond the poles: no tile
      tiles.push({ url: tileUrl(template, zoom, ((tx % limit) + limit) % limit, ty), col, row });
    }
  }
  const widthPct = 200;
  const heightPct = widthPct * MINIMAP_ASPECT; // the grid is square, so in frame heights it is this tall
  const fx = (x - x0) / MINIMAP_GRID; // 0..1 across the grid
  const fy = (y - y0) / MINIMAP_GRID;
  return { tiles, inner: { widthPct, leftPct: 50 - fx * widthPct, topPct: 50 - fy * heightPct } };
}
