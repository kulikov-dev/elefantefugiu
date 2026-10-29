import { describe, expect, it } from 'vitest';
import { thenNowNoteKinds, thenNowRatio, thenNowText, tieNumbers } from '../../src/lib/then-now';

describe('thenNowRatio', () => {
  it('is a whole number under 100 and rounds to tens from 100', () => {
    expect(thenNowRatio(40, 100 / 60)).toBe(24);
    expect(thenNowRatio(168, 2 + 44 / 60)).toBe(61);
    expect(thenNowRatio(79 * 24, 9.6)).toBe(200);
    expect(thenNowRatio(336, 3.5)).toBe(96);
    expect(thenNowRatio(1000, 3)).toBe(330);
  });
  it('never says "0 times"', () => {
    expect(thenNowRatio(1, 5)).toBe(1);
    expect(thenNowRatio(1, 0)).toBe(1);
  });
});

describe('thenNowText', () => {
  const card = { text: { pt: 'cerca de {n} vezes', en: 'about {n} times', ru: 'около {n} раз' }, then_hours: 40, now_hours: 5 / 3 };
  it('puts the number in every language', () => {
    expect(thenNowText(card, 'pt')).toBe('cerca de 24 vezes');
    expect(thenNowText(card, 'en')).toBe('about 24 times');
    expect(thenNowText(card, 'ru')).toBe('около 24 раз');
  });
  it('writes a big number with the separator of its language', () => {
    const big = { text: { pt: '{n}', en: '{n}', ru: '{n}' }, then_hours: 20000, now_hours: 2 };
    expect(thenNowText(big, 'en')).toBe('10,000');
    expect(thenNowText(big, 'pt')).toMatch(/^10\s000$|^10000$/);
  });
  it('leaves a text without {n} alone and refuses {n} without hours', () => {
    expect(thenNowText({ text: { pt: 'a', en: 'b', ru: 'c' } }, 'en')).toBe('b');
    expect(() => thenNowText({ text: { pt: '{n}', en: '{n}', ru: '{n}' } }, 'pt')).toThrow();
  });
});

describe('tieNumbers', () => {
  it('keeps a figure and its unit on one line', () => {
    expect(tieNumbers('1 h 40 min')).toBe('1 h 40 min');
    expect(tieNumbers('1 ч 40 мин')).toBe('1 ч 40 мин');
    expect(tieNumbers('20–30 anos')).toBe('20–30 anos');
  });
  it('leaves a phrase breakable', () => {
    expect(tieNumbers('100 milhões de chávenas por dia')).toBe('100 milhões de chávenas por dia');
    expect(tieNumbers('cerca de 61 milhões')).toBe('cerca de 61 milhões');
  });
});

describe('thenNowNoteKinds', () => {
  it('lists estimate and calc once, in a fixed order, and nothing for known', () => {
    expect(thenNowNoteKinds([{ kind: 'known' }, { kind: 'calc' }, { kind: 'estimate' }, { kind: 'calc' }])).toEqual(['estimate', 'calc']);
    expect(thenNowNoteKinds([{ kind: 'known' }])).toEqual([]);
  });
});
