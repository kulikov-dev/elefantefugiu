// The pages of places (src/lib/places.ts): which place a story belongs to, which places have a page, the introduction built from the data, the titles.
// Pure unit tests with their own small input: nothing here depends on the content of the site.
import { describe, expect, it } from 'vitest';
import type { PlaceData } from '../../src/lib/places';
import { MAX_NEIGHBOURS, centuryLabel, featuredStories, mapPlaces, ogStories, pageOfPoint, placeAllLabel, PLACE_MIN_STORIES, introMissing, neighbourPages, pageDay, pageOfStory, placeBridges, placeChain, placeIntro, placeMoreLabel, placeOf, placePages, placeSeoDescription, placeSeoTitle, sampleStories, topPages } from '../../src/lib/places';

const names = (pt: string, en = pt, ru = pt) => ({ pt, en, ru });
const place = (id: string, lat: number, lon: number, radius_km: number, extra: Partial<PlaceData> = {}): PlaceData => ({ id, name: names(id), center: { lat, lon }, radius_km, ...extra });

// A city with two districts, a town far away and an island town.
const city = place('city', 38.72, -9.15, 9, { name_of: { pt: 'da cidade', ru: 'города' } });
const north = place('north', 38.74, -9.15, 1, { parent: 'city' });
const south = place('south', 38.7, -9.15, 1, { parent: 'city' });
const town = place('town', 41.15, -8.6, 5);
const places = [city, north, south, town];

const story = (id: string, lat: number, lon: number, extra: Record<string, unknown> = {}) => ({
  id,
  bridge: { lat, lon },
  title: { pt: `title ${id}`, en: `title ${id}`, ru: `title ${id}` },
  year: 1500,
  importance: 1 as const,
  ...extra,
});

describe('the place of a story', () => {
  it('is the smallest circle that holds the bridge', () => {
    expect(placeOf(story('a', 38.74, -9.15), places)?.id).toBe('north');
    expect(placeOf(story('b', 38.7, -9.15), places)?.id).toBe('south');
    expect(placeOf(story('c', 38.72, -9.15), places)?.id).toBe('city');
    expect(placeOf(story('d', 41.15, -8.6), places)?.id).toBe('town');
  });

  it('is none where no circle holds the bridge', () => {
    expect(placeOf(story('e', 37, -8), places)).toBeUndefined();
  });

  it('is the one `area` names, whatever the coordinates say; an unknown area falls back to the circles', () => {
    expect(placeOf(story('f', 38.74, -9.15, { area: 'south' }), places)?.id).toBe('south');
    expect(placeOf(story('g', 38.74, -9.15, { area: 'nowhere' }), places)?.id).toBe('north');
  });

  it('a district stands on the page of its parent: the chain goes up, never round in a circle', () => {
    expect(placeChain(north, places).map((p) => p.id)).toEqual(['north', 'city']);
    const loop = [place('x', 0, 0, 1, { parent: 'y' }), place('y', 0, 0, 1, { parent: 'x' })];
    expect(placeChain(loop[0]!, loop).map((p) => p.id)).toEqual(['x', 'y']);
  });
});

