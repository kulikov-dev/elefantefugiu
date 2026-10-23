// Moves the introductions of the epochs from docs/epochs-intro.md into src/content/epochs.yaml (field `intro`, per language).
//   node scripts/import-epoch-intros.mjs           dry run: prints how each section is matched to an epoch, writes nothing
//   node scripts/import-epoch-intros.mjs --write   writes the texts (an existing `intro` is replaced)
// A section "## 4. Авис и Великие открытия · 1385–1580" is matched by its number (the `order` of the epoch) and checked against the
// Russian name and the years of that epoch; a section that does not match is reported and not written.
// The service part of the file (the section with the warning sign at the end) is not read.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const mdPath = `${root}docs/epochs-intro.md`;
const ymlPath = `${root}src/content/epochs.yaml`;
const write = process.argv.includes('--write');

const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/g, ' ').trim();
const yearsOf = (text) => (text.match(/\d{3,4}/g) ?? []).join('-');

const md = readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
// Only the numbered sections before the service part (the first heading that is not "## N. ...").
const sections = [];
for (const block of md.split(/^## /m).slice(1)) {
  const head = block.split('\n', 1)[0];
  const m = head.match(/^(\d+)\.\s+(.+?)\s+·\s+(.+)$/);
  if (!m) break;
  const text = (lang) => block.match(new RegExp(`^\\*\\*${lang}:\\*\\*\\s*(.+)$`, 'm'))?.[1]?.trim();
  sections.push({ n: Number(m[1]), name: m[2], years: m[3], intro: { pt: text('pt'), en: text('en'), ru: text('ru') } });
}

const doc = parseDocument(readFileSync(ymlPath, 'utf8'));
const epochs = doc.toJS();
let problems = 0;
for (const s of sections) {
  const index = epochs.findIndex((e) => e.order === s.n);
  const epoch = epochs[index];
  const missing = ['pt', 'en', 'ru'].filter((l) => !s.intro[l]);
  const label = epoch?.years_label?.ru ?? (epoch?.years ? `${epoch.years.from}-${epoch.years.to}` : '');
  const nameOk = epoch && norm(epoch.name.ru) === norm(s.name);
  const yearsOk = epoch && yearsOf(label) !== '' && yearsOf(label) === yearsOf(s.years);
  const ok = epoch && nameOk && missing.length === 0;
  if (!ok) problems += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${s.n}. ${s.name} (${s.years}) -> ${epoch ? `${epoch.id} (${epoch.name.ru}, ${label})` : 'no epoch with this order'}${nameOk ? '' : ' [name differs]'}${yearsOk ? '' : ' [years not compared or differ]'}${missing.length ? ` [no text for ${missing.join(', ')}]` : ''}`);
  if (ok && write) doc.setIn([index, 'intro'], doc.createNode(s.intro));
}
if (sections.length !== epochs.length) {
  problems += 1;
  console.log(`FAIL ${sections.length} sections in the file, ${epochs.length} epochs in the data`);
}
if (write) {
  if (problems > 0) {
    console.log('Nothing written: fix the problems above first.');
    process.exit(1);
  }
  writeFileSync(ymlPath, String(doc), 'utf8');
  console.log('Written to src/content/epochs.yaml');
} else {
  console.log(problems === 0 ? 'Dry run: all sections match. Run with --write to save.' : `Dry run: ${problems} problem(s).`);
}
