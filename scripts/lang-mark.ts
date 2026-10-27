// Marks texts as read: stores the date and the hash of the text of a language (lang_review in the story file, reviewed.json for the rest).
// Run it only after the corrections of that language are committed.
// Usage: npx tsx scripts/lang-mark.ts <pt|en|ru|all> [unit-prefix ...] [--date=YYYY-MM-DD]
import { LANG_LIST, type TextLang } from './lib/lang-texts';
import { mark } from './lib/lang-review';

const args = process.argv.slice(2);
const date = args.find((a) => a.startsWith('--date='))?.slice('--date='.length) ?? new Date().toISOString().slice(0, 10);
const [which, ...prefixes] = args.filter((a) => !a.startsWith('--'));
if (!which || (which !== 'all' && !(LANG_LIST as readonly string[]).includes(which))) {
  console.error('Usage: lang-mark <pt|en|ru|all> [unit-prefix ...] [--date=YYYY-MM-DD]');
  process.exit(1);
}
const langs = which === 'all' ? [...LANG_LIST] : [which as TextLang];
const n = mark(langs, date, (unit) => prefixes.length === 0 || prefixes.some((p) => unit.startsWith(p)));
console.log(`Marked ${n} text(s) as read on ${date}.`);