describe('which places have a page', () => {
  const stories = [story('n1', 38.74, -9.15), story('n2', 38.74, -9.15), story('n3', 38.74, -9.15), story('s1', 38.7, -9.15), story('c1', 38.72, -9.15), story('t1', 41.15, -8.6), story('t2', 41.15, -8.6)];

  it(`needs ${PLACE_MIN_STORIES} stories, those of the districts counted for the city`, () => {
    const pages = placePages(places, stories);
    expect(pages.map((p) => `${p.place.id}:${p.stories.length}`)).toEqual(['city:5', 'north:3']);
    expect(pages[0]!.districts.map((d) => d.place.id)).toEqual(['north']);
  });

  it('a page goes away with its stories, and a new one comes with the third', () => {
    expect(placePages(places, stories.slice(1)).map((p) => p.place.id)).toEqual(['city']);
    expect(placePages(places, [...stories, story('t3', 41.15, -8.6)]).map((p) => p.place.id)).toEqual(['city', 'north', 'town']);
  });

  it('lists the top level in the index (a district goes under its city) and finds the page a story links to', () => {
    const pages = placePages(places, stories);
    expect(topPages(pages).map((p) => p.place.id)).toEqual(['city']);
    expect(pageOfStory(story('x', 38.74, -9.15), places, pages)?.place.id).toBe('north');
    // A district without a page: the link goes to the page of the city.
    expect(pageOfStory(story('y', 38.7, -9.15), places, pages)?.place.id).toBe('city');
    expect(pageOfStory(story('z', 41.15, -8.6), places, pages)).toBeUndefined();
  });

  it('"Nearby": the named places first, then the nearest ones, never the parent or a district, none too far', () => {
    const near = place('near', 38.9, -9.15, 3);
    const far = place('far', 41.15, -8.6, 3);
    const all = [city, north, south, near, far];
    const many = (id: string, lat: number, lon: number) => [1, 2, 3].map((i) => story(`${id}${i}`, lat, lon));
    const data = [...many('n', 38.74, -9.15), ...many('s', 38.7, -9.15), ...many('a', 38.9, -9.15), ...many('f', 41.15, -8.6)];
    const pages = placePages(all, data);
    const byId = (id: string) => pages.find((p) => p.place.id === id)!;
    expect(neighbourPages(byId('north'), pages).map((p) => p.place.id)).toEqual(['south', 'near']);
    expect(neighbourPages(byId('city'), pages).map((p) => p.place.id)).toEqual(['near']);
    expect(neighbourPages(byId('far'), pages)).toEqual([]);
    const named = placePages([{ ...north, neighbours: ['far'] }, south, near, far, city], data);
    expect(neighbourPages(named.find((p) => p.place.id === 'north')!, named).map((p) => p.place.id)[0]).toBe('far');
    expect(neighbourPages(byId('north'), pages, 1)).toHaveLength(1);
    expect(MAX_NEIGHBOURS).toBeGreaterThanOrEqual(2);
  });
});

describe('the introduction', () => {
  const stories = [story('a', 38.74, -9.15, { year: 1415, importance: 1 }), story('b', 38.74, -9.15, { year: { from: 1700, to: 1750 }, importance: 3 }), story('c', 38.74, -9.15, { year: 1922, importance: 2 }), story('d', 38.74, -9.15, { year: 1980, importance: 1 })];

  it('is the written one in the language of the page', () => {
    const [page] = placePages([{ ...north, intro: { en: 'Written in English.' } }], stories);
    expect(placeIntro(page!, 'en')).toEqual({ text: 'Written in English.', written: true });
  });

  it('is built from the data when it is not written: the count, the centuries and the titles of the three most important stories, never borrowed from another language', () => {
    const [page] = placePages([{ ...north, intro: { en: 'Written in English.' } }], stories);
    const auto = placeIntro(page!, 'pt');
    expect(auto.written).toBe(false);
    expect(auto.text).toBe('4 histórias, do século XV ao XX: «title a», «title b», «title c».');
    expect(placeIntro(page!, 'ru').text).toBe('4 истории с XV по XX век: «title a», «title b», «title c».');
    expect(placeIntro(page!, 'en').text).toBe('Written in English.');
    const [bare] = placePages([north], stories);
    expect(placeIntro(bare!, 'en').text).toBe('4 stories, from the 15th to the 20th century: “title a”, “title b”, “title c”.');
  });

  it('names one century once, and the years when the stories begin before the common era', () => {
    const same = placePages([north], [1510, 1520, 1590].map((y, i) => story(`s${i}`, 38.74, -9.15, { year: y })));
    expect(placeIntro(same[0]!, 'ru').text).toMatch(/^3 истории в XVI веке: /);
    const old = placePages([north], [-6000, 1520, 1590].map((y, i) => story(`o${i}`, 38.74, -9.15, { year: y })));
    expect(placeIntro(old[0]!, 'pt').text).toMatch(/^3 histórias, de 6000 a.C. a 1590: /);
  });

  it('writes the century of a year as the language does', () => {
    expect([1, 100, 101, 1499, 1900].map((y) => centuryLabel(y, 'ru'))).toEqual(['I', 'I', 'II', 'XV', 'XIX']);
    expect([1, 102, 1111, 1522, 2001].map((y) => centuryLabel(y, 'en'))).toEqual(['1st', '2nd', '12th', '16th', '21st']);
  });

  it('lists the languages that lack a written introduction', () => {
    expect(introMissing({ ...north, intro: { pt: 'x', ru: 'y' } })).toEqual(['en']);
    expect(introMissing(north)).toEqual(['pt', 'en', 'ru']);
  });
});

