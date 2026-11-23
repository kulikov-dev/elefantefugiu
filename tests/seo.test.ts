// The search title and description (src/lib/seo.ts): the template, the shortening order, the story's own `seo`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epochSeoDescription, epochSeoTitle, firstSentence, hookHasName, storySeoDescription, storySeoTitle } from '../src/lib/seo.ts';

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
  assert.equal(storySeoDescription(story(), 'pt', 'Época'), 'O rei pôs um rinoceronte contra um elefante. Torre de Belém.');
  assert.equal(storySeoDescription(story(), 'en', 'Era'), 'The king set a rhino against an elephant. Torre de Belém.');
  assert.equal(storySeoDescription(story(), 'ru', 'Эпоха'), 'Король стравил носорога со слоном. Torre de Belém.');
});

test('a description that does not fit keeps the name and the hook and drops the sentence', () => {
  const hook = 'Um gancho de cento e vinte caracteres, escrito para ocupar quase todo o espaço que a pesquisa deixa a um resumo de página.';
  const d = storySeoDescription(story({ hook: text(hook) }), 'pt', 'Época');
  assert.ok(d.length <= 155);
  assert.ok(d.startsWith('O rinoceronte e o elefante. Um gancho'));
  assert.ok(d.includes(hook));
  assert.ok(!d.endsWith('Torre de Belém.'));
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

test('the own `seo.title` of an epoch replaces the template', () => {
  const epoch = { name: text('Prólogo'), years_label: text('há 170 milhões de anos'), seo: { title: text('Dinossauros em Portugal: antes da história') } };
  assert.equal(epochSeoTitle(epoch as never, 'pt'), 'Dinossauros em Portugal: antes da história');
});

test('a hook without the name of the story: the description starts with the name', () => {
  const rome = story({
    title: text('Roma não paga a traidores', 'Rome Doesn’t Pay Traitors', 'Рим не платит предателям'),
    hook: text('Roma não conseguiu vencer o pastor. Então comprou os amigos dele.', 'Rome could not beat the shepherd. So it bought his friends.', 'Победить пастуха Рим не смог. Тогда он подкупил его друзей.'),
  });
  assert.equal(storySeoDescription(rome, 'ru', 'Эпоха'), 'Рим не платит предателям. Победить пастуха Рим не смог. Тогда он подкупил его друзей. Torre de Belém.');
  assert.ok(storySeoDescription(rome, 'pt', 'Época').startsWith('Roma não paga a traidores. Roma não conseguiu'));
  // The sentence about the place goes first when it does not fit; the name and the hook stay.
  const long = story({ title: text('Roma não paga a traidores'), hook: text('Roma não conseguiu vencer o pastor durante oito anos de guerra nas serras. Então comprou os amigos dele, um por um, com promessas.') });
  const d = storySeoDescription(long, 'pt', 'Época');
  assert.ok(d.length <= 155);
  assert.ok(d.startsWith('Roma não paga a traidores. Roma não conseguiu'));
  assert.ok(!d.endsWith('Torre de Belém.'));
  // The name of a question stays as it is (no extra full stop).
  assert.ok(storySeoDescription(story({ title: text('Quem matou Viriato?'), hook: text('Três amigos.') }), 'pt', 'Época').startsWith('Quem matou Viriato? Três amigos.'));
});

test('the name is "in" the hook when its main words are (by the first five letters), or all of it', () => {
  assert.equal(hookHasName('Рим не платит предателям', 'Рим не платит предателям, говорили римляне.'), true);
  assert.equal(hookHasName('Рим не платит предателям', 'Победить пастуха Рим не смог. Тогда он подкупил его друзей.'), false);
  assert.equal(hookHasName('Носорог и слон', 'Король стравил носорога со слоном.'), true);
  assert.equal(hookHasName('O cabo do medo', 'Há um cabo no fim do mundo.'), false);
});

test('the first sentence skips a full stop after a short word or an abbreviation', () => {
  assert.equal(firstSentence('Alfama é o bairro mais antigo de Lisboa. O terramoto poupou-a.'), 'Alfama é o bairro mais antigo de Lisboa.');
  assert.equal(firstSentence('Em 139 a. C. Roma comprou os amigos do pastor. Depois veio a estrada.'), 'Em 139 a. C. Roma comprou os amigos do pastor.');
  assert.equal(firstSentence('Um só período sem ponto final'), 'Um só período sem ponto final');
  assert.ok(firstSentence('palavra '.repeat(40), 60).length <= 60);
});

test('an epoch description: its own, else the first sentence of the introduction, else the theme', () => {
  const base = { name: text('Lusitânia e Roma'), theme: text('Viriato, estradas e latim') };
  assert.equal(epochSeoDescription({ ...base, description: text('Um texto próprio.') } as never, 'pt'), 'Um texto próprio.');
  assert.equal(epochSeoDescription({ ...base, intro: text('Roma não venceu o pastor. Comprou os amigos.') } as never, 'pt'), 'Roma não venceu o pastor.');
  assert.equal(epochSeoDescription(base as never, 'pt'), 'Viriato, estradas e latim');
});
