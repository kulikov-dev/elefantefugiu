import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { routeSchema, eventSchema } from '../src/data/schemas';
import { localize } from '../src/lib/localize';
import { routeGeo } from '../src/lib/route-geo';
import { buildRouteMap, routeYears, wrapLabel, ROUTE_FRAME, type MapRoute } from '../src/lib/route-map';

const name = (s: string) => ({ pt: s, en: s, ru: s });
const stop = (s: string, lat: number, lng: number, extra: object = {}) => ({ name: name(s), lat, lng, ...extra });
const A = stop('Alpha', 38.7, -9.1, { year: 1500 });
const B = stop('Bravo', 41.9, 12.4, { year: 1501, mode: 'sea' });
const pts = (list: object[]) => list as MapRoute['points'];

test('the schema wants two stops, a mode on every leg but the first, and a nameless via', () => {
  assert.ok(routeSchema.safeParse({ points: [A, B] }).success);
  assert.ok(!routeSchema.safeParse({ points: [A] }).success, 'one point');
  assert.ok(!routeSchema.safeParse({ points: [A, { ...B, mode: undefined }] }).success, 'no mode on a leg');
  assert.ok(!routeSchema.safeParse({ points: [A, { ...B, mode: 'rocket' }] }).success, 'unknown mode');
  assert.ok(!routeSchema.safeParse({ points: [A, { ...B, lat: 120 }] }).success, 'latitude out of range');
  assert.ok(!routeSchema.safeParse({ points: [A, { ...B, lng: -200 }] }).success, 'longitude out of range');
  assert.ok(!routeSchema.safeParse({ points: [{ ...A, mode: 'sea' }, B] }).success, 'mode on the first point');
  assert.ok(!routeSchema.safeParse({ points: [A, { lat: 40, lng: 0, mode: 'sea' }, B] }).success, 'a stop without a name');
  assert.ok(routeSchema.safeParse({ points: [A, { via: true, lat: 40, lng: 0, mode: 'sea' }, B] }).success, 'a via point');
  assert.ok(!routeSchema.safeParse({ points: [A, { via: true, name: name('X'), lat: 40, lng: 0, mode: 'sea' }, B] }).success, 'a via point with a name');
  assert.ok(!routeSchema.safeParse({ points: [{ via: true, lat: 40, lng: 0 }, A, B] }).success, 'via first');
  assert.ok(!routeSchema.safeParse({ points: [A, { ...B, mode: 'river' }] }).success, 'a river leg names the river');
  assert.ok(!routeSchema.safeParse({ points: [A, { ...B, river: 'douro' }] }).success, 'river on a sea leg');
});

test('the years of a route: one, a span, or none', () => {
  const r = (a?: number, b?: number): MapRoute => ({ points: pts([{ ...A, year: a }, { ...B, year: b }]) });
  assert.equal(routeYears(r(1500, 1500)), '1500');
  assert.equal(routeYears(r(1500, 1502)), '1500–1502');
  assert.equal(routeYears(r(1500)), '1500');
  assert.equal(routeYears(r(undefined, 1501)), '1501');
  assert.equal(routeYears(r()), '');
});

test('labels wrap at spaces', () => {
  assert.deepEqual(wrapLabel('Lisbon'), ['Lisbon']);
  assert.deepEqual(wrapLabel('Saint Peter and Saint Paul Rocks'), ['Saint Peter and', 'Saint Paul Rocks']);
  assert.ok(wrapLabel('Скалы Святых Петра и Павла').length >= 2);
  assert.deepEqual(wrapLabel('Supercalifragilisticexpialidocious'), ['Supercalifragilisticexpialidocious']);
});

test('the land decodes into rings', () => {
  const { land, rivers } = routeGeo();
  assert.ok(land.length > 100);
  assert.ok(land.every((ring) => ring.length >= 3 && ring.every(([lon, lat]) => lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)));
  assert.ok(rivers['douro']!.length > 10);
});

const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

