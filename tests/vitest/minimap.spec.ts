import { describe, expect, it } from 'vitest';
import { MINIMAP_ASPECT, MINIMAP_GRID, minimapLayout, tileUrl, tileXY } from '../../src/lib/minimap';

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
  it('minimapLayout: a 3 x 3 grid of distinct tiles around the point, the point in the middle of the frame', () => {
    const layout = minimapLayout(38.7223, -9.1393, TEMPLATE);
    expect(layout.tiles).toHaveLength(MINIMAP_GRID * MINIMAP_GRID);
    expect(new Set(layout.tiles.map((t) => t.url)).size).toBe(9);
    const centre = layout.tiles.find((t) => t.col === 1 && t.row === 1)!;
    const { x, y } = tileXY(38.7223, -9.1393, 14);
    expect(centre.url).toBe(`https://tile.openstreetmap.org/14/${Math.floor(x)}/${Math.floor(y)}.png`);
    // The point is at 50 % of the frame: grid position + its place in the grid (in frame units) = 50.
    const fx = (x - (Math.floor(x) - 1)) / MINIMAP_GRID;
    const fy = (y - (Math.floor(y) - 1)) / MINIMAP_GRID;
    expect(layout.inner.leftPct + fx * layout.inner.widthPct).toBeCloseTo(50);
    expect(layout.inner.topPct + fy * layout.inner.widthPct * MINIMAP_ASPECT).toBeCloseTo(50);
  });
  it('minimapLayout wraps tiles over the date line and drops rows beyond the poles', () => {
    const wrap = minimapLayout(0, 179.99, TEMPLATE, 2);
    expect(wrap.tiles.every((t) => /\/2\/[0-3]\/[0-3]\.png$/.test(t.url))).toBe(true);
    expect(minimapLayout(85, 0, TEMPLATE, 2).tiles.length).toBeLessThan(9);
  });
});