describe('the titles and links of search', () => {
  it('"History of ...: N stories and places to see | site" with the form "of" where the data has one; without the site when it is over 65 characters', () => {
    const short = place('ab', 0, 0, 1, { name_of: { pt: 'de ab', ru: 'аб' } });
    expect(placeSeoTitle(short, 4, 'pt')).toBe('História de ab: 4 histórias e lugares para ver | O Elefante Fugiu');
    expect(placeSeoTitle(short, 4, 'en')).toBe('ab history: 4 stories and places to see | O Elefante Fugiu');
    expect(placeSeoTitle(short, 4, 'ru')).toBe('История аб: 4 истории и места | O Elefante Fugiu');
    // Over 65 characters with the site: the title of a story is cut in the same way (check:cards).
    expect(placeSeoTitle(city, 4, 'pt')).toBe('História da cidade: 4 histórias e lugares para ver');
    expect(placeSeoTitle(town, 3, 'ru')).toBe('town: 3 истории и места | O Elefante Fugiu');
    const long = place('long', 0, 0, 1, { name: names('A very long name of a place that cannot fit with the site name behind it') });
    expect(placeSeoTitle(long, 3, 'en')).not.toContain('|');
  });

  it('the number in the title is the number it is given', () => {
    expect(placeSeoTitle(city, 12, 'en')).toContain('12 stories');
  });

  it('the description is the first sentence of the introduction, cut at a word', () => {
    expect(placeSeoDescription('Short.')).toBe('Short.');
    expect(placeSeoDescription('First one. Second one.')).toBe('First one.');
    expect(placeSeoDescription('word '.repeat(80)).length).toBeLessThanOrEqual(160);
  });

  it('"More stories of ..." uses the form "of" in pt and ru, the name otherwise', () => {
    expect(placeMoreLabel(city, 'pt')).toBe('Mais histórias da cidade →');
    expect(placeMoreLabel(city, 'ru')).toBe('Ещё истории города →');
    expect(placeMoreLabel(city, 'en')).toBe('More stories from city →');
    expect(placeMoreLabel(town, 'pt')).toBe('Mais histórias: town →');
  });
});

describe('what to see today', () => {
  const bridge = (name: string, lat: number, ru?: string) => ({ bridge: { name, ...(ru ? { title: { ru } } : {}), address: `address of ${name}`, lat, lon: -9 } });

  it('one card for a place that several stories lead to, also under two names a few metres apart; the shortest name, the stories as links', () => {
    const list = placeBridges(
      [
        { id: 1, ...bridge('Museu (a copy of a map)', 38.1, 'Музей (копия карты)') },
        { id: 2, ...bridge('Museu', 38.1001, 'Музей') },
        { id: 3, ...bridge('Torre', 38.2, 'Башня') },
        { id: 4, ...bridge('Museu', 38.1) },
      ],
      'ru',
    );
    expect(list.map((b) => [b.title, b.local, b.stories.map((s) => s.id)])).toEqual([['Музей', 'Museu', [1, 2, 4]], ['Башня', 'Torre', [3]]]);
  });

  it('keeps places that are far apart separate; no name on the spot beneath when it is the same', () => {
    const list = placeBridges([{ id: 1, ...bridge('Museu', 38.1) }, { id: 2, ...bridge('Museu', 38.2) }], 'pt');
    expect(list).toHaveLength(2);
    expect(list[0]!.local).toBeUndefined();
  });
});

describe('the day a page comes out', () => {
  const dated = (id: string, day: string, lat = 38.74) => ({ id, day, bridge: { lat, lon: -9.15 } });

  it('is the day of the third story, the queue counted; none while there are fewer', () => {
    const list = [dated('a', '2026-01-03'), dated('b', '2026-01-01'), dated('c', '2026-01-10'), dated('d', '2026-02-01')];
    expect(pageDay(north, places, list)).toBe('2026-01-10');
    expect(pageDay(city, places, list)).toBe('2026-01-10');
    expect(pageDay(north, places, list.slice(0, 2))).toBeUndefined();
    expect(pageDay(town, places, list)).toBeUndefined();
  });
});

