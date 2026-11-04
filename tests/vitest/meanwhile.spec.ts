import { describe, expect, it } from 'vitest';
import {
  MEANWHILE_MAX_ITEMS,
  meanwhileFor,
  meanwhileLabel,
  meanwhileProblems,
  storyStartYear,
  yearDelta,
  type MeanwhileItemLike,
} from '../../src/lib/meanwhile';

describe('meanwhileLabel', () => {
  const cases: Record<'pt' | 'en' | 'ru', Record<number, string>> = {
    pt: {
      0: 'No mesmo ano',
      [-1]: '1 ano antes', [1]: '1 ano depois',
      [-2]: '2 anos antes', [2]: '2 anos depois',
      [-5]: '5 anos antes', [5]: '5 anos depois',
      [-11]: '11 anos antes', [11]: '11 anos depois',
      [-15]: '15 anos antes', [15]: '15 anos depois',
    },
    en: {
      0: 'That same year',
      [-1]: '1 year earlier', [1]: '1 year later',
      [-2]: '2 years earlier', [2]: '2 years later',
      [-5]: '5 years earlier', [5]: '5 years later',
      [-11]: '11 years earlier', [11]: '11 years later',
      [-15]: '15 years earlier', [15]: '15 years later',
    },
    ru: {
      0: 'В том же году',
      [-1]: 'За год до этого', [1]: 'Через год',
      [-2]: 'За 2 года до этого', [2]: 'Через 2 года',
      [-5]: 'За 5 лет до этого', [5]: 'Через 5 лет',
      [-11]: 'За 11 лет до этого', [11]: 'Через 11 лет',
      [-15]: 'За 15 лет до этого', [15]: 'Через 15 лет',
    },
  };
  for (const lang of ['pt', 'en', 'ru'] as const) {
    it(`writes the caption in ${lang}`, () => {
      for (const [delta, text] of Object.entries(cases[lang])) expect(meanwhileLabel(lang, Number(delta))).toBe(text);
    });
  }
});

describe('yearDelta', () => {
  it('counts plain years', () => {
    expect(yearDelta(1896, 1890)).toBe(6);
    expect(yearDelta(1580, 1581)).toBe(-1);
  });
  it('has no year 0: 9 BC to 1 AD is 9 years, 1 BC to 1 AD is 1', () => {
    expect(yearDelta(-9, 1)).toBe(-9);
    expect(yearDelta(-1, 1)).toBe(-1);
    expect(yearDelta(1, -9)).toBe(9);
  });
  it('counts years before the common era', () => {
    expect(yearDelta(-138, -139)).toBe(1);
    expect(yearDelta(-387, -400)).toBe(13);
  });
});

describe('storyStartYear', () => {
  it('is the year of a single year and the first year of a period', () => {
    expect(storyStartYear(1755)).toBe(1755);
    expect(storyStartYear({ from: 1717, to: 1730 })).toBe(1717);
    expect(storyStartYear({ from: -400, to: -1 })).toBe(-400);
  });
});

const world = (over: Partial<MeanwhileItemLike> = {}): MeanwhileItemLike => ({
  scope: 'world',
  year: 1755,
  text: { pt: 'Texto.', en: 'Text.', ru: 'Текст.' },
  source: 'https://example.org/a',
  ...over,
});
const local = (scope: 'ru' | 'en' | 'pt', over: Partial<MeanwhileItemLike> = {}): MeanwhileItemLike => ({
  scope,
  year: 1755,
  text: { [scope]: 'Text.' },
  source: 'https://example.org/b',
  ...over,
});
const errors = (items: MeanwhileItemLike[], year = 1755) => meanwhileProblems(items, year).filter((p) => p.level === 'error').map((p) => p.message);
const warnings = (items: MeanwhileItemLike[], year = 1755) => meanwhileProblems(items, year).filter((p) => p.level === 'warn').map((p) => p.message);

