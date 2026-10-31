import { test } from 'node:test';
import assert from 'node:assert/strict';
import { has, plural, pluralCategory, pluralForms } from '../src/i18n';
import { LOCALES } from '../src/i18n/routes';
import { pickPlural } from '../src/lib/plural-pick';
import pt from '../src/i18n/pt.json';
import en from '../src/i18n/en.json';
import ru from '../src/i18n/ru.json';

// Every counter of the site declines through Intl.PluralRules: one, few, many in Russian; one, other in Portuguese and English.
const COUNTS = [1, 2, 5, 11, 21, 22, 25];

test('Russian categories: 1 and 21 one; 2 and 22 few; 5, 11 and 25 many', () => {
  assert.deepEqual(COUNTS.map((n) => pluralCategory('ru', n)), ['one', 'few', 'many', 'many', 'one', 'few', 'many']);
});

test('Russian counters: 1, 2, 5, 11, 21, 22, 25', () => {
  const words = (one: string, few: string, many: string) => [one, few, many, many, one, few, many];
  const table: Record<string, string[]> = {
    'plural.stories': words('история', 'истории', 'историй'),
    'plural.new_stories': words('новая история', 'новые истории', 'новых историй'),
    'plural.new_epochs': words('новая эпоха', 'новые эпохи', 'новых эпох'),
    'plural.then_now_more': words('Ещё {n} сравнение', 'Ещё {n} сравнения', 'Ещё {n} сравнений'),
    'plural.epochs_more': words('Ещё {n} эпоха в работе', 'Ещё {n} эпохи в работе', 'Ещё {n} эпох в работе'),
  };
  for (const [key, forms] of Object.entries(table)) {
    COUNTS.forEach((n, i) => {
      const want = forms[i]!.includes('{n}') ? forms[i]!.replace('{n}', String(n)) : `${n} ${forms[i]}`;
      assert.equal(plural('ru', key, n), want, `${key} for ${n}`);
    });
  }
  // "+N new": the plus stays, the adjective agrees.
  assert.deepEqual(COUNTS.map((n) => plural('ru', 'plural.new_plus', n)), ['+1 новая', '+2 новые', '+5 новых', '+11 новых', '+21 новая', '+22 новые', '+25 новых']);
  // "read N of M" does not change in Russian.
  assert.deepEqual(COUNTS.map((n) => plural('ru', 'plural.read_progress', n).replace('{m}', '30')), COUNTS.map((n) => `прочитано ${n} из 30`));
});

test('Portuguese and English: one for 1, other for the rest ("lida 1 de 11", "lidas 2 de 11")', () => {
  assert.equal(plural('pt', 'plural.stories', 1), '1 história');
  assert.equal(plural('pt', 'plural.stories', 2), '2 histórias');
  assert.equal(plural('pt', 'plural.new_stories', 1), '1 história nova');
  assert.equal(plural('pt', 'plural.new_stories', 21), '21 histórias novas');
  assert.equal(plural('pt', 'plural.new_plus', 1), '+1 nova');
  assert.equal(plural('pt', 'plural.read_progress', 1).replace('{m}', '11'), 'lida 1 de 11');
  assert.equal(plural('pt', 'plural.read_progress', 2).replace('{m}', '11'), 'lidas 2 de 11');
  assert.equal(plural('pt', 'plural.then_now_more', 1), 'Mais 1 comparação');
  assert.equal(plural('en', 'plural.stories', 1), '1 story');
  assert.equal(plural('en', 'plural.stories', 21), '21 stories');
  assert.equal(plural('en', 'plural.new_epochs', 1), '1 new era');
  assert.equal(plural('en', 'plural.then_now_more', 2), '2 more comparisons');
  assert.equal(plural('en', 'plural.read_progress', 3).replace('{m}', '9'), 'read 3 of 9');
});

test('the browser helper gives the same text as the page builder, in every language', () => {
  for (const lang of ['pt', 'en', 'ru'] as const) {
    for (const key of ['plural.stories', 'plural.new_stories', 'plural.new_plus', 'plural.new_epochs', 'plural.then_now_more']) {
      const forms = Object.fromEntries(Object.entries(pluralForms(lang, key)).map(([c, text]) => [`p_${c}`, text]));
      for (const n of [0, ...COUNTS, 100, 101, 111]) assert.equal(pickPlural(forms, 'p', n, LOCALES[lang]).replace('{n}', String(n)), plural(lang, key, n), `${lang} ${key} ${n}`);
    }
  }
});

type Dictionary = Record<string, unknown>;
const flat = (o: Dictionary, prefix = ''): [string, string][] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? flat(v as Dictionary, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)] as [string, string]]));

test('every plural string has all the forms of its language (ru: one, few, many, other; pt and en: one, other)', () => {
  for (const [lang, dict, needed] of [['pt', pt, ['one', 'other']], ['en', en, ['one', 'other']], ['ru', ru, ['one', 'few', 'many', 'other']]] as const) {
    const bases = new Set(flat(dict as Dictionary).map(([k]) => k).filter((k) => /_(one|few|many|other)$/.test(k)).map((k) => k.replace(/_(one|few|many|other)$/, '')));
    assert.ok(bases.size > 0);
    for (const base of bases) for (const category of needed) assert.ok(has(lang, `${base}_${category}`), `${lang}: ${base}_${category} is missing`);
  }
});

test('a string with {n} or {m} that is not a plural string is a unit or a bare figure (nothing to decline)', () => {
  // The number is followed by a unit (m, km), a year era, or stands after a colon: the word does not change with it.
  const bare = new Set(['card.year_bc', 'card.nearby_m', 'card.nearby_km', 'map.dist_m', 'map.dist_km', 'family.hidden']);
  for (const [lang, dict] of [['pt', pt], ['en', en], ['ru', ru]] as const) {
    for (const [key, text] of flat(dict as Dictionary)) {
      if (!/\{[nm]\}/.test(text) || /_(one|few|many|other)$/.test(key)) continue;
      assert.ok(bare.has(key), `${lang}: ${key} has a number but is not a plural string ("${text}")`);
    }
  }
});
