// Prints a PT / EN table of all interface strings for review by a native speaker.
// Usage: npm run export:ui-table [-- --format csv] [-- --out ui-table.md]
// Source of truth: src/i18n/pt.json and src/i18n/en.json (keys are checked by check-i18n.mjs).
import { readFileSync, writeFileSync } from 'node:fs';

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
}
const load = (lang) => new Map(flatten(JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), 'utf8'))));

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const format = option('format', 'md');
const out = option('out', '');
if (!['md', 'csv'].includes(format)) {
  console.error(`Unknown --format "${format}", use md or csv.`);
  process.exit(1);
}

const pt = load('pt');
const en = load('en');
const keys = [...new Set([...pt.keys(), ...en.keys()])];

const mdCell = (s = '') => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const csvCell = (s = '') => `"${String(s).replace(/"/g, '""')}"`;

const lines =
  format === 'md'
    ? [
        '| Key | PT (European Portuguese) | EN |',
        '| --- | --- | --- |',
        ...keys.map((k) => `| \`${k}\` | ${mdCell(pt.get(k))} | ${mdCell(en.get(k))} |`),
      ]
    : ['key,pt,en', ...keys.map((k) => [k, pt.get(k), en.get(k)].map(csvCell).join(','))];

const text = `${lines.join('\n')}\n`;
if (out) {
  writeFileSync(out, text);
  console.error(`Wrote ${keys.length} strings to ${out}`);
} else {
  process.stdout.write(text);
}