test('the map: the last dot sits on the end of the line, the first on its start, labels stay in the frame', () => {
  const model = buildRouteMap({ points: pts([A, B]) }, 'en', routeGeo());
  const { w, h } = ROUTE_FRAME;
  const nums = numbers(model.mask);
  assert.deepEqual([model.dots[0]!.x, model.dots[0]!.y], [nums[0], nums[1]]);
  assert.deepEqual([model.dots[1]!.x, model.dots[1]!.y], [nums[nums.length - 2], nums[nums.length - 1]]);
  assert.equal(model.dots[1]!.r, model.dots[0]!.r + 1);
  assert.equal(model.from, 'Alpha');
  assert.equal(model.to, 'Bravo');
  assert.equal(model.approx, false);
  for (const label of model.labels) for (const line of label.lines) assert.ok(line.y > 0 && line.y < h && label.x > 0 && label.x < w);
});

test('an approximate leg is dotted; a via point makes no dot and no label', () => {
  const route: MapRoute = { approx: true, points: pts([A, { via: true, lat: 40, lng: -2, mode: 'sea' }, B]) };
  const model = buildRouteMap(route, 'pt', routeGeo());
  assert.equal(model.approx, true);
  assert.equal(model.dots.length, 2);
  assert.equal(model.labels.length, 2);
  assert.equal(model.stops.length, 2);
  assert.match(model.runs[0]!.dash!, /^1 \d+(\.\d+)?$/);
  const gap = Number(model.runs[0]!.dash!.split(' ')[1]);
  assert.ok(gap > 1 && gap < 12, 'the dots are a few units apart');
});

test('legs of one kind make one run; a change of mode or approx starts a new one', () => {
  const C = stop('Charlie', 44, 15, { mode: 'land' });
  const D = stop('Delta', 45, 20, { mode: 'land', approx: true });
  const model = buildRouteMap({ points: pts([A, B, C, D]) }, 'en', routeGeo());
  assert.equal(model.runs.length, 3);
  assert.notEqual(model.runs[2]!.dash, undefined);
  assert.equal(model.runs[0]!.dash, undefined);
});

test('a river leg follows the course of the river and ends on its stops', () => {
  const route: MapRoute = { points: pts([stop('Up', 41.158, -7.3679), stop('Down', 41.1239, -8.6118, { mode: 'river', river: 'douro' })]) };
  const model = buildRouteMap(route, 'en', routeGeo());
  assert.ok(numbers(model.mask).length / 2 > 3, 'more than two points: not a straight line');
  assert.throws(() => buildRouteMap({ points: pts([A, { ...B, mode: 'river', river: 'nile' }]) }, 'en', routeGeo()), /unknown river/);
});

// What the data of the stories must satisfy: counted from the files, no story is named here.
const dir = new URL('../src/content/events/', import.meta.url);
const withRoute = readdirSync(dir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({ f, data: parse(readFileSync(new URL(f, dir), 'utf8')) }))
  .filter(({ data }) => data.route);

test('every route in the stories can be drawn in every language, stays in the frame and is small', () => {
  assert.ok(withRoute.length > 0, 'need: at least one story with a route');
  const { w, h } = ROUTE_FRAME;
  for (const { f, data } of withRoute) {
    const event = localize(eventSchema.parse(data), true);
    assert.ok(!event.sensitive, `${f}: a heavy story has no route map`);
    for (const lang of ['pt', 'en', 'ru'] as const) {
      const model = buildRouteMap(event.route!, lang, routeGeo());
      const size = model.land.length + model.mask.length * 3;
      assert.ok(size < 15 * 1024, `${f} ${lang}: ${size} bytes of SVG`);
      assert.ok(model.dots.every((d) => d.x > 0 && d.x < w && d.y > 0 && d.y < h), `${f}: a dot outside the frame`);
      const last = numbers(model.mask).slice(-2);
      assert.deepEqual([model.dots.at(-1)!.x, model.dots.at(-1)!.y], last, `${f}: the last dot is not on the end of the line`);
      for (const label of model.labels) assert.ok(label.lines.every((l) => l.text.length <= 16 || !l.text.includes(' ')), `${f}: a long label line`);
    }
  }
});
