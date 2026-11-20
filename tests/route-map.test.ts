import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { routeSchema, eventSchema } from '../src/data/schemas';
import { localize } from '../src/lib/localize';
import { routeGeo } from '../src/lib/route-geo';
import { buildRouteMap, landOf, routePath, routeYears, wrapLabel, ROUTE_FRAME, type MapRoute } from '../src/lib/route-map';
import { FERRY_MAX_KM, landProblems, seaProblems } from '../src/lib/route-sea';

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
  // The span is from the earliest to the latest year of the stops, wherever they stand; `years` of the route replaces it.
  const mid = (y?: number) => stop('Mid', 40, 0, { year: y, mode: 'sea' });
  assert.equal(routeYears({ points: pts([A, mid(1515), { ...B, year: 1516 }]) }), '1500–1516');
  assert.equal(routeYears({ points: pts([{ ...A, year: undefined }, mid(1515), { ...B, year: 1516 }]) }), '1515–1516');
  assert.equal(routeYears({ points: pts([A, { ...B, year: 1499 }]) }), '1499–1500');
  assert.equal(routeYears({ years: '1515–1516', points: pts([A, B]) }), '1515–1516');
});

test('the caption names every stop up to four, else the first and the last with an ellipsis', () => {
  assert.equal(routePath(['A', 'B']), 'A → B');
  assert.equal(routePath(['A', 'B', 'C']), 'A → B → C');
  assert.equal(routePath(['A', 'B', 'C', 'D']), 'A → B → C → D');
  assert.equal(routePath(['A', 'B', 'C', 'D', 'E']), 'A → … → E');
  const via = { via: true, lat: 40, lng: 0, mode: 'sea' };
  assert.equal(buildRouteMap({ points: pts([A, via, B, via, stop('Charlie', 44, 15, { mode: 'sea' })]) }, 'en', routeGeo()).path, 'Alpha → Bravo → Charlie');
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
  assert.equal(model.path, 'Alpha → Bravo');
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

test('the land check: a sea leg over land is found, a via point that turns it onto the water clears it, a port is let off', () => {
  const geo = routeGeo();
  // Lisbon to Rome as one arc runs over Spain and France; with landmarks along the Iberian coast, Gibraltar and the islands it keeps to the water.
  const lisbon = stop('Lisbon', 38.72, -9.14);
  const rome = stop('Rome', 41.9, 12.45, { mode: 'sea' });
  const bad = seaProblems({ points: pts([lisbon, rome]) }, geo);
  assert.equal(bad.length, 1);
  assert.equal(bad[0]!.section, 'Lisbon → Rome');
  assert.ok(bad[0]!.depthKm > 100);
  const sea = (lat: number, lng: number) => ({ via: true, lat, lng, mode: 'sea' });
  const good = seaProblems({ points: pts([lisbon, sea(36.7, -9.7), sea(35.95, -5.7), sea(36.9, -0.5), sea(38.2, 5.5), sea(39, 9.3), sea(41.4, 11.9), rome]) }, geo);
  assert.deepEqual(good, []);
  // Land and air legs are not walked.
  assert.deepEqual(seaProblems({ points: pts([lisbon, { ...rome, mode: 'land' }]) }, geo), []);
  assert.deepEqual(seaProblems({ points: pts([lisbon, { ...rome, mode: 'air' }]) }, geo), []);
});

test('every sea leg of the stories keeps to the water (the same check as check:data)', () => {
  const geo = routeGeo();
  for (const { f, data } of withRoute) {
    const event = localize(eventSchema.parse(data), true);
    assert.deepEqual(seaProblems(event.route!, geo), [], `${f}: a sea leg over land`);
  }
});

test('a ferry leg is dashed in its own run, marked in the model, and only for a land leg', () => {
  const via = (lat: number, lng: number, extra: object = {}) => ({ via: true, lat, lng, mode: 'land', ...extra });
  const route: MapRoute = { points: pts([stop('Alpha', 38.72, -9.14), via(38.66, -9.07, { leg: 'ferry' }), stop('Bravo', 38.57, -8.9, { mode: 'land' })]) };
  assert.ok(routeSchema.safeParse(route).success);
  assert.ok(!routeSchema.safeParse({ points: [A, { ...B, leg: 'ferry' }] }).success, 'a ferry leg by sea');
  const model = buildRouteMap(route, 'en', routeGeo());
  assert.equal(model.ferry, true);
  assert.equal(model.approx, false);
  assert.equal(model.runs.length, 2);
  assert.equal(model.runs[0]!.ferry, true);
  assert.equal(model.runs[1]!.dash, undefined);
});

test('the land check: a land leg over water is found, a ferry leg is let off up to its limit, a road round the water clears it', () => {
  const geo = routeGeo();
  const land = (lat: number, lng: number, extra: object = {}) => ({ via: true, lat, lng, mode: 'land', ...extra });
  const alpha = stop('Alpha', 38.72, -9.14);
  const bravo = stop('Bravo', 40.4, -3.7, { mode: 'land' });
  // From Lisbon straight to the north-east the line goes over the estuary of the Tagus; a landmark on its north-west shore keeps it on land.
  const bad = landProblems({ points: pts([alpha, bravo]) }, geo);
  assert.equal(bad.length, 1);
  assert.equal(bad[0]!.kind, 'water');
  assert.equal(bad[0]!.section, 'Alpha → Bravo');
  assert.deepEqual(landProblems({ points: pts([alpha, land(39, -9.2), bravo]) }, geo), []);
  // Lisbon to Rome by land: the Mediterranean in between.
  const rome = stop('Rome', 41.9, 12.45, { mode: 'land' });
  assert.equal(landProblems({ points: pts([alpha, rome]) }, geo).length, 1);
  // A ferry across the estuary is let off; one longer than the limit is an error of its own.
  assert.deepEqual(landProblems({ points: pts([alpha, land(38.66, -9.07, { leg: 'ferry' }), stop('Palmela', 38.57, -8.9, { mode: 'land' })]) }, geo), []);
  const far = landProblems({ points: pts([alpha, land(36, -9, { leg: 'ferry' }), stop('Bravo', 36.5, -8.9, { mode: 'land' })]) }, geo).filter((p) => p.kind === 'ferry');
  assert.equal(far.length, 1);
  assert.equal(far[0]!.kind, 'ferry');
  assert.ok(far[0]!.km > FERRY_MAX_KM);
  // Sea and air legs are not walked here.
  assert.deepEqual(landProblems({ points: pts([alpha, { ...rome, mode: 'sea' }]) }, geo), []);
});

test('a map of a region is drawn on the land at 1:10m, a map of an ocean on the one at 1:50m', () => {
  const geo = routeGeo();
  const region: MapRoute = { points: pts([stop('Alpha', 38.72, -9.14), stop('Bravo', 38.02, -8.69, { mode: 'land' })]) };
  const ocean: MapRoute = { points: pts([stop('Alpha', 38.72, -9.14), stop('Bravo', -22.9, -43.2, { mode: 'sea' })]) };
  assert.equal(landOf(region, geo), geo.fine);
  assert.equal(landOf(ocean, geo), geo.land);
  assert.ok(geo.fine!.length > geo.land.length);
  // Without the fine land the coarse one serves.
  assert.equal(landOf(region, { land: geo.land, rivers: geo.rivers }), geo.land);
});

test('every land leg of the stories keeps to the land, and a ferry is short (the same check as check:data)', () => {
  const geo = routeGeo();
  for (const { f, data } of withRoute) {
    const event = localize(eventSchema.parse(data), true);
    assert.deepEqual(landProblems(event.route!, geo), [], `${f}: a land leg over water`);
  }
});

test('two stops closer than 15 units get smaller dots that do not touch; far ones keep the full size', () => {
  const model = buildRouteMap({ points: pts([stop('Far', 38.7, -9.1), stop('Near1', 44.8, 11.6, { mode: 'land' }), stop('Near2', 44.6, 10.9, { mode: 'land' })]) }, 'en', routeGeo());
  const [far, a, b] = model.dots;
  assert.equal(far!.r, 4);
  const gap = Math.hypot(a!.x - b!.x, a!.y - b!.y) - (a!.r + 1) - (b!.r + 1);
  assert.ok(a!.r < 4 && b!.r < 5 && gap >= 1, `dots ${a!.r}, ${b!.r}, gap ${gap}`);
});
