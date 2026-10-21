import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareChronological,
  distanceKm,
  cardNeighbours,
  firstSentence,
  formatDate,
  formatYear,
  isFlashMoment,
  relatedCards,
  type EventData,
} from '../src/lib/events';

// Synthetic events: only the fields the helpers read are filled in.
function ev(id: string, patch: Partial<EventData> = {}): EventData {
  return {
    id,
    epoch: 'e1',
    year: 1500,
    status: 'ready',
    place: { name: 'Somewhere', lat: 38.7, lon: -9.1 },
    ...patch,
  } as EventData;
}

test('formatYear: label, single year, range', () => {
  assert.equal(formatYear({ year: 1385 }, 'pt'), '1385');
  assert.equal(formatYear({ year: { from: 1385, to: 1390 } }, 'en'), '1385\u20131390');
  assert.equal(formatYear({ year: { from: 1500, to: 1500 } }, 'en'), '1500');
  assert.equal(formatYear({ year: 1500, year_label: { pt: 'por volta de 1500', en: 'around 1500' } }, 'en'), 'around 1500');
});

test('chronological order uses start year, end year, then id', () => {
  const list = [ev('c', { year: 1500 }), ev('b', { year: { from: 1400, to: 1450 } }), ev('a', { year: { from: 1400, to: 1410 } }), ev('d', { year: 1500 })];
  assert.deepEqual(list.sort(compareChronological).map((e) => e.id), ['a', 'b', 'c', 'd']);
});

test('cardNeighbours: ends are null, other epochs and drafts are skipped', () => {
  const all = [
    ev('a', { year: 1400 }),
    ev('b', { year: 1410 }),
    ev('x', { year: 1415, epoch: 'e2' }),
    ev('draft', { year: 1420, status: 'draft' }),
    ev('c', { year: 1430 }),
  ];
  assert.deepEqual(cardNeighbours(all[0]!, all), { prev: null, next: all[1] });
  assert.equal(cardNeighbours(all[1]!, all).prev?.id, 'a');
  assert.equal(cardNeighbours(all[1]!, all).next?.id, 'c');
  assert.equal(cardNeighbours(all[4]!, all).next, null);
  assert.deepEqual(cardNeighbours(ev('ghost'), all), { prev: null, next: null });
});

test('distanceKm: Lisbon to Porto is about 274 km', () => {
  const km = distanceKm({ lat: 38.7223, lon: -9.1393 }, { lat: 41.1579, lon: -8.6291 });
  assert.ok(km > 265 && km < 285, `got ${km}`);
  assert.equal(distanceKm({ lat: 1, lon: 1 }, { lat: 1, lon: 1 }), 0);
});

test('relatedCards: manual links first, then nearest, never itself, at most 7', () => {
  const near = (id: string, dLat: number, patch: Partial<EventData> = {}) =>
    ev(id, { place: { name: id, lat: 38.7 + dLat, lon: -9.1 }, ...patch });
  const me = near('me', 0, { related: ['far', 'missing', 'draft', 'far'] });
  const all = [
    me,
    near('far', 2),
    near('n1', 0.01),
    near('n2', 0.02),
    near('n3', 0.03),
    near('n4', 0.04),
    near('n5', 0.05),
    near('n6', 0.06),
    near('n7', 0.07),
    near('draft', 0.001, { status: 'draft' }),
  ];
  const result = relatedCards(me, all).map((e) => e.id);
  assert.deepEqual(result, ['far', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']);
  assert.equal(result.length, 7);
  assert.ok(!result.includes('me') && !result.includes('draft') && !result.includes('missing'));
});

test('relatedCards: equal distance prefers the same epoch; allowed() filters (family mode hook)', () => {
  const me = ev('me');
  const other = ev('other', { epoch: 'e2', year: 1400 });
  const same = ev('same', { epoch: 'e1', year: 1600 });
  assert.deepEqual(relatedCards(me, [me, other, same]).map((e) => e.id), ['same', 'other']);
  assert.deepEqual(relatedCards(me, [me, other, same], { allowed: (e) => e.id !== 'same' }).map((e) => e.id), ['other']);
  assert.deepEqual(relatedCards(me, [me]), []);
});

test('firstSentence: plain, punctuation, abbreviations, long text', () => {
  assert.equal(firstSentence('Primeira frase. Segunda frase.'), 'Primeira frase.');
  assert.equal(firstSentence('Is it true? Yes. Maybe.'), 'Is it true?');
  assert.equal(firstSentence('Sem ponto final'), 'Sem ponto final');
  assert.equal(firstSentence('  Muito   espaço\n aqui.  Outra. '), 'Muito espaço aqui.');
  // abbreviations and lower-case continuation do not end the sentence
  assert.equal(firstSentence('D. João visitou o séc. xv em Lisboa. Depois partiu.'), 'D. João visitou o séc. xv em Lisboa.');
  assert.equal(firstSentence('O Dr. Silva chegou. Fim.'), 'O Dr. Silva chegou.');
  // decimals have no space after the stop
  assert.equal(firstSentence('Mediu 1.5 metros. Fim.'), 'Mediu 1.5 metros.');
  const long = `${'palavra '.repeat(60)}fim.`;
  const cut = firstSentence(long, 100);
  assert.ok(cut.length <= 100 && cut.endsWith('\u2026'), cut);
});

test('formatDate: stored day does not shift, language-specific', () => {
  const day = new Date('2026-10-13');
  assert.match(formatDate(day, 'en'), /13 October 2026/);
  assert.match(formatDate(day, 'pt'), /13 de outubro de 2026/);
});

test('isFlashMoment: only the Estado Novo cards that begin in 1974', () => {
  const E = 'estado-novo-e-25-de-abril';
  assert.equal(isFlashMoment({ epoch: E, year: 1974 }), true);
  assert.equal(isFlashMoment({ epoch: E, year: { from: 1974, to: 1975 } }), true);
  assert.equal(isFlashMoment({ epoch: E, year: { from: 1933, to: 1974 } }), false);
  assert.equal(isFlashMoment({ epoch: E, year: 1961 }), false);
  assert.equal(isFlashMoment({ epoch: 'avis-e-descobrimentos', year: 1974 }), false);
});
