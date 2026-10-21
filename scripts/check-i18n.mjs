// Fails when pt.json, en.json and ru.json differ in keys or contain empty strings.
// Plural keys: every language has `_one` and `_other`; Russian also has `_few` and `_many` (and only Russian may).
import { readFileSync } from 'node:fs';

const LANGS = ['pt', 'en', 'ru'];
/** Plural categories that exist only in some languages (Intl.PluralRules): other languages must not have them. */
const EXTRA = { ru: /_(few|many)$/ };

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
}

const load = (lang) => new Map(flatten(JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), 'utf8'))));
const dict = Object.fromEntries(LANGS.map((lang) => [lang, load(lang)]));
const errors = [];

/** The keys every language must have: those of pt.json (the plural categories of other languages are not counted). */
const base = [...dict.pt.keys()];
for (const lang of LANGS) {
  const map = dict[lang];
  for (const key of base) if (!map.has(key)) errors.push(`missing in ${lang}.json: ${key}`);
  for (const key of map.keys()) {
    if (dict.pt.has(key)) continue;
    const extra = EXTRA[lang]?.test(key) && map.has(key.replace(/_(few|many)$/, '_other'));
    if (!extra) errors.push(`${key} is in ${lang}.json but not in pt.json`);
  }
  for (const [key, value] of map) if (typeof value !== 'string' || value.trim() === '') errors.push(`empty value in ${lang}.json: ${key}`);
}
// A language that has _few or _many has the whole set (one, few, many, other).
for (const [key] of dict.ru) {
  const m = key.match(/^(.*)_(few|many)$/);
  if (m) for (const c of ['one', 'few', 'many', 'other']) if (!dict.ru.has(`${m[1]}_${c}`)) errors.push(`ru.json: ${m[1]} has no _${c}`);
}
// Placeholders such as {n} or {mode} must be the same in every language.
const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const key of base) {
  if (!dict.en.has(key) || !dict.ru.has(key)) continue;
  for (const lang of ['en', 'ru']) {
    if (holes(dict.pt.get(key)) !== holes(dict[lang].get(key))) errors.push(`placeholders of ${key} differ in ${lang}.json (${holes(dict[lang].get(key))}) and pt.json (${holes(dict.pt.get(key))})`);
  }
}

if (errors.length > 0) {
  console.error(`i18n check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`i18n check passed (${dict.pt.size} keys in pt and en, ${dict.ru.size} in ru).`);
