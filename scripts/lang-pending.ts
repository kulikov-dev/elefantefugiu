// What is not read yet by a language editor, or changed after it was read (docs/language-review/). Usage: npm run lang:pending
// For a unit that changed after it was read, the keys (fields) that changed are listed when the mark has a per-field record (units kept in
// reviewed.json: epochs, threads, static pages, interface strings; `lang-mark --fields` adds the record to the marks that are still valid);
// for a story the YAML file and `git diff` tell. The last line counts the units of every kind, so a kind that drops out is seen.
import { collectTexts, units } from './lib/lang-texts';
import { pending } from './lib/lang-review';

const kinds = new Map<string, Set<string>>();
for (const { unit } of units(collectTexts())) {
  const kind = unit.split('/')[0]!;
  kinds.set(kind, (kinds.get(kind) ?? new Set()).add(unit));
}
const list = pending();
if (list.length === 0) {
  console.log('Nothing is pending: every text was read and has not changed since.');
} else {
  const byUnit = new Map<string, string[]>();
  for (const p of list) {
    const keys = p.changed === undefined ? '' : p.changed.length ? `: ${p.changed.join(', ')}` : ': no key (the text only moved)';
    byUnit.set(p.unit, [...(byUnit.get(p.unit) ?? []), `${p.lang} (${p.why}${keys})`]);
  }
  console.log(`${byUnit.size} unit(s) to read:`);
  for (const [unit, what] of byUnit) console.log(`- ${unit}: ${what.join(', ')}`);
}
console.log(`Units seen: ${[...kinds].map(([k, v]) => `${k} ${v.size}`).join(', ')}.`);
