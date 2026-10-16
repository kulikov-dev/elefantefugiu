import { describe, expect, it } from 'vitest';
import {
  countByMode,
  filterByFamily,
  gateReason,
  hiddenModes,
  isSurpriseAllowed,
  isVisibleInMode,
  normalizeFamilyMode,
  normalizeMinAge,
  normalizeSensitive,
  visibleModes,
  type AgeInfo,
} from '../../src/lib/family';

const card = (id: string, minAge: unknown, sensitive: unknown = false) => ({ id, minAge, sensitive }) satisfies AgeInfo & { id: string };

const ALL_AGES = card('a', 'all');
const TEEN = card('t', '12');
const OLDER = card('o', '16');
const HEAVY_ALL = card('ha', 'all', true);
const HEAVY_TEEN = card('ht', '12', true);
const HEAVY_OLDER = card('ho', '16', true);
const EVERY = [ALL_AGES, TEEN, OLDER, HEAVY_ALL, HEAVY_TEEN, HEAVY_OLDER];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe('mode "off"', () => {
  it('shows every card, heavy and 16+ included', () => {
    expect(ids(filterByFamily(EVERY, 'off'))).toEqual(['a', 't', 'o', 'ha', 'ht', 'ho']);
  });
});

describe('mode "all"', () => {
  it('shows only all-ages cards that are not heavy', () => {
    expect(ids(filterByFamily(EVERY, 'all'))).toEqual(['a']);
  });
  it('hides 12+ and 16+ cards', () => {
    expect(isVisibleInMode(TEEN, 'all')).toBe(false);
    expect(isVisibleInMode(OLDER, 'all')).toBe(false);
  });
});

describe('mode "12"', () => {
  it('shows all-ages and 12+ cards that are not heavy', () => {
    expect(ids(filterByFamily(EVERY, '12'))).toEqual(['a', 't']);
  });
  it('hides 16+ cards', () => {
    expect(isVisibleInMode(OLDER, '12')).toBe(false);
  });
});

describe('heavy topic', () => {
  it('is hidden in "all" and "12" whatever the age', () => {
    for (const heavy of [HEAVY_ALL, HEAVY_TEEN, HEAVY_OLDER]) {
      expect(isVisibleInMode(heavy, 'all')).toBe(false);
      expect(isVisibleInMode(heavy, '12')).toBe(false);
      expect(isVisibleInMode(heavy, 'off')).toBe(true);
    }
  });
});

describe('empty results and order', () => {
  it('returns an empty list for an empty input', () => {
    expect(filterByFamily([], 'all')).toEqual([]);
  });
  it('returns an empty list when nothing is shown in the mode', () => {
    expect(filterByFamily([TEEN, OLDER, HEAVY_ALL], 'all')).toEqual([]);
  });
  it('keeps the order and does not change the input', () => {
    const input = [OLDER, ALL_AGES, TEEN];
    const copy = [...input];
    expect(ids(filterByFamily(input, '12'))).toEqual(['a', 't']);
    expect(input).toEqual(copy);
  });
});

describe('normalisation', () => {
  it('accepts the age as a number, a string, with spaces, with a plus, in any case', () => {
    expect(normalizeMinAge(12)).toBe('12');
    expect(normalizeMinAge(' 12 ')).toBe('12');
    expect(normalizeMinAge('12+')).toBe('12');
    expect(normalizeMinAge('ALL')).toBe('all');
    expect(normalizeMinAge(16)).toBe('16');
  });
  it('treats an unknown age as the strictest one', () => {
    for (const bad of [undefined, null, '', 'kids', 18, NaN, {}]) expect(normalizeMinAge(bad)).toBe('16');
    expect(isVisibleInMode(card('x', 'kids'), '12')).toBe(false);
    expect(isVisibleInMode(card('x', undefined), 'all')).toBe(false);
  });
  it('reads the heavy-topic flag from a boolean or from a data attribute', () => {
    expect(normalizeSensitive(true)).toBe(true);
    expect(normalizeSensitive('true')).toBe(true);
    expect(normalizeSensitive(false)).toBe(false);
    expect(normalizeSensitive('false')).toBe(false);
    expect(normalizeSensitive('')).toBe(false);
    expect(normalizeSensitive(undefined)).toBe(false);
  });
  it('treats an unrecognised heavy-topic value as heavy', () => {
    expect(normalizeSensitive('maybe')).toBe(true);
    expect(isVisibleInMode(card('x', 'all', 'maybe'), 'all')).toBe(false);
  });
  it('turns a stored mode into a mode and falls back to "off"', () => {
    expect(normalizeFamilyMode('all')).toBe('all');
    expect(normalizeFamilyMode('12')).toBe('12');
    expect(normalizeFamilyMode(12)).toBe('12');
    expect(normalizeFamilyMode(' ALL ')).toBe('all');
    for (const bad of [null, undefined, '', 'off', 'kids', '16', 'true']) expect(normalizeFamilyMode(bad)).toBe('off');
  });
  it('filters string and number ages alike', () => {
    expect(ids(filterByFamily([card('n', 12), card('s', '12'), card('p', ' 12+ ')], '12'))).toEqual(['n', 's', 'p']);
    expect(ids(filterByFamily([card('n', 12), card('s', '12')], 'all'))).toEqual([]);
  });
});

describe('modes of one card', () => {
  it('lists where a card is shown and where it is hidden', () => {
    expect(visibleModes(ALL_AGES)).toEqual(['off', 'all', '12']);
    expect(hiddenModes(ALL_AGES)).toEqual([]);
    expect(visibleModes(TEEN)).toEqual(['off', '12']);
    expect(hiddenModes(TEEN)).toEqual(['all']);
    expect(visibleModes(HEAVY_TEEN)).toEqual(['off']);
    expect(hiddenModes(OLDER)).toEqual(['all', '12']);
  });
});

