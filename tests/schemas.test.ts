import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minAge } from '../src/data/schemas';

test('min_age is normalised to a string', () => {
  assert.equal(minAge.parse(12), '12');
  assert.equal(minAge.parse('12'), '12');
  assert.equal(minAge.parse(16), '16');
  assert.equal(minAge.parse('16'), '16');
  assert.equal(minAge.parse('all'), 'all');
});

test('min_age rejects other values', () => {
  for (const bad of [14, '14', 'ALL', '', null, undefined, '12+']) {
    assert.equal(minAge.safeParse(bad).success, false, `should reject ${String(bad)}`);
  }
});

// ---- epochs outside the MVP (stage 4a follow-up) ----
import { epochSchema } from '../src/data/schemas';

const baseEpoch = { id: 'e', slug: { pt: 'e', en: 'e' }, order: 1, name: { pt: 'E', en: 'E' }, placeholder: [] };
const fullStyle = { bg: '#fff', accent: '#000', heading_font: 'serif', frame: '1px solid #000' };

test('epochSchema: epoch outside the MVP needs years_label only', () => {
  const ok = epochSchema.safeParse({ ...baseEpoch, mvp: false, years_label: { pt: 'séc. V', en: '5th century' } });
  assert.equal(ok.success, true);
  const missing = epochSchema.safeParse({ ...baseEpoch, mvp: false });
  assert.equal(missing.success, false);
  assert.match(JSON.stringify(missing.error?.issues), /years_label/);
});

test('epochSchema: MVP epoch needs years, theme and style', () => {
  const bad = epochSchema.safeParse({ ...baseEpoch, mvp: true });
  assert.equal(bad.success, false);
  const fields = (bad.error?.issues ?? []).map((i) => i.path[0]).sort();
  assert.deepEqual(fields, ['style', 'theme', 'years']);
  const ok = epochSchema.safeParse({
    ...baseEpoch,
    mvp: true,
    years: { from: 1385, to: 1580 },
    theme: { pt: 'x', en: 'x' },
    style: fullStyle,
  });
  assert.equal(ok.success, true);
});

test('epochSchema: a typo in a field name is an error (strict)', () => {
  const bad = epochSchema.safeParse({ ...baseEpoch, mvp: false, years_label: { pt: 'a', en: 'a' }, year_label: 'x' });
  assert.equal(bad.success, false);
});

// ---- interactives (stage 7a) ----
import { armyDotsData, shipScaleData } from '../src/data/schemas';

const tx = { pt: 'a', en: 'b' };
const dotsGroup = { id: 'g', label: tx, min: 1, max: 2, unit_per_dot: 1, tone: 'blue', note: tx };
const dots = { groups: [dotsGroup, { ...dotsGroup, id: 'h', tone: 'red' }], caption: tx, estimate_note: tx };

test('army_dots: a valid record, with the optional test-numbers mark', () => {
  assert.equal(armyDotsData.safeParse(dots).success, true);
  assert.equal(armyDotsData.safeParse({ ...dots, placeholder: true }).success, true);
});

test('army_dots: needs two groups, a known tone, both languages and the estimate note', () => {
  assert.equal(armyDotsData.safeParse({ ...dots, groups: [dotsGroup] }).success, false);
  assert.equal(armyDotsData.safeParse({ ...dots, groups: [dotsGroup, { ...dotsGroup, id: 'h', tone: 'pink' }] }).success, false);
  assert.equal(armyDotsData.safeParse({ ...dots, groups: [dotsGroup, { ...dotsGroup, id: 'h', label: { pt: 'a' } }] }).success, false);
  const { estimate_note: _drop, ...noNote } = dots;
  assert.equal(armyDotsData.safeParse(noNote).success, false);
  assert.equal(armyDotsData.safeParse({ ...dots, groups: [dotsGroup, { ...dotsGroup, id: 'h', unit_per_dot: 0 }] }).success, false);
});

test('army_dots: a typo in a field name is an error (strict)', () => {
  assert.equal(armyDotsData.safeParse({ ...dots, captoin: tx }).success, false);
});

const items = [{ id: 'a', label: tx, length_m: 25, tone: 'ochre' }, { id: 'b', label: tx, length_m: 200, height_m: 50, tone: 'grey' }];

test('ship_scale: a valid record; height is optional; two items at least', () => {
  assert.equal(shipScaleData.safeParse({ items, caption: tx }).success, true);
  assert.equal(shipScaleData.safeParse({ items: [items[0]], caption: tx }).success, false);
  assert.equal(shipScaleData.safeParse({ items: [{ ...items[0], length_m: -1 }, items[1]], caption: tx }).success, false);
  assert.equal(shipScaleData.safeParse({ items, caption: tx, extra: 1 }).success, false);
});

// ---- place and bridge (stage 5c) ----
import { eventSchema } from '../src/data/schemas';
import { readFileSync as readFile } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const sample = () => parseYaml(readFile(new URL('../src/content/events/cantino-1502.yaml', import.meta.url), 'utf8'), { schema: 'core', customTags: ['timestamp'] });

test('place: any coordinates in the world are accepted (Goa), only impossible values are not', () => {
  const ok = sample();
  assert.equal(eventSchema.safeParse(ok).success, true);
  assert.equal(eventSchema.safeParse({ ...ok, place: { name: { pt: 'Pólo', en: 'Pole', ru: 'Полюс' }, lat: -90, lon: 180 } }).success, true);
  assert.equal(eventSchema.safeParse({ ...ok, place: { name: { pt: 'x', en: 'x' }, lat: 91, lon: 0 } }).success, false);
  assert.equal(eventSchema.safeParse({ ...ok, place: { name: { pt: 'x', en: 'x' }, lat: 0, lon: 181 } }).success, false);
});

