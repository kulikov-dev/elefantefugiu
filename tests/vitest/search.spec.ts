import { describe, expect, it } from 'vitest';
import {
  fold,
  highlight,
  mapPlaceLink,
  matchesPlace,
  placeFirst,
  placeForQuery,
  placeFromSearch,
  SEARCH_META,
  visibleHits,
  type SearchPlace,
} from '../../src/lib/search';
import { searchAttrs, searchPlaces } from '../../src/lib/search-index';
import { placeSlug } from '../../src/lib/timetravel';
import type { EventData } from '../../src/lib/events';

// The input is part of each test: a story is only what the search reads of it.
const story = (over: Record<string, unknown> = {}): EventData =>
  ({
    id: 's',
    year: 1515,
    hook: { pt: 'Gancho', en: 'Hook', ru: 'Крючок' },
    place: { name: { pt: 'Lisboa, Paço da Ribeira', en: 'Lisbon, Paço da Ribeira', ru: 'Лиссабон, Пасу-да-Рибейра' }, short: { pt: 'Lisboa', en: 'Lisbon', ru: 'Лиссабон' }, lat: 38.7, lon: -9.1 },
    epoch: 'avis-e-descobrimentos',
    min_age: 'all',
    sensitive: false,
    ...over,
  }) as unknown as EventData;

describe('the key of a place', () => {
  it('is the Portuguese short name without accents, the same in every language', () => {
    expect(placeSlug('São Miguel')).toBe('sao-miguel');
    expect(placeSlug('Lisboa')).toBe('lisboa');
    expect(searchAttrs(story(), 'ru')['data-pf-pkey']).toBe('lisboa');
    expect(searchAttrs(story(), 'en')['data-pf-pkey']).toBe('lisboa');
  });
});

describe('searchAttrs', () => {
  it('gives every metadata field of the results and the place as a filter', () => {
    const attrs = searchAttrs(story(), 'ru');
    for (const name of SEARCH_META) expect(attrs[`data-pf-${name}`]).toBeDefined();
    expect(attrs['data-pagefind-meta']).toBe(SEARCH_META.map((n) => `${n}[data-pf-${n}]`).join(', '));
    expect(attrs['data-pagefind-filter']).toBe('pkey[data-pf-pkey]');
    expect(attrs['data-pf-place']).toBe('Лиссабон');
    expect(attrs['data-pf-hook']).toBe('Крючок');
    expect(attrs['data-pf-epoch']).toBe('avis-e-descobrimentos');
  });

  it('carries the age label and the heavy-topic flag the family mode needs', () => {
    expect(searchAttrs(story({ min_age: '12', sensitive: true }), 'pt')).toMatchObject({ 'data-pf-age': '12', 'data-pf-sens': 'true' });
  });
});

describe('searchPlaces', () => {
  it('counts the stories of a place by family mode', () => {
    const events = [story({ id: 'a' }), story({ id: 'b', sensitive: true }), story({ id: 'c', min_age: '12' })];
    const [lisbon] = searchPlaces(events, 'pt');
    expect(lisbon).toMatchObject({ key: 'lisboa', name: 'Lisboa', n: { off: 3, all: 1, '12': 2 } });
  });
});

