// The pages of places (src/lib/places.ts): which place a story belongs to, which places have a page, the introduction built from the data, the titles.
// Pure unit tests with their own small input: nothing here depends on the content of the site.
import { describe, expect, it } from 'vitest';
import type { PlaceData } from '../../src/lib/places';
import { MAX_NEIGHBOURS, PLACE_MIN_STORIES, introMissing, neighbourPages, pageDay, pageOfStory, placeBridges, placeChain, placeIntro, placeMoreLabel, placeOf, placePages, placeSeoDescription, placeSeoTitle, topPages } from '../../src/lib/places';

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
  hook: { pt: `hook ${id}.`, en: `hook ${id}.`, ru: `hook ${id}.` },
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

  it('is built from the data when it is not written, never borrowed from another language', () => {
    const [page] = placePages([{ ...north, intro: { en: 'Written in English.' } }], stories);
    const auto = placeIntro(page!, 'pt');
    expect(auto.written).toBe(false);
    expect(auto.text).toContain('north');
    expect(auto.text).toContain('4 histórias');
    expect(auto.text).toContain('1415');
    expect(auto.text).toContain('1980');
    // The hooks of the three most important stories, the most important first; the least important one is left out.
    expect(auto.text.indexOf('hook b')).toBeLessThan(auto.text.indexOf('hook c'));
    expect(auto.text).not.toContain('hook d');
    expect(placeIntro(page!, 'ru').text).toContain('4 истории');
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

  it('the description is the introduction, cut at a word', () => {
    expect(placeSeoDescription('Short.')).toBe('Short.');
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
  const bridge = (name: string, lat: number) => ({ bridge: { name, title: { ru: `Имя ${name}` }, address: 'a', lat, lon: -9 } });

  it('one line for a place that two stories lead to; the name in the language of the page, the name on the spot beneath', () => {
    const list = placeBridges([{ id: 1, ...bridge('Museu', 38.1) }, { id: 2, ...bridge('Museu', 38.1) }, { id: 3, ...bridge('Torre', 38.2) }], 'ru');
    expect(list.map((b) => [b.title, b.local, b.stories.length])).toEqual([['Имя Museu', 'Museu', 2], ['Имя Torre', 'Torre', 1]]);
    expect(placeBridges([{ id: 1, ...bridge('Museu', 38.1) }], 'pt')[0]).toMatchObject({ title: 'Museu' });
    expect(placeBridges([{ id: 1, ...bridge('Museu', 38.1) }], 'pt')[0]!.local).toBeUndefined();
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
