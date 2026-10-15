import { describe, expect, it } from 'vitest';
import { cardsView, mapLinkFor, mapMaxBounds, MAINLAND_VIEW, parseMapState, passesFilters, serializeMapState, type MapKnown } from '../../src/lib/map-data';

const known: MapKnown = {
  threads: ['mar', 'natureza'],
  epochs: ['a', 'b'],
  cards: [
    { id: 'c1', epoch: 'a', threads: ['mar'] },
    { id: 'c2', epoch: 'b', threads: ['natureza', 'mar'] },
  ],
};

describe('map address state', () => {
  it('defaults to nothing', () => {
    expect(parseMapState('', known)).toEqual({ fio: null, epoca: null, id: null });
  });

  it('reads thread, epoch and card', () => {
    expect(parseMapState('?fio=mar&epoca=a&id=c1', known)).toEqual({ fio: 'mar', epoca: 'a', id: 'c1' });
  });

  it('ignores unknown values and unrelated parameters', () => {
    expect(parseMapState('?fio=x&epoca=z&id=nope&utm=1', known)).toEqual({ fio: null, epoca: null, id: null });
  });

  it('a card in the address wins over filters that would hide it', () => {
    expect(parseMapState('?fio=natureza&id=c1', known)).toEqual({ fio: null, epoca: null, id: 'c1' });
    expect(parseMapState('?epoca=b&id=c1', known)).toEqual({ fio: null, epoca: null, id: 'c1' });
    expect(parseMapState('?fio=mar&epoca=b&id=c2', known)).toEqual({ fio: 'mar', epoca: 'b', id: 'c2' });
  });

  it('round trips with a fixed order', () => {
    expect(serializeMapState({ fio: null, epoca: null, id: null })).toBe('');
    const state = { fio: 'mar', epoca: 'a', id: 'c1' };
    expect(serializeMapState(state)).toBe('?fio=mar&epoca=a&id=c1');
    expect(parseMapState(serializeMapState(state), known)).toEqual(state);
  });

  it('builds the "open on the map" link', () => {
    expect(mapLinkFor('/pt/mapa/', 'c1')).toBe('/pt/mapa/?id=c1');
  });

  it('filters by primary or second thread and by epoch', () => {
    expect(passesFilters({ epoch: 'a', threads: ['mar'] }, { fio: 'mar', epoca: 'a' })).toBe(true);
    expect(passesFilters({ epoch: 'a', threads: ['natureza', 'mar'] }, { fio: 'mar', epoca: null })).toBe(true);
    expect(passesFilters({ epoch: 'a', threads: ['mar'] }, { fio: 'natureza', epoca: null })).toBe(false);
    expect(passesFilters({ epoch: 'a', threads: ['mar'] }, { fio: null, epoca: 'b' })).toBe(false);
  });
});

describe('map max bounds', () => {
  it('is the mainland with a margin when there are no island cards, and contains the initial view', () => {
    const b = mapMaxBounds([{ lat: 38.7, lon: -9.1 }]);
    expect(b.west).toBeGreaterThan(-12);
    expect(b.south).toBeLessThan(MAINLAND_VIEW.south);
    expect(b.north).toBeGreaterThan(MAINLAND_VIEW.north);
    expect(b.west).toBeLessThan(MAINLAND_VIEW.west);
    expect(b.east).toBeGreaterThan(MAINLAND_VIEW.east);
  });

  it('widens to the Azores or Madeira when a card is there, so every card stays reachable', () => {
    const azores = mapMaxBounds([{ lat: 38.7, lon: -9.1 }, { lat: 37.74, lon: -25.67 }]);
    expect(azores.west).toBeLessThan(-31.4);
    const madeira = mapMaxBounds([{ lat: 32.65, lon: -16.9 }]);
    expect(madeira.south).toBeLessThan(32.3);
    expect(madeira.west).toBeLessThan(-17.4);
  });

  it('always contains every card of the regions the check allows', () => {
    const cards = [{ lat: 36.8, lon: -9.6 }, { lat: 42.2, lon: -6.1 }, { lat: 32.3, lon: -17.4 }, { lat: 39.9, lon: -31.4 }];
    const b = mapMaxBounds(cards);
    for (const c of cards) {
      expect(c.lat).toBeGreaterThan(b.south);
      expect(c.lat).toBeLessThan(b.north);
      expect(c.lon).toBeGreaterThan(b.west);
      expect(c.lon).toBeLessThan(b.east);
    }
  });
});

describe('cardsView (initial view of a map with some cards)', () => {
  it('falls back to the mainland without cards', () => {
    expect(cardsView([])).toEqual(MAINLAND_VIEW);
  });

  it('contains every card with room around them', () => {
    const cards = [
      { lat: 38.7, lon: -9.1 },
      { lat: 41.1, lon: -8.6 },
    ];
    const v = cardsView(cards);
    for (const c of cards) {
      expect(c.lat).toBeGreaterThan(v.south);
      expect(c.lat).toBeLessThan(v.north);
      expect(c.lon).toBeGreaterThan(v.west);
      expect(c.lon).toBeLessThan(v.east);
    }
  });

  it('is never smaller than the minimum span, also for one card or cards on one spot', () => {
    for (const cards of [[{ lat: 38.7, lon: -9.1 }], [{ lat: 38.7, lon: -9.1 }, { lat: 38.7, lon: -9.1 }]]) {
      const v = cardsView(cards, 0.15, 0.5);
      expect(v.north - v.south).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(v.east - v.west).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect((v.north + v.south) / 2).toBeCloseTo(38.7);
      expect((v.east + v.west) / 2).toBeCloseTo(-9.1);
    }
  });
});
