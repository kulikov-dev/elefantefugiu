// Fails when pt.json and en.json differ in keys or contain empty strings.
import { readFileSync } from 'node:fs';

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
}

const load = (lang) => new Map(flatten(JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), 'utf8'))));
const pt = load('pt');
const en = load('en');
const errors = [];

for (const key of pt.keys()) if (!en.has(key)) errors.push(`missing in en.json: ${key}`);
for (const key of en.keys()) if (!pt.has(key)) errors.push(`missing in pt.json: ${key}`);
for (const [lang, map] of [['pt', pt], ['en', en]]) {
  for (const [key, value] of map) if (typeof value !== 'string' || value.trim() === '') errors.push(`empty value in ${lang}.json: ${key}`);
}

if (errors.length > 0) {
  console.error(`i18n check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`i18n check passed (${pt.size} keys per language).`);
