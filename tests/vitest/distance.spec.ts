import { describe, expect, it } from 'vitest';
import { distanceParts } from '../../src/lib/distance';

describe('distanceParts', () => {
  it('under 50 m is "here"', () => {
    expect(distanceParts(0)).toEqual({ kind: 'here' });
    expect(distanceParts(0.049)).toEqual({ kind: 'here' });
  });
  it('metres to 10 m under a kilometre: 350 m, 800 m', () => {
    expect(distanceParts(0.05)).toEqual({ kind: 'm', n: 50 });
    expect(distanceParts(0.347)).toEqual({ kind: 'm', n: 350 });
    expect(distanceParts(0.8)).toEqual({ kind: 'm', n: 800 });
    expect(distanceParts(0.9951)).toEqual({ kind: 'm', n: 1000 });
  });
  it('kilometres with one decimal, whole from 100 km', () => {
    expect(distanceParts(1)).toEqual({ kind: 'km', n: 1 });
    expect(distanceParts(2.13)).toEqual({ kind: 'km', n: 2.1 });
    expect(distanceParts(99.94)).toEqual({ kind: 'km', n: 99.9 });
    expect(distanceParts(214.6)).toEqual({ kind: 'km', n: 215 });
  });
});
