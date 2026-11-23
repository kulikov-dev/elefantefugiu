// The table of the search descriptions of every ready story, in pt, en and ru: the description before the name was put first (hook + the place), the new one, the lengths.
//   npx tsx scripts/seo-descriptions.ts [out.md]    default: docs/seo-descriptions.md
// A line over the limit (160) is marked. Stories with their own `seo.description` are not changed by the template (column "seo").
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEO_LANGS, seoLines } from './lib/seo-lines';
import { SEO_DESCRIPTION_MAX } from '../src/lib/seo';

const out = process.argv[2] ?? fileURLToPath(new URL('../docs/seo-descriptions.md', import.meta.url));
const cell = (s: string) => s.replace(/\|/g, '\\|');
const flag = (n: number) => (n > SEO_DESCRIPTION_MAX ? `**${n}!**` : String(n));
const stories = seoLines().filter((s) => s.raw.status === 'ready').sort((a, b) => a.raw.epoch.localeCompare(b.raw.epoch) || a.id.localeCompare(b.id));

const md: string[] = [
  '# Поисковые description историй: было и стало',
  '',
  'Сгенерировано `npx tsx scripts/seo-descriptions.ts`. Шаблон `src/lib/seo.ts` (`storySeoDescription`): если в крючке нет названия истории (или его главных слов: слов от 4 букв, по первым 5 буквам), description начинается с названия: «{название}. {крючок} {место}.»; не влезает в 155 знаков, убирается предложение о месте, не крючок. Ручной `seo.description` не меняется. Крючок на странице, og:description, JSON-LD и RSS остаются как были.',
  '',
  `Лимит ${SEO_DESCRIPTION_MAX} знаков. «Было» — шаблон без названия и без вводной фразы о месте (не точная копия живого). «=» в столбце «стало» значит, что описание не изменилось (название уже есть в крючке или история с ручным seo).`,
  '',
];
const summary: string[] = [];
for (const lang of SEO_LANGS) {
  const rows = stories.filter((s) => lang !== 'ru' || s.raw.ru_ready === true);
  let changed = 0;
  let over = 0;
  const lines: string[] = [];
  for (const s of rows) {
    const { description, before, own } = s.lines[lang];
    const same = description === before;
    if (!same) changed += 1;
    if (description.length > SEO_DESCRIPTION_MAX) over += 1;
    lines.push(`| ${s.slug} | ${cell(before)} | ${flag(before.length)} | ${same ? '=' : cell(description)} | ${flag(description.length)} | ${own ? 'да' : ''} |`);
  }
  summary.push(`- ${lang}: ${rows.length} историй, изменилось ${changed}, длиннее ${SEO_DESCRIPTION_MAX}: ${over}`);
  md.push(`## ${lang} (${rows.length})`, '', '| история | было | дл. | стало | дл. | seo |', '|---|---|---|---|---|---|', ...lines, '');
}
md.splice(6, 0, ...summary, '');
writeFileSync(out, md.join('\n'));
console.log(`${out}\n${summary.join('\n')}`);
