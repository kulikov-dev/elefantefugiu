import { describe, expect, it } from 'vitest';
import { N, anchor, cake, draw, freshState, randomItems, readState, shift, whatIn } from '../../src/lib/bolo-rei.mjs';

/** A random() that gives the numbers in turn. */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length]!;
};
const slices = (svg: string) => (svg.match(/class="slice/g) ?? []).length;

describe('the bolo-rei (src/lib/bolo-rei.mjs)', () => {
  it('the whole cake has every slice, a cut cake has the rest and the one slid out', () => {
    expect(slices(cake())).toBe(N);
    expect(slices(draw({ gone: [0, 1] }))).toBe(N - 2);
    expect(slices(draw({ gone: [0], out: 3 }))).toBe(N - 1);
    expect(draw({ gone: [0], out: 3 })).toContain('slice cut');
    expect(slices(draw({ gone: Array.from({ length: N }, (_, i) => i) }))).toBe(0);
  });

  it('the slice slides to the place the page computes, and "slid" puts it there from the start', () => {
    const [dx, dy] = shift(2);
    expect(draw({ out: 2, slid: true })).toContain(`translate(${Math.round(dx * 10) / 10}px,${Math.round(dy * 10) / 10}px)`);
    expect(draw({ out: 2 })).toContain('translate(0px,0px)');
  });

  it('draws with tokens only, no colour written in', () => {
    expect(cake()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(cake()).toContain('var(--festa-cherry)');
  });

  it('the anchor of the bubble lies inside the drawing', () => {
    for (let i = 0; i < N; i++) {
      const [x, y] = anchor(i);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(400);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(240);
    }
  });

  it('the bean and the gift never lie in the same slice, whatever the random numbers are', () => {
    for (let k = 0; k < 200; k++) {
      const { fava, brinde } = randomItems();
      expect(fava).not.toBe(brinde);
      expect(fava).toBeGreaterThanOrEqual(0);
      expect(brinde).toBeLessThan(N);
    }
    expect(randomItems(seq(0, 0))).toEqual({ fava: 0, brinde: 1 });
    expect(randomItems(seq(0.999, 0.999))).toEqual({ fava: 7, brinde: 6 });
  });

  it('whatIn tells the bean, the gift and the fruit', () => {
    const state = { year: 2026, cut: 0, fava: 2, brinde: 5 };
    expect([0, 2, 5].map((i) => whatIn(state, i))).toEqual(['fruit', 'fava', 'brinde']);
  });

  it('readState keeps the stored cake of this year and starts a new one for anything else', () => {
    const stored = JSON.stringify({ year: 2026, cut: 3, fava: 1, brinde: 6 });
    expect(readState(stored, 2026)).toEqual({ year: 2026, cut: 3, fava: 1, brinde: 6 });
    expect(readState(stored, 2027).cut).toBe(0);
    expect(readState(stored, 2027).year).toBe(2027);
    for (const bad of [null, undefined, '', 'nope', '{}', JSON.stringify({ year: 2026, cut: 9, fava: 1, brinde: 2 }), JSON.stringify({ year: 2026, cut: 1, fava: 4, brinde: 4 }), JSON.stringify({ year: 2026, cut: 1, fava: 8, brinde: 2 })]) {
      expect(readState(bad, 2026, seq(0.1, 0.1))).toEqual(freshState(2026, seq(0.1, 0.1)));
    }
  });
});
