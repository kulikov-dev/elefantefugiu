// Prints a table of the addresses (slugs) of every page in English and Russian for the owner to read and confirm:
//   node scripts/export-addresses.mjs [--lang en|ru|all]
// Reads src/i18n/routes.ts for the static pages and src/content/*.yaml for epochs, threads and events.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const yaml = (p) => parse(readFileSync(join(root, p), 'utf8'), { schema: 'core', customTags: ['timestamp'] });

const routes = readFileSync(join(root, 'src/i18n/routes.ts'), 'utf8');
const row = (key) => {
  const m = routes.match(new RegExp(`\\n  ${key}: \\{ pt: '([^']*)', en: '([^']*)', ru: '([^']*)' \\}`));
  return { pt: m[1], en: m[2], ru: m[3] };
};
const seg = (name) => {
  const m = routes.match(new RegExp(`${name}: Record<Lang, string> = \\{ pt: '([^']*)', en: '([^']*)', ru: '([^']*)' \\}`));
  return { pt: m[1], en: m[2], ru: m[3] };
};
const path = (lang, ...parts) => `/${[lang, ...parts].filter(Boolean).join('/')}/`;

const out = [];
out.push('| Page | English address | Russian address |', '| --- | --- | --- |');
for (const [label, key] of [['Home', 'home'], ['Map', 'map'], ['About', 'about'], ['Method and sources', 'method'], ['Found a mistake?', 'report'], ['Legal information', 'legal']]) {
  const r = row(key);
  out.push(`| ${label} | \`${path('en', r.en)}\` | \`${path('ru', r.ru)}\` |`);
}
const [S, E, T] = [seg('STORY_SEGMENT'), seg('EPOCH_SEGMENT'), seg('THREAD_SEGMENT')];
out.push('', '| Epoch | English address | Russian address |', '| --- | --- | --- |');
for (const e of yaml('src/content/epochs.yaml').sort((a, b) => a.order - b.order)) {
  out.push(`| ${e.order}. ${e.name.en}${e.mvp ? ' (MVP)' : ' (soon, no page)'} | \`${path('en', E.en, e.slug.en)}\` | \`${path('ru', E.ru, e.slug.ru ?? e.slug.en)}\` |`);
}
out.push('', '| Thread | English address | Russian address |', '| --- | --- | --- |');
for (const t of yaml('src/content/threads.yaml')) out.push(`| ${t.name.en} | \`${path('en', T.en, t.slug.en)}\` | \`${path('ru', T.ru, t.slug.ru ?? t.slug.en)}\` |`);
out.push('', '| Event | English address | Russian address | Russian text |', '| --- | --- | --- | --- |');
const dir = join(root, 'src/content/events');
for (const n of readdirSync(dir).sort()) {
  const ev = yaml(`src/content/events/${n}`);
  out.push(`| ${ev.id} | \`${path('en', S.en, ev.slug.en)}\` | \`${path('ru', S.ru, ev.ru_ready ? ev.slug.ru : ev.slug.en)}\` | ${ev.ru_ready ? 'yes' : 'no (English text, banner)'} |`);
}
out.push('', `QR address of a card: \`/p/{event id}/\` (for example \`/p/${yaml('src/content/events/evento-exemplo-01.yaml').id}/\`).`);
console.log(out.join('\n'));