describe('a query that names a place', () => {
  it('matches the name, its start and a name with another ending', () => {
    expect(matchesPlace('Лиссабон', 'Лиссабон')).toBe(true);
    expect(matchesPlace('лиссабоне', 'Лиссабон')).toBe(true);
    expect(matchesPlace('Lis', 'Lisboa')).toBe(true);
    expect(matchesPlace('lisboa', 'Lisboa')).toBe(true);
    expect(matchesPlace('Sao Miguel', 'São Miguel')).toBe(true);
    expect(matchesPlace('Порту', 'Порту')).toBe(true);
  });

  it('does not match another word, or a start that is too short', () => {
    expect(matchesPlace('Португалия', 'Порту')).toBe(false);
    expect(matchesPlace('Li', 'Lisboa')).toBe(false);
    expect(matchesPlace('землетрясение', 'Лиссабон')).toBe(false);
  });

  const places: SearchPlace[] = [
    { key: 'porto', name: 'Porto', n: { off: 4, all: 3, '12': 3 } },
    { key: 'portimao', name: 'Portimão', n: { off: 1, all: 0, '12': 0 } },
  ];
  it('is offered only when the mode leaves a story there', () => {
    expect(placeForQuery('Porto', places, 'off')?.key).toBe('porto');
    expect(placeForQuery('Portimao', places, 'off')?.key).toBe('portimao');
    expect(placeForQuery('Portimao', places, 'all')).toBeUndefined();
    expect(placeForQuery('rinoceronte', places, 'off')).toBeUndefined();
  });
});

describe('visibleHits', () => {
  const hits = [
    { id: 1, age: 'all', sens: 'false' },
    { id: 2, age: 'all', sens: 'true' },
    { id: 3, age: '12', sens: 'false' },
    { id: 4, age: '16', sens: 'false' },
  ];
  it('shows everything with the mode off, and hides a heavy story and a label above the mode otherwise', () => {
    expect(visibleHits(hits, 'off').map((h) => h.id)).toEqual([1, 2, 3, 4]);
    expect(visibleHits(hits, 'all').map((h) => h.id)).toEqual([1]);
    expect(visibleHits(hits, '12').map((h) => h.id)).toEqual([1, 3]);
  });
  it('treats an unknown mode as off and cuts the list to the most results', () => {
    expect(visibleHits(hits, 'x').length).toBe(4);
    expect(visibleHits(hits, 'off', 2).map((h) => h.id)).toEqual([1, 2]);
  });
});

describe('highlight', () => {
  const joined = (text: string, q: string) => highlight(text, q).map((p) => (p.mark ? `[${p.text}]` : p.text)).join('');
  it('marks the words of the query and their other forms', () => {
    expect(joined('Король стравил носорога со слоном', 'носорог')).toBe('Король стравил [носорога] со слоном');
    expect(joined('Лиссабонское землетрясение', 'Лиссабоне')).toBe('[Лиссабонское] землетрясение');
    expect(joined('1415 · Porto', 'porto')).toBe('1415 · [Porto]');
  });
  it('ignores accents and capitals and leaves a text with no word of the query as it is', () => {
    expect(joined('O Porto revoltou-se', 'PORTÓ')).toBe('O [Porto] revoltou-se');
    expect(highlight('Nada aqui', 'porto')).toEqual([{ text: 'Nada aqui', mark: false }]);
    expect(highlight('Algo', 'a')).toEqual([{ text: 'Algo', mark: false }]);
  });
});

describe('placeFirst', () => {
  it('puts the stories of the place first, in the order of the ranking, then the others', () => {
    const ranked = [{ id: 'x' }, { id: 'b' }, { id: 'y' }, { id: 'a' }];
    const inPlace = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(placeFirst(ranked, inPlace).map((r) => r.id)).toEqual(['b', 'a', 'c', 'x', 'y']);
  });
});

describe('the address of the map for a place', () => {
  it('is written and read back, and a wrong value is no place', () => {
    expect(mapPlaceLink('/pt/mapa/', 'sao-miguel')).toBe('/pt/mapa/?place=sao-miguel');
    expect(placeFromSearch('?place=sao-miguel')).toBe('sao-miguel');
    expect(placeFromSearch('?place=')).toBeNull();
    expect(placeFromSearch('?place=<script>')).toBeNull();
    expect(placeFromSearch('?epoca=x')).toBeNull();
  });
  it('folds a query to the form places are compared in', () => {
    expect(fold('  São  Miguel ')).toBe('sao miguel');
    expect(fold('Ёлка')).toBe('елка');
  });
});
