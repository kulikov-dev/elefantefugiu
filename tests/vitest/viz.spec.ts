import { describe, expect, it } from 'vitest';
import { DOT_CELL, DOT_COLUMNS, dotCounts, fill, formatNumber, groupRatio, layoutDots, ratioNumber, roundRatio, shipRatio, shipShapes, silhouette, SHIP_WIDTH } from '../../src/lib/viz';

const a = { id: 'a', min: 1000, max: 1500, unit_per_dot: 100 };
const b = { id: 'b', min: 5000, max: 7000, unit_per_dot: 100 };

describe('dot counts', () => {
  it('without `solid` fills every dot up to the lowest estimate; the highest estimate is never drawn', () => {
    expect(dotCounts(a)).toEqual({ solid: 10, range: 0, total: 10 });
    expect(dotCounts(b)).toEqual({ solid: 50, range: 0, total: 50 });
  });
  it('fills up to `solid` and outlines the rest up to the lowest estimate', () => {
    expect(dotCounts({ ...b, solid: 1000 })).toEqual({ solid: 10, range: 40, total: 50 });
  });
  it('always draws at least one dot and never more filled dots than the total', () => {
    expect(dotCounts({ id: 'x', min: 0, max: 10, unit_per_dot: 100 })).toEqual({ solid: 0, range: 1, total: 1 });
    expect(dotCounts({ id: 'x', solid: 900, min: 100, max: 100, unit_per_dot: 100 }).solid).toBeLessThanOrEqual(1);
  });
});

describe('dot layout', () => {
  const layout = layoutDots({ ...b, solid: 1000 });
  it('draws every dot of the group, filled first, then outlined', () => {
    expect(layout.dots).toHaveLength(50);
    expect(layout.dots.filter((d) => d.kind === 'solid')).toHaveLength(10);
    expect(layout.dots.slice(0, 10).every((d) => d.kind === 'solid')).toBe(true);
  });
  it('keeps dots inside the viewBox and on separate cells; every group has the same width (one scale)', () => {
    for (const d of layout.dots) {
      expect(d.x).toBeGreaterThan(0);
      expect(d.x).toBeLessThan(layout.width);
      expect(d.y).toBeGreaterThan(0);
      expect(d.y).toBeLessThan(layout.height);
    }
    expect(new Set(layout.dots.map((d) => `${d.x},${d.y}`)).size).toBe(layout.dots.length);
    expect(layout.width).toBe(DOT_COLUMNS * DOT_CELL);
    expect(layoutDots(a).width).toBe(layout.width);
    expect(layout.height).toBe(Math.ceil(50 / DOT_COLUMNS) * DOT_CELL);
  });
  it('compares groups by the middle of the estimates', () => {
    const { big, small, ratio } = groupRatio([a, b]);
    expect([big.id, small.id]).toEqual(['b', 'a']);
    expect(ratio).toBeCloseTo(6000 / 1250, 5);
  });
});

describe('ratio for the sentence', () => {
  it('is a whole number up to 10, and above 10 is rounded down to a multiple of 5', () => {
    expect(roundRatio(1.2)).toBe(1);
    expect(roundRatio(5.36)).toBe(5);
    expect(roundRatio(9.6)).toBe(10);
    expect(roundRatio(10.4)).toBe(10);
    expect(roundRatio(14.9)).toBe(10);
    expect(roundRatio(22.7)).toBe(20);
    expect(roundRatio(25)).toBe(25);
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
    // Portuguese and Russian group with a no-break space, also four-digit numbers: the number never breaks across lines.
    expect(formatNumber(5000, 'pt')).toBe('5\u00a0000');
    expect(formatNumber(1000, 'ru')).toBe('1\u00a0000');
    expect(formatNumber(44000, 'pt')).toBe('44\u00a0000');
  });
  it('rounds a ratio for a sentence', () => {
    expect(ratioNumber(4.8, 'en')).toBe('4.8');
    expect(ratioNumber(12.4, 'en')).toBe('12');
  });
});

describe('plural forms in the dots interactive', () => {
  it('one person, many people, and the Russian forms; the number keeps its separators', async () => {
    const { plural } = await import('../../src/i18n');
    expect(plural('en', 'viz.army_scale', 1, '1')).toBe('One dot ≈ 1 person.');
    expect(plural('en', 'viz.army_scale', 1000, '1,000')).toBe('One dot ≈ 1,000 people.');
    expect(plural('pt', 'viz.army_scale', 1000, '1\u00a0000')).toBe('Um ponto ≈ 1\u00a0000 pessoas.');
    expect(plural('ru', 'viz.army_scale', 1000, '1\u00a0000')).toBe('Одна точка ≈ 1\u00a0000 человек.');
    expect(plural('ru', 'viz.army_scale', 3, '3')).toBe('Одна точка ≈ 3 человека.');
    expect(plural('ru', 'viz.army_ratio', 5, '5')).toBe('{who} было примерно в 5 раз больше.');
    expect(plural('ru', 'viz.army_ratio', 2, '2')).toBe('{who} было примерно в 2 раза больше.');
    expect(plural('pt', 'viz.army_ratio', 20, '20')).toBe('Havia cerca de 20 vezes mais {who}.');
    expect(plural('en', 'viz.army_ratio', 20, '20')).toBe('There were about 20 times as many {who}.');
  });
});
