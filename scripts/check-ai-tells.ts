// Habits of machine-written text in the stories, epochs and threads (docs/style-ai-tells.md, rules in scripts/lang-rules.json, section ai_tells).
// WARNINGS only: the exit code is always 0 and the build never stops here. The cure for a warning is a concrete name, number or detail from
// the sources of the card, not another adjective. No AI detector is used (they are unreliable): the check names the habit and the place.
// Usage: npm run check:ai-tells   (part of npm test: one summary line)  /  npm run check:ai-tells -- --verbose [--unit event/hanno-1514]
import { collectTexts } from './lib/lang-texts';
import { aiRules, analyze } from './lib/ai-tells';

const only = process.argv.includes('--unit') ? process.argv[process.argv.indexOf('--unit') + 1] : undefined;
const verbose = process.argv.includes('--verbose');

// Every allow entry says why: a bare exception is not an exception.
for (const a of aiRules.allow) if (!a.why?.trim()) throw new Error(`ai_tells.allow: the entry for "${a.match}" has no "why"`);

const fieldsOf = (unit: string): string[] | undefined => aiRules.fields[unit.split('/')[0] as 'event' | 'epoch' | 'thread'];

const lines: string[] = [];
const perUnit = new Map<string, number>();
for (const it of collectTexts()) {
  const fields = fieldsOf(it.unit);
  if (!fields || !fields.includes(it.field)) continue;
  if (only && it.unit !== only) continue;
  for (const w of analyze(it.lang, it.text, { unit: it.unit, field: it.field })) {
    lines.push(`- ${it.unit} ${it.lang} [${it.field}] ${w.kind}: «${w.fragment}»: ${w.hint}`);
    perUnit.set(it.unit, (perUnit.get(it.unit) ?? 0) + 1);
  }
}

if (lines.length === 0) {
  console.log('check:ai-tells: no warnings (stories, epochs and threads).');
} else {
  if (verbose) {
    console.log(`check:ai-tells: ${lines.length} warning(s), not errors (docs/style-ai-tells.md):`);
    for (const line of lines) console.log(line);
    const summary = [...perUnit].sort((a, b) => b[1] - a[1]).map(([unit, n]) => `${unit.replace(/^event\//, '')} ${n}`);
    console.log(`check:ai-tells: per text: ${summary.join(', ')}.`);
  } else {
    console.log(`ai-tells: ${lines.length} предупреждений (не ошибки), подробно: npm run check:ai-tells -- --verbose`);
  }
}
