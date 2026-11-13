// The search title and description (src/lib/seo.ts): the template, the shortening order, the story's own `seo`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epochSeoTitle, storySeoDescription, storySeoTitle } from '../src/lib/seo.ts';

const text = (pt: string, en = pt, ru = en) => ({ pt, en, ru });
const story = (over: Record<string, unknown> = {}) =>
  ({
    title: text('O rinoceronte e o elefante', 'The Rhino and the Elephant', 'Носорог и слон'),
    hook: text('O rei pôs um rinoceronte contra um elefante.', 'The king set a rhino against an elephant', 'Король стравил носорога со слоном.'),
    year: 1515,
    place: { name: text('Lisboa, Ribeira'), lat: 0, lon: 0 },
    bridge: { name: 'Torre de Belém', address: '', lat: 0, lon: 0, url: '', note: text('') },
    ...over,
  }) as never;

test('a story title is "name · place, year | site"', () => {
  assert.equal(storySeoTitle(story({ title: text('O cabo do medo') }), 'pt'), 'O cabo do medo · Torre de Belém, 1515 | O Elefante Fugiu');
  assert.equal(storySeoTitle(story(), 'pt'), 'O rinoceronte e o elefante · Torre de Belém, 1515');
});

test('too long: the site goes first, then the year; the name is never cut', () => {
  const long = story({ title: text('Um nome de história bastante comprido para o título') });
  // The place of the bridge does not fit, the place of the event does.
  assert.equal(storySeoTitle(long, 'pt'), 'Um nome de história bastante comprido para o título · Lisboa');
  const huge = story({ title: text('Um nome de história tão comprido que nem sequer cabe sozinho num título de busca normal') });
  assert.equal(storySeoTitle(huge, 'pt'), 'Um nome de história tão comprido que nem sequer cabe sozinho num título de busca normal');
});

test('a place that is in the name already is not repeated', () => {
  const title = storySeoTitle(story({ title: text('A Torre de Belém') }), 'pt');
  assert.equal(title.match(/Torre de Belém/g)?.length, 1);
});

test('the place of the event is the fallback of a long bridge name', () => {
  const s = story({ bridge: { name: 'Centro de Interpretação do Abrigo do Lagar Velho', address: '', lat: 0, lon: 0, url: '', note: text('') }, place: { name: text('Vale do Lapedo, Leiria'), lat: 0, lon: 0 }, title: text('A criança que ainda divide os cientistas') });
  assert.equal(storySeoTitle(s, 'pt'), 'A criança que ainda divide os cientistas · Vale do Lapedo');
});

test('the description is the hook and one sentence about the place, in each language', () => {
  assert.equal(storySeoDescription(story(), 'pt', 'Época'), 'O rei pôs um rinoceronte contra um elefante. Hoje pode visitar o local: Torre de Belém.');
  assert.equal(storySeoDescription(story(), 'en', 'Era'), 'The king set a rhino against an elephant. Today you can visit the place: Torre de Belém.');
  assert.equal(storySeoDescription(story(), 'ru', 'Эпоха'), 'Король стравил носорога со слоном. Сегодня это место можно увидеть: Торре-де-Белен.'.replace('Торре-де-Белен', 'Torre de Belém'));
});

test('a description that does not fit keeps the hook and drops the sentence', () => {
  const hook = 'Um gancho de cento e vinte caracteres, escrito para ocupar quase todo o espaço que a pesquisa deixa a um resumo de página.';
  const d = storySeoDescription(story({ hook: text(hook) }), 'pt', 'Época');
  assert.ok(d.length <= 155);
  assert.ok(d.startsWith(hook));
});

test('the story\'s own `seo` replaces the template, per language and per field', () => {
  const s = story({ seo: { title: { pt: 'Torre de Belém: rinoceronte de 1515', en: 'Belém Tower rhino, 1515' } } });
  assert.equal(storySeoTitle(s, 'pt'), 'Torre de Belém: rinoceronte de 1515');
  assert.match(storySeoDescription(s, 'pt', 'Época'), /^O rei pôs/);
});

test('an epoch title: "name (years): stories | site", shortened when long', () => {
  const epoch = { name: text('Avis e Descobrimentos'), years_label: text('1385–1580') };
  assert.equal(epochSeoTitle(epoch, 'pt'), 'Avis e Descobrimentos (1385–1580): histórias de Portugal');
  assert.equal(epochSeoTitle({ name: text('Avis'), years_label: text('1385–1580') }, 'pt'), 'Avis (1385–1580): histórias de Portugal | O Elefante Fugiu');
  const prologue = { name: text('Prólogo: dinossauros e pedras'), years_label: text('há 170 milhões de anos – séc. VI a.C.') };
  assert.ok(epochSeoTitle(prologue, 'pt').length <= 65);
});
