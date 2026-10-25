import { describe, expect, it } from 'vitest';
import { MINIMAP_COLS, MINIMAP_ROWS, MINIMAP_ZOOM, TILE_PX, minimapLayout, tileUrl, tileXY } from '../../src/lib/minimap';

const TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

describe('mini-map tiles', () => {
  it('tileXY: the well-known tile of Lisbon at zoom 14 (7776, 6277)', () => {
    const { x, y } = tileXY(38.7223, -9.1393, 14);
    expect(Math.floor(x)).toBe(7776);
    expect(Math.floor(y)).toBe(6277);
  });
  it('tileXY: the origin and the date line edge', () => {
    expect(tileXY(0, -180, 1)).toEqual({ x: 0, y: 1 });
    expect(tileXY(0, 0, 1).x).toBeCloseTo(1);
  });
  it('tileUrl fills {z}/{x}/{y} and tolerates {s} and {r}', () => {
    expect(tileUrl(TEMPLATE, 14, 7776, 6277)).toBe('https://tile.openstreetmap.org/14/7776/6277.png');
    expect(tileUrl('https://{s}.example/{z}/{x}/{y}{r}.png', 3, 1, 2)).toBe('https://a.example/3/1/2.png');
  });
  it('is a street-level map (zoom 15) whose tiles keep their size', () => {
    expect(MINIMAP_ZOOM).toBe(15);
    expect(TILE_PX).toBe(256);
  });
  it('minimapLayout: a grid of distinct tiles, the one with the point and its neighbours, placed in pixels from the point', () => {
    const tiles = minimapLayout(38.7223, -9.1393, TEMPLATE);
    expect(tiles).toHaveLength((2 * MINIMAP_COLS + 1) * (2 * MINIMAP_ROWS + 1));
    expect(new Set(tiles.map((t) => t.url)).size).toBe(tiles.length);
    const { x, y } = tileXY(38.7223, -9.1393, MINIMAP_ZOOM);
    const own = tiles.find((t) => t.url === `https://tile.openstreetmap.org/15/${Math.floor(x)}/${Math.floor(y)}.png`)!;
    // The corner of the tile with the point lies up and to the left of the point by the fraction of the tile, in pixels.
    expect(own.dx).toBe(Math.round(-(x - Math.floor(x)) * TILE_PX));
    expect(own.dy).toBe(Math.round(-(y - Math.floor(y)) * TILE_PX));
    expect(own.far).toBe(false);
  });
  it('the grid reaches at least a tile beyond the point on every side, the outer columns are marked far', () => {
    const tiles = minimapLayout(38.7223, -9.1393, TEMPLATE);
    expect(Math.min(...tiles.map((t) => t.dx))).toBeLessThanOrEqual(-TILE_PX * MINIMAP_COLS);
    expect(Math.max(...tiles.map((t) => t.dx)) + TILE_PX).toBeGreaterThanOrEqual(TILE_PX * MINIMAP_COLS);
    expect(tiles.filter((t) => t.far)).toHaveLength(2 * (2 * MINIMAP_ROWS + 1));
  });
  it('minimapLayout wraps tiles over the date line and drops rows beyond the poles', () => {
    const wrap = minimapLayout(0, 179.99, TEMPLATE, 2);
    expect(wrap.every((t) => /\/2\/[0-3]\/[0-3]\.png$/.test(t.url))).toBe(true);
    expect(minimapLayout(85, 0, TEMPLATE, 2).length).toBeLessThan(15);
  });
});