describe('the stories a page shows first (the introduction and the preview picture)', () => {
  const many = (id: string, lat: number, n: number, importance: 1 | 2 | 3) => Array.from({ length: n }, (_, i) => story(`${id}${i}`, lat, -9.15, { importance }));

  it('a plain place: the three most important, the page order among equals, shown in the page order', () => {
    const [page] = placePages([town], [story('a', 41.15, -8.6, { importance: 1 }), story('b', 41.15, -8.6, { importance: 3 }), story('c', 41.15, -8.6, { importance: 3 }), story('d', 41.15, -8.6, { importance: 2 }), story('e', 41.15, -8.6, { importance: 3 })]);
    expect(featuredStories(page!).map((s) => s.id)).toEqual(['b', 'c', 'e']);
  });

  it('a city with districts: the best story of each district first, then the best of the rest', () => {
    // north has the most important stories, south and the city itself less so: the picture must still show the three parts.
    const data = [...many('n', 38.74, 4, 3), ...many('s', 38.7, 3, 2), ...many('c', 38.72, 3, 1)];
    const city = placePages(places, data).find((p) => p.place.id === 'city')!;
    expect(featuredStories(city).map((s) => s.id)).toEqual(['n0', 's0', 'c0']);
    // Fewer parts than pictures: the rest is filled with the best of what is left.
    const two = placePages(places, [...many('n', 38.74, 4, 3), ...many('s', 38.7, 3, 2)]).find((p) => p.place.id === 'city')!;
    expect(featuredStories(two).map((s) => s.id)).toEqual(['n0', 'n1', 's0']);
  });
});

describe('the stories of the preview picture', () => {
  const data = [story('a', 41.15, -8.6, { importance: 1 }), story('b', 41.15, -8.6, { importance: 3 }), story('c', 41.15, -8.6, { importance: 2 }), story('d', 41.15, -8.6, { importance: 1 })];

  it('are the ones the place names, in the order named; one that is not on the page is left out', () => {
    const [page] = placePages([{ ...town, og_stories: ['d', 'gone', 'a'] }], data);
    expect(ogStories(page!).map((s) => s.id)).toEqual(['d', 'a']);
  });

  it('are the featured ones when the place names none, or none of the named is on the page', () => {
    const [plain] = placePages([town], data);
    expect(ogStories(plain!).map((s) => s.id)).toEqual(featuredStories(plain!).map((s) => s.id));
    const [lost] = placePages([{ ...town, og_stories: ['gone'] }], data);
    expect(ogStories(lost!).map((s) => s.id)).toEqual(featuredStories(lost!).map((s) => s.id));
  });
});

describe('the entries to the pages', () => {
  const data = [1, 2, 3].map((i) => story(`n${i}`, 38.74, -9.15)).concat([1, 2, 3, 4].map((i) => story(`t${i}`, 41.15, -8.6)));
  const pages = placePages(places, data);

  it('the page of a point (the place where a story happened): the smallest place with a page, else its parent; none outside', () => {
    expect(pageOfPoint({ lat: 38.74, lon: -9.15 }, places, pages)?.place.id).toBe('north');
    // A point in the south district, which has no page: the page of the city.
    expect(pageOfPoint({ lat: 38.7, lon: -9.15 }, places, pages)?.place.id).toBe('city');
    expect(pageOfPoint({ lat: 10, lon: 10 }, places, pages)).toBeUndefined();
  });

  it('the index lists the place with the most stories first', () => {
    expect(topPages(pages).map((p) => p.place.id)).toEqual(['town', 'city']);
  });

  it('"All stories of ..." uses the form "of" where the data has one', () => {
    expect(placeAllLabel(city, 'pt')).toBe('Todas as histórias da cidade →');
    expect(placeAllLabel(city, 'ru')).toBe('Все истории города →');
    expect(placeAllLabel(city, 'en')).toBe('All stories from city →');
    expect(placeAllLabel(town, 'ru')).toBe('Все истории: town →');
  });

  it('the places of a map: the smallest first, each with the ids of its stories (a group wholly inside the first that holds it offers that page)', () => {
    const list = mapPlaces(pages, 'en', (id) => `/p/${id}/`);
    expect(list.map((p) => [p.href, p.ids.length])).toEqual([['/p/north/', 3], ['/p/city/', 3], ['/p/town/', 4]]);
  });
});

describe('the stories on an index card', () => {
  const y = (id: string, year: number | { from: number; to: number }) => ({ id, year });
  it('three or fewer: all of them in time order', () => {
    expect(sampleStories([y('c', 1700), y('a', 1300), y('b', { from: 1500, to: 1510 })]).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
  it('more: the earliest, one from the middle and the latest', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => y(id, 1000 + i * 100));
    expect(sampleStories([...list].reverse()).map((s) => s.id)).toEqual(['a', 'd', 'g']);
    expect(sampleStories(list.slice(0, 4)).map((s) => s.id)).toEqual(['a', 'c', 'd']);
  });
});