test('bridge: needs a note in both languages', () => {
  const ok = sample();
  assert.equal(eventSchema.safeParse({ ...ok, bridge: { ...ok.bridge, note: undefined } }).success, false);
  assert.equal(eventSchema.safeParse({ ...ok, bridge: { ...ok.bridge, note: { pt: 'a' } } }).success, false);
  assert.equal(eventSchema.safeParse({ ...ok, bridge: { ...ok.bridge, extra: 1 } }).success, false);
});

test('bridge.maps_url: optional, a clean Google Maps address only', () => {
  const ok = sample();
  const parse = (maps_url: unknown) => eventSchema.safeParse({ ...ok, bridge: { ...ok.bridge, maps_url } }).success;
  assert.equal(parse(undefined), true);
  assert.equal(parse('https://www.google.com/maps/place/Gil+Eannes/@37.09,-8.67,17z/data=!3m1!4b1'), true);
  assert.equal(parse('https://www.google.com/maps/search/?api=1&query=Museu+Nacional+dos+Coches'), true);
  assert.equal(parse('https://www.google.com/maps/place/x/@1,2,17z?entry=tts&g_ep=abc'), false);
  assert.equal(parse('https://maps.app.goo.gl/B1WYdpKLyhMAR9oh7'), false);
  assert.equal(parse('https://example.com/maps/'), false);
  assert.equal(parse('not a url'), false);
});

const thenNowSource = { title: 'A source', url: 'https://example.org/a', type: 'web', accessed: '2026-10-29' };
const thenNowCard = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  then_big: { pt: '1', en: '1', ru: '1' },
  now_big: { pt: '2', en: '2', ru: '2' },
  text: { pt: 'um', en: 'one', ru: 'один' },
  kind: 'known',
  sources: [thenNowSource],
  ...over,
});
const withThenNow = (cards: unknown[]) => epochSchema.safeParse({ ...baseEpoch, mvp: false, years_label: { pt: 'séc. V', en: '5th century' }, then_now: cards });

test('then_now: exactly three cards, each with a kind and at least one source', () => {
  const three = [thenNowCard({ id: 'a' }), thenNowCard({ id: 'b' }), thenNowCard({ id: 'c' })];
  assert.equal(withThenNow(three).success, true);
  assert.equal(withThenNow(three.slice(0, 2)).success, false, 'two cards');
  assert.equal(withThenNow([...three, thenNowCard({ id: 'd' })]).success, false, 'four cards');
  assert.equal(withThenNow([thenNowCard({ id: 'a' }), thenNowCard({ id: 'b' }), thenNowCard({ id: 'c', sources: [] })]).success, false, 'no source');
  assert.equal(withThenNow([thenNowCard({ id: 'a' }), thenNowCard({ id: 'b' }), thenNowCard({ id: 'c', kind: undefined })]).success, false, 'no kind');
  assert.equal(withThenNow([thenNowCard({ id: 'a' }), thenNowCard({ id: 'b' }), thenNowCard({ id: 'c', kind: 'rumour' })]).success, false, 'a kind that is not known');
  assert.equal(withThenNow([thenNowCard({ id: 'a' }), thenNowCard({ id: 'a' }), thenNowCard({ id: 'c' })]).success, false, 'the same id twice');
});

test('then_now: {n} and the hours go together', () => {
  const n = { pt: 'cerca de {n}', en: 'about {n}', ru: 'около {n}' };
  const ok = (card: unknown) => withThenNow([card, thenNowCard({ id: 'b' }), thenNowCard({ id: 'c' })]).success;
  assert.equal(ok(thenNowCard({ text: n, then_hours: 40, now_hours: 2 })), true);
  assert.equal(ok(thenNowCard({ text: n })), false, '{n} without hours');
  assert.equal(ok(thenNowCard({ then_hours: 40, now_hours: 2 })), false, 'hours without {n}');
  assert.equal(ok(thenNowCard({ text: n, then_hours: 40 })), false, 'one of the two hours');
  assert.equal(ok(thenNowCard({ text: { pt: 'cerca de {n}', en: 'about', ru: 'около {n}' }, then_hours: 40, now_hours: 2 })), false, '{n} in one language only');
  assert.equal(ok(thenNowCard({ text: n, then_hours: 0, now_hours: 2 })), false, 'zero hours');
});

test('epochSchema: intro is optional, any language may be left out, a typo in a language key is an error', () => {
  const base = { ...baseEpoch, mvp: false, years_label: { pt: 'séc. V', en: '5th century' } };
  assert.equal(epochSchema.safeParse(base).success, true);
  assert.equal(epochSchema.safeParse({ ...base, intro: { ru: 'Только по-русски.' } }).success, true);
  assert.equal(epochSchema.safeParse({ ...base, intro: { pt: 'a', en: 'b', ru: 'c' } }).success, true);
  assert.equal(epochSchema.safeParse({ ...base, intro: { pt: 'a', fr: 'b' } }).success, false);
});

// ---- schema.org markup needs: the publication date and the coordinates of the bridge place ----
test('published: required (YYYY-MM-DD); updated optional; the bridge needs coordinates', () => {
  const ok = sample();
  assert.equal(eventSchema.safeParse(ok).success, true);
  const { published: _p, ...noPublished } = ok;
  assert.equal(eventSchema.safeParse(noPublished).success, false);
  assert.equal(eventSchema.safeParse({ ...ok, published: '21.10.2026' }).success, false);
  assert.equal(eventSchema.safeParse({ ...ok, updated: '2026-11-02' }).success, true);
  assert.equal(eventSchema.safeParse({ ...ok, updated: 'yesterday' }).success, false);
  const { lat: _a, ...noLat } = ok.bridge;
  assert.equal(eventSchema.safeParse({ ...ok, bridge: noLat }).success, false);
});
