// What is not read yet by a language editor, or changed after it was read (docs/language-review/). Usage: npm run lang:pending
import { pending } from './lib/lang-review';

const list = pending();
if (list.length === 0) {
  console.log('Nothing is pending: every text was read and has not changed since.');
} else {
  const byUnit = new Map<string, string[]>();
  for (const p of list) byUnit.set(p.unit, [...(byUnit.get(p.unit) ?? []), `${p.lang} (${p.why})`]);
  console.log(`${byUnit.size} unit(s) to read:`);
  for (const [unit, what] of byUnit) console.log(`- ${unit}: ${what.join(', ')}`);
}
