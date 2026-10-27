// The inventory of every text read in the language review: docs/language-review/inventory.tsv (file, field, language, text).
// Usage: npx tsx scripts/lang-inventory.ts [dir]   with a directory also writes one plain-text file per language there
// (the input for a reader who must see only one language).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANG_LIST, collectTexts, root } from './lib/lang-texts';

const items = collectTexts();
const cell = (s: string) => s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ¶ ');
const rows = ['unit\tfile\tfield\tlang\ttext', ...items.map((i) => [i.unit, i.file, i.field, i.lang, cell(i.text)].join('\t'))];
writeFileSync(join(root, 'docs/language-review/inventory.tsv'), `${rows.join('\n')}\n`);
console.log(`${items.length} texts in docs/language-review/inventory.tsv`);

const dir = process.argv[2];
if (dir) {
  mkdirSync(dir, { recursive: true });
  for (const lang of LANG_LIST) {
    let out = '';
    let unit = '';
    for (const it of items.filter((i) => i.lang === lang)) {
      if (it.unit !== unit) {
        unit = it.unit;
        out += `\n\n=== ${unit} ===\n`;
      }
      out += `\n[${it.field}]\n${it.text}\n`;
    }
    writeFileSync(join(dir, `${lang}.txt`), out.trimStart());
  }
}
