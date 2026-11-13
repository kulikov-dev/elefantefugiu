// The table of the search titles and descriptions of every ready story, in pt, en and ru: the old title ("{name} · site"), the new one, the description, the lengths.
//   npx tsx scripts/seo-table.ts [out.md]    default: docs/seo-titles.md; the text under a line `<!-- manual -->` is kept; the text under a line `<!-- manual -->` is kept
// A line over the limits (title 65, description 160) is marked; the rest is for a human eye: the owner marks the lines that sound crooked and we write `seo` for them.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEO_LANGS, seoLines } from './lib/seo-lines';
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from '../src/lib/seo';

const out = process.argv[2] ?? fileURLToPath(new URL('../docs/seo-titles.md', import.meta.url));
const cell = (s: string) => s.replace(/\|/g, '\|');
const stories = seoLines().filter((s) => s.raw.status === 'ready').sort((a, b) => a.raw.epoch.localeCompare(b.raw.epoch) || a.id.localeCompare(b.id));

const md: string[] = [
  '# Поисковые title и description историй',
  '',
  'Сгенерировано `npx tsx scripts/seo-table.ts` по шаблону `src/lib/seo.ts`. Видимые названия, крючки, og:*, twitter:*, JSON-LD, RSS и лента не меняются.',
  '',
  `Лимиты: title ≤ ${SEO_TITLE_MAX}, description ≤ ${SEO_DESCRIPTION_MAX}. Столбец «seo» = у истории уже есть своя замена. Старый title был «{название} · O Elefante Fugiu», старый description — первое предложение текста.`,
  '',
];
for (const lang of SEO_LANGS) {
  const rows = stories.filter((s) => lang !== 'ru' || s.raw.ru_ready === true);
  md.push(`## ${lang} (${rows.length})`, '', '| история | старый title | новый title | дл. | description | дл. | seo |', '|---|---|---|---|---|---|---|');
  for (const s of rows) {
    const { title, description, own } = s.lines[lang];
    const old = `${s.event.title[lang]} · O Elefante Fugiu`;
    const flag = (n: number, max: number) => (n > max ? `**${n}!**` : String(n));
    md.push(`| ${s.slug} | ${cell(old)} | ${cell(title)} | ${flag(title.length, SEO_TITLE_MAX)} | ${cell(description)} | ${flag(description.length, SEO_DESCRIPTION_MAX)} | ${own ? 'да' : ''} |`);
  }
  md.push('');
}
// What stands under the marker (the notes of the owner's review: crooked lines and `seo` proposals) is kept when the table is made again.
const MARKER = '<!-- manual -->';
const old = existsSync(out) ? readFileSync(out, 'utf8') : '';
const manual = old.includes(MARKER) ? old.slice(old.indexOf(MARKER)) : '';
writeFileSync(out, md.join('\n') + (manual ? `\n${manual}` : ''));
console.log(`${out}: ${stories.length} stories`);