describe('meanwhileProblems (the rules of check:data)', () => {
  it('accepts a world line and a line of one language', () => {
    expect(meanwhileProblems([world(), local('ru')], 1755)).toEqual([]);
  });
  it('needs a world line in all three languages', () => {
    expect(errors([world({ text: { pt: 'a', en: 'b' } })])).toEqual(['a world line needs the text in ru']);
  });
  it('wants a local line in its own language only', () => {
    expect(errors([local('en', { text: { en: 'a', pt: 'b' } })])).toHaveLength(1);
    expect(errors([local('en', { text: { pt: 'b' } })])).toHaveLength(1);
    expect(errors([local('pt', { text: {} })])).toHaveLength(1);
  });
  it('allows a distance of 15 years either way and no more', () => {
    expect(errors([world({ year: 1770 })])).toEqual([]);
    expect(errors([world({ year: 1740 })])).toEqual([]);
    expect(errors([world({ year: 1771 })])).toHaveLength(1);
    expect(errors([world({ year: 1739 })])).toHaveLength(1);
  });
  it('counts from the first year of a period', () => {
    const period = storyStartYear({ from: 1717, to: 1830 });
    expect(errors([world({ year: 1732 })], period)).toEqual([]);
    expect(errors([world({ year: 1733 })], period)).toHaveLength(1);
    expect(errors([world({ year: 1800 })], period)).toHaveLength(1); // inside the period, but far from its first year
  });
  it('accepts years before the common era, and not the year 0 or a fraction', () => {
    expect(errors([world({ year: -138 })], -139)).toEqual([]);
    expect(errors([world({ year: 0 })], 1)).toHaveLength(1);
    expect(errors([world({ year: 1755.5 })])).toHaveLength(1);
  });
  it('wants an http(s) address as the source', () => {
    expect(errors([world({ source: 'https://example.org/x' })])).toEqual([]);
    expect(errors([world({ source: 'http://example.org/x' })])).toEqual([]);
    expect(errors([world({ source: 'example.org' })])).toHaveLength(1);
    expect(errors([world({ source: 'ftp://example.org' })])).toHaveLength(1);
    expect(errors([world({ source: '' })])).toHaveLength(1);
  });
  it('allows one line of each scope', () => {
    expect(errors([world(), world()])).toEqual(['more than one line with the scope "world"']);
    expect(errors([local('pt'), local('pt')])).toHaveLength(1);
    const all = [local('ru'), local('en'), local('pt'), world()];
    expect(all).toHaveLength(MEANWHILE_MAX_ITEMS);
    expect(errors(all)).toEqual([]);
  });
  it('warns (does not fail) about more than 15 words and exclamation marks', () => {
    const long = Array.from({ length: 16 }, (_, i) => `w${i}`).join(' ');
    const ok = Array.from({ length: 15 }, (_, i) => `w${i}`).join(' ');
    expect(warnings([local('en', { text: { en: ok } })])).toEqual([]);
    expect(warnings([local('en', { text: { en: long } })])).toHaveLength(1);
    expect(errors([local('en', { text: { en: long } })])).toEqual([]);
    expect(warnings([world({ text: { pt: 'Sim!', en: 'Yes', ru: 'Да' } })])).toHaveLength(1);
  });
});

describe('meanwhileFor', () => {
  const items = [world({ year: 1750 }), local('ru', { year: 1760 }), local('pt', { year: 1740 })];
  it('puts the line of the page language first, then the world', () => {
    expect(meanwhileFor(items, 'ru').map((l) => l.scope)).toEqual(['ru', 'world']);
    expect(meanwhileFor(items, 'pt').map((l) => l.scope)).toEqual(['pt', 'world']);
  });
  it('leaves out a local line of another language', () => {
    expect(meanwhileFor(items, 'en').map((l) => l.scope)).toEqual(['world']);
  });
  it('takes the text of the page language', () => {
    expect(meanwhileFor([world()], 'ru')[0]?.text).toBe('Текст.');
    expect(meanwhileFor([world()], 'pt')[0]?.text).toBe('Texto.');
  });
  it('is empty for a story without lines', () => {
    expect(meanwhileFor(undefined, 'en')).toEqual([]);
    expect(meanwhileFor([], 'en')).toEqual([]);
  });
});
