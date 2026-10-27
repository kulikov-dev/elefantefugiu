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
  nearbyCards,
  placeShort,
  NEARBY_RADIUS_KM,
  MAX_NEARBY,
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
  } as unknown as EventData;
}

test('formatYear: label, single year, range', () => {
  assert.equal(formatYear({ year: 1385 }, 'pt'), '1385');
  assert.equal(formatYear({ year: { from: 1385, to: 1390 } }, 'en'), '1385\u20131390');
  assert.equal(formatYear({ year: { from: 1500, to: 1500 } }, 'en'), '1500');
  assert.equal(formatYear({ year: 1500, year_label: { pt: 'por volta de 1500', en: 'around 1500', ru: 'около 1500' } }, 'en'), 'around 1500');
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

const at = (id: string, dLat: number, patch: Partial<EventData> = {}) =>
  ev(id, { bridge: { name: id, address: '', url: '', lat: 38.7 + dLat, lon: -9.1, note: { pt: '', en: '', ru: '' } }, ...patch });

test('nearbyCards: only within the radius, nearest first, at most 3, never itself, drafts left out', () => {
  const me = at('me', 0);
  const all = [
    me,
    at('far', 2), // 220 km away
    at('n3', 0.03), // about 3.3 km
    at('n1', 0.01), // about 1.1 km
    at('n2', 0.02), // about 2.2 km
    at('n4', 0.04), // about 4.4 km
    at('draft', 0.001, { status: 'draft' }),
  ];
  const result = nearbyCards(me, all);
  assert.deepEqual(result.map((c) => c.event.id), ['n1', 'n2', 'n3']);
  assert.ok(result[0]!.km > 1 && result[0]!.km < 1.2, `got ${result[0]!.km}`);
  assert.ok(NEARBY_RADIUS_KM === 5 && MAX_NEARBY === 3);
});

test('nearbyCards: the edge of the radius, nothing around, a point far from everything', () => {
  const me = at('me', 0);
  assert.deepEqual(nearbyCards(me, [me, at('edge', 0.044), at('out', 0.046)]).map((c) => c.event.id), ['edge']);
  assert.deepEqual(nearbyCards(me, [me]), []);
  assert.deepEqual(nearbyCards(me, [me, at('porto', 2.4)]), []);
});

test('nearbyCards: equal distance prefers the same epoch; allowed() filters (family mode hook)', () => {
  const me = at('me', 0);
  const other = at('other', 0.01, { epoch: 'e2', year: 1400 });
  const same = at('same', 0.01, { epoch: 'e1', year: 1600 });
  assert.deepEqual(nearbyCards(me, [me, other, same]).map((c) => c.event.id), ['same', 'other']);
  assert.deepEqual(nearbyCards(me, [me, other, same], { allowed: (e) => e.id !== 'same' }).map((c) => c.event.id), ['other']);
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
  // a long sentence is cut at a clause (comma, colon, bracket) when one is late enough, not in the middle of a phrase
  assert.equal(firstSentence('Primeiro bloco da frase, segundo bloco da frase: terceiro bloco (quarto bloco muito comprido que não cabe aqui).', 60), 'Primeiro bloco da frase, segundo bloco da frase\u2026');
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

test('placeShort: the short name of the data in the language of the page, else the part before the first comma or bracket', () => {
  const place = { name: { pt: 'Lisboa, Paço da Ribeira (hoje Praça do Comércio)', en: 'Lisbon, Paço da Ribeira (now Praça do Comércio)', ru: 'Лиссабон, Пасу-да-Рибейра (ныне Праса-ду-Комерсиу)' } };
  assert.equal(placeShort(place, 'pt'), 'Lisboa');
  assert.equal(placeShort(place, 'ru'), 'Лиссабон');
  assert.equal(placeShort({ name: { pt: 'Malaca (Melaka), ponte sobre o rio', en: 'Malacca (Melaka), the bridge', ru: 'Малакка (Мелака), мост' } }, 'en'), 'Malacca');
  assert.equal(placeShort({ name: { pt: 'Vale do Douro (Alto Douro)', en: 'Douro Valley', ru: 'Долина Дору' } }, 'pt'), 'Vale do Douro');
  const withShort = { ...place, short: { pt: 'Lisboa', en: 'Lisbon', ru: 'Лиссабон' } };
  assert.equal(placeShort(withShort, 'ru'), 'Лиссабон');
  assert.equal(placeShort(withShort, 'en'), 'Lisbon');
  assert.equal(placeShort({ name: { pt: 'Porto', en: 'Porto', ru: 'Порту' } }, 'ru'), 'Порту');
});
