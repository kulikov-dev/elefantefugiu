import { describe, expect, it } from 'vitest';
import {
  MEANWHILE_MAX_ITEMS,
  meanwhileFor,
  meanwhileProblems,
  meanwhileYearText,
  storyStartYear,
  yearDelta,
  type MeanwhileItemLike,
} from '../../src/lib/meanwhile';

describe('meanwhileYearText', () => {
  it('writes the year of the event, with the era before the common era and in the first centuries', () => {
    expect(meanwhileYearText('ru', 1755)).toBe('1755');
    expect(meanwhileYearText('ru', -9)).toBe('9 до н. э.');
    expect(meanwhileYearText('pt', -9)).toBe('9 a.C.');
    expect(meanwhileYearText('en', -9)).toBe('9 BC');
    expect(meanwhileYearText('ru', 8)).toBe('8 н. э.');
    expect(meanwhileYearText('pt', 8)).toBe('8 d.C.');
    expect(meanwhileYearText('en', 8)).toBe('AD 8');
  });
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
  it('gives one line: the page language, else the world', () => {
    expect(meanwhileFor(items, 'ru').map((l) => l.scope)).toEqual(['ru']);
    expect(meanwhileFor(items, 'pt').map((l) => l.scope)).toEqual(['pt']);
    expect(meanwhileFor(items, 'en').map((l) => l.scope)).toEqual(['world']);
  });
  it('leaves out a local line of another language', () => {
    expect(meanwhileFor([local('ru')], 'en')).toEqual([]);
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
