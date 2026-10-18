import { describe, expect, it } from 'vitest';
import { DOT_CELL, DOT_COLUMNS, DOT_LABEL_ROW, dotCounts, fill, formatNumber, groupRatio, layoutDots, ratioNumber, shipRatio, shipShapes, silhouette, SHIP_WIDTH } from '../../src/lib/viz';

const a = { id: 'a', min: 1000, max: 1500, unit_per_dot: 100 };
const b = { id: 'b', min: 5000, max: 7000, unit_per_dot: 100 };

describe('dot counts', () => {
  it('fills up to the low estimate and leaves the rest of the range empty', () => {
    expect(dotCounts(a)).toEqual({ solid: 10, range: 5, total: 15 });
    expect(dotCounts(b)).toEqual({ solid: 50, range: 20, total: 70 });
  });
  it('always draws at least one dot and never more solid dots than the total', () => {
    expect(dotCounts({ id: 'x', min: 0, max: 10, unit_per_dot: 100 })).toEqual({ solid: 0, range: 1, total: 1 });
    expect(dotCounts({ id: 'x', min: 900, max: 100, unit_per_dot: 100 }).solid).toBeLessThanOrEqual(1);
  });
});

describe('dot layout', () => {
  const layout = layoutDots([a, b]);
  it('draws every dot of every group, in order, one scale', () => {
    expect(layout.groups.map((g) => g.dots.length)).toEqual([15, 70]);
    expect(layout.groups[0]!.dots.filter((d) => d.kind === 'solid')).toHaveLength(10);
  });
  it('keeps dots inside the viewBox and on separate cells', () => {
    const all = layout.groups.flatMap((g) => g.dots);
    for (const d of all) {
      expect(d.x).toBeGreaterThan(0);
      expect(d.x).toBeLessThan(layout.width);
      expect(d.y).toBeGreaterThan(0);
      expect(d.y).toBeLessThan(layout.height);
    }
    expect(new Set(all.map((d) => `${d.x},${d.y}`)).size).toBe(all.length);
    expect(layout.width).toBe(DOT_COLUMNS * DOT_CELL);
  });
  it('leaves an empty row and a row for the name between groups, and the name sits above its own dots', () => {
    const lastOfA = Math.max(...layout.groups[0]!.dots.map((d) => d.y));
    const firstOfB = Math.min(...layout.groups[1]!.dots.map((d) => d.y));
    expect(firstOfB - lastOfA).toBe(2 * DOT_CELL + DOT_LABEL_ROW);
    for (const g of layout.groups) expect(g.labelY).toBeLessThan(Math.min(...g.dots.map((d) => d.y)));
    expect(layout.groups[0]!.labelY).toBeGreaterThan(0);
  });
  it('compares groups by the middle of the estimates', () => {
    const { big, small, ratio } = groupRatio([a, b]);
    expect([big.id, small.id]).toEqual(['b', 'a']);
    expect(ratio).toBeCloseTo(6000 / 1250, 5);
  });
});

describe('ships', () => {
  const items = [{ id: 'old', length_m: 25, height_m: 20 }, { id: 'new', length_m: 200 }];
  const { ships, scale } = shipShapes(items);
  it('uses one scale: lengths on the drawing keep the ratio of metres', () => {
    expect(ships[1]!.length / ships[0]!.length).toBeCloseTo(8, 5);
    expect(ships[0]!.length / 25).toBeCloseTo(scale, 5);
    expect(ships[1]!.length).toBeLessThanOrEqual(SHIP_WIDTH);
  });
  it('takes the height from the data, else a share of the length', () => {
    expect(ships[0]!.height).toBeCloseTo(20 * scale, 5);
    expect(ships[1]!.height).toBeCloseTo(200 * 0.3 * scale, 5);
  });
  it('draws closed paths', () => {
    const s = silhouette(100, 40);
    expect(s.hull.startsWith('M')).toBe(true);
    expect(s.hull.endsWith('Z')).toBe(true);
    expect(s.sail.endsWith('Z')).toBe(true);
  });
  it('finds the longest and the shortest', () => {
    const { big, small, ratio } = shipRatio(items);
    expect([big.id, small.id, ratio]).toEqual(['new', 'old', 8]);
  });
});

describe('wording helpers', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(fill('{a} and {b} and {c}', { a: 1, b: 'x' })).toBe('1 and x and {c}');
  });
  it('formats numbers by language', () => {
    expect(formatNumber(5000, 'en')).toBe('5,000');
    expect(formatNumber(5000, 'pt').replace(/\s/g, ' ')).toMatch(/^5.000$/);
  });
  it('rounds a ratio for a sentence', () => {
    expect(ratioNumber(4.8, 'en')).toBe('4.8');
    expect(ratioNumber(12.4, 'en')).toBe('12');
  });
});
