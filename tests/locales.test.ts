import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES } from '../src/i18n/routes';
import { formatDate, formatShortDate } from '../src/lib/events';

// The language tags of the site: European Portuguese, AMERICAN English (the whole site is written in en-US), Russian. They go into
// <html lang> (the short form), og:locale (pt_PT, en_US, ru_RU), the schema.org inLanguage, the plural rules and the date formats.
test('LOCALES: pt-PT, en-US, ru-RU (the English of the site is American, never en-GB)', () => {
  assert.deepEqual(LOCALES, { pt: 'pt-PT', en: 'en-US', ru: 'ru-RU' });
});

test('og:locale is made from the tag: pt_PT, en_US, ru_RU', () => {
  assert.deepEqual(Object.values(LOCALES).map((l) => l.replace('-', '_')), ['pt_PT', 'en_US', 'ru_RU']);
});

test('English dates are American: "October 13, 2026", short "10/13/2026"', () => {
  const day = new Date(Date.UTC(2026, 9, 13));
  assert.equal(formatDate(day, 'en'), 'October 13, 2026');
  assert.equal(formatShortDate(day, 'en'), '10/13/2026');
});
