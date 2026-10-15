import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carriedQuery, withCarried } from '../src/lib/lang-params';

test('carriedQuery: keeps fio and vista, drops unknown parameters, stable order', () => {
  assert.equal(carriedQuery(''), '');
  assert.equal(carriedQuery('?fio=mar'), '?fio=mar');
  assert.equal(carriedQuery('?vista=grelha&fio=mar'), '?fio=mar&vista=grelha');
  assert.equal(carriedQuery('?utm=x&fio=mar'), '?fio=mar');
  assert.equal(carriedQuery('?utm=x'), '');
  assert.equal(carriedQuery('?fio='), '');
});

test('carriedQuery: map parameters travel too', () => {
  assert.equal(carriedQuery('?epoca=avis-e-descobrimentos&id=evento-exemplo-02'), '?epoca=avis-e-descobrimentos&id=evento-exemplo-02');
});

test('withCarried: replaces the query, keeps path and hash', () => {
  assert.equal(withCarried('/en/era/x/', '?fio=mar&vista=grelha'), '/en/era/x/?fio=mar&vista=grelha');
  assert.equal(withCarried('/en/era/x/?old=1', '?fio=mar'), '/en/era/x/?fio=mar');
  assert.equal(withCarried('/en/era/x/#c-a', '?fio=mar'), '/en/era/x/?fio=mar#c-a');
  assert.equal(withCarried('/en/era/x/?fio=mar', ''), '/en/era/x/');
});