describe('counters', () => {
  it('gives the three numbers (off, all, 12)', () => {
    expect(countByMode(EVERY)).toEqual({ off: 6, all: 1, '12': 2 });
    expect(countByMode([])).toEqual({ off: 0, all: 0, '12': 0 });
  });
});

describe('"Surprise me"', () => {
  it('is never a heavy topic, in any mode', () => {
    for (const mode of ['off', 'all', '12'] as const) {
      for (const heavy of [HEAVY_ALL, HEAVY_TEEN, HEAVY_OLDER]) expect(isSurpriseAllowed(heavy, mode)).toBe(false);
    }
  });
  it('allows 12+ and 16+ cards in "off"', () => {
    expect(isSurpriseAllowed(TEEN, 'off')).toBe(true);
    expect(isSurpriseAllowed(OLDER, 'off')).toBe(true);
  });
  it('follows the visibility rules in "all" and "12"', () => {
    expect(isSurpriseAllowed(ALL_AGES, 'all')).toBe(true);
    expect(isSurpriseAllowed(TEEN, 'all')).toBe(false);
    expect(isSurpriseAllowed(TEEN, '12')).toBe(true);
    expect(isSurpriseAllowed(OLDER, '12')).toBe(false);
  });
});

describe('reason for the intermediate screen', () => {
  it('is empty when the card is shown', () => {
    expect(gateReason(ALL_AGES, 'all')).toEqual({ age: null, heavy: false });
    expect(gateReason(TEEN, 'off')).toEqual({ age: null, heavy: false });
    expect(gateReason(TEEN, '12')).toEqual({ age: null, heavy: false });
  });
  it('names the age that hides the card in the mode', () => {
    expect(gateReason(TEEN, 'all')).toEqual({ age: '12', heavy: false });
    expect(gateReason(OLDER, 'all')).toEqual({ age: '16', heavy: false });
    expect(gateReason(OLDER, '12')).toEqual({ age: '16', heavy: false });
  });
  it('names the heavy topic, and the age only when the age is also a reason in this mode', () => {
    expect(gateReason(HEAVY_ALL, 'all')).toEqual({ age: null, heavy: true });
    expect(gateReason(HEAVY_TEEN, 'all')).toEqual({ age: '12', heavy: true });
    expect(gateReason(HEAVY_TEEN, '12')).toEqual({ age: null, heavy: true });
    expect(gateReason(HEAVY_OLDER, '12')).toEqual({ age: '16', heavy: true });
  });
});

import { countVariants, familyAttrs, groupVariants, zeroModes } from '../../src/lib/family';

describe('markup helpers', () => {
  it('builds the data attributes of a list item from event data', () => {
    expect(familyAttrs({ min_age: 12, sensitive: true })).toEqual({ 'data-min-age': '12', 'data-sensitive': 'true' });
    expect(familyAttrs({ min_age: 'all', sensitive: false })).toEqual({ 'data-min-age': 'all', 'data-sensitive': 'false' });
  });
  it('merges modes with the same counter into one variant', () => {
    expect(countVariants({ off: 8, all: 8, '12': 8 })).toEqual([{ modes: ['off', 'all', '12'], value: 8 }]);
    expect(countVariants({ off: 8, all: 5, '12': 7 }).map((v) => [v.modes, v.value])).toEqual([[['off'], 8], [['all'], 5], [['12'], 7]]);
    expect(countVariants({ off: 8, all: 5, '12': 5 }).map((v) => [v.modes, v.value])).toEqual([[['off'], 8], [['all', '12'], 5]]);
  });
  it('groups any result by its key and keeps every mode exactly once', () => {
    const variants = groupVariants((mode) => ['x', mode === 'off' ? 'a' : 'b']);
    expect(variants.flatMap((v) => v.modes).sort()).toEqual(['12', 'all', 'off']);
    expect(variants).toHaveLength(2);
  });
  it('finds the modes where a counter is zero', () => {
    expect(zeroModes({ off: 3, all: 0, '12': 0 })).toEqual(['all', '12']);
    expect(zeroModes({ off: 3, all: 1, '12': 2 })).toEqual([]);
  });
});

import { cardNeighbours } from '../../src/lib/events';
import { feedFilterCss } from '../../src/lib/epoch-filter';
import type { EventData } from '../../src/lib/events';

describe('previous / next card with a filter', () => {
  const ev = (id: string, year: number) => ({ id, epoch: 'e', year, status: 'ready' }) as unknown as EventData;
  const all = [ev('a', 1), ev('b', 2), ev('c', 3), ev('d', 4)];
  it('skips the cards the filter does not allow', () => {
    const neighbours = cardNeighbours(all[1]!, all, (e) => e.id !== 'c');
    expect([neighbours.prev?.id, neighbours.next?.id]).toEqual(['a', 'd']);
  });
  it('keeps the current card even when the filter would hide it', () => {
    const neighbours = cardNeighbours(all[2]!, all, (e) => e.id !== 'c');
    expect([neighbours.prev?.id, neighbours.next?.id]).toEqual(['b', 'd']);
  });
  it('without a filter behaves as before', () => {
    expect([cardNeighbours(all[0]!, all).prev, cardNeighbours(all[0]!, all).next?.id]).toEqual([null, 'b']);
  });
});

describe('feed filter before the first paint', () => {
  it('has one rule per thread and refuses odd ids', () => {
    const css = feedFilterCss(['mar', 'gente-como-nos', 'bad"id']);
    expect(css.split('\n')).toHaveLength(2);
    expect(css).toContain('html[data-fio="mar"] .feed__item:not([data-threads~="mar"]){display:none}');
    expect(css).not.toContain('bad');
  });
});
