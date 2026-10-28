// Stop-lists for the language of the texts (docs/glossary.md, scripts/lang-rules.json): Brazilian forms in Portuguese, British spellings
// and typography in English, names that are not in the glossary and an inconsistent "ё" in Russian. Reads the same texts as the language
// review (scripts/lib/lang-texts.ts). Exceptions (a quotation, the name of a building) are listed in lang-rules.json.
// Usage: npm run check:lang   (part of npm test)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectTexts, root, type TextItem, type TextLang } from './lib/lang-texts';

interface Rule {
  re: string;
  cs?: boolean;
  hint: string;
}
interface Exception {
  lang: TextLang;
  unit: string;
  match: string;
  field?: string;
}
const rules = JSON.parse(readFileSync(join(root, 'scripts/lang-rules.json'), 'utf8')) as Record<TextLang, Rule[]> & { yo: { ignore: string[] }; exceptions: Exception[] };

/** Parts of a text that are not prose: addresses, licence names with a version number, the markup of the static pages. */
const prose = (text: string): string =>
  text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\{[a-z_]+\}/g, ' ')
    .replace(/CC BY(-SA|-NC)? \d\.\d/g, ' CC ')
    .replace(/\*\*/g, '');

/** The regex word boundary knows only ASCII letters; here a word ends at any letter ("Praça" is not "pra"). The first boundary of a pattern becomes a look-behind, the others look-aheads. */
const unicodeBoundaries = (pattern: string): string => {
  let first = true;
  return pattern.replace(/\\b/g, () => {
    const out = first ? '(?<![\\p{L}\\d])' : '(?![\\p{L}\\d])';
    first = false;
    return out;
  });
};

const excused = (it: TextItem, hit: string): boolean => rules.exceptions.some((e) => e.lang === it.lang && e.unit === it.unit && (!e.field || e.field === it.field) && hit.includes(e.match));

export function findHits(items: TextItem[]): { it: TextItem; hit: string; hint: string }[] {
  const hits: { it: TextItem; hit: string; hint: string }[] = [];
  for (const it of items) {
    const text = prose(it.text);
    for (const rule of rules[it.lang] ?? []) {
      const re = new RegExp(unicodeBoundaries(rule.re), rule.cs ? 'gu' : 'giu');
      for (const m of text.matchAll(re)) {
        const at = m.index ?? 0;
        const hit = text.slice(Math.max(0, at - 18), at + m[0].length + 18).replace(/\s+/g, ' ');
        if (!excused(it, m[0]) && !excused(it, hit)) hits.push({ it, hit, hint: rule.hint });
      }
    }
  }
  // "ё": a word without it whose form with it is written elsewhere in the Russian texts.
  const ru = items.filter((i) => i.lang === 'ru');
  const words = (t: string) => prose(t).match(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/g) ?? [];
  const withYo = new Set<string>();
  for (const it of ru) for (const w of words(it.text)) if (w.includes('ё')) withYo.add(w.toLowerCase());
  const bare = new Map<string, string>();
  for (const w of withYo) bare.set(w.replace(/ё/g, 'е'), w);
  const ignore = new Set(rules.yo.ignore);
  for (const it of ru) {
    for (const w of words(it.text)) {
      const lower = w.toLowerCase();
      const full = bare.get(lower);
      if (full && !ignore.has(lower) && !excused(it, w)) hits.push({ it, hit: w, hint: `«ё» непоследовательно: в других местах «${full}»` });
    }
  }
  return hits;
}

const isMain = process.argv[1] && /check-lang\.ts$/.test(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const hits = findHits(collectTexts());
  if (hits.length) {
    console.error(`Language check failed: ${hits.length} hit(s)`);
    for (const { it, hit, hint } of hits) console.error(`- ${it.lang} ${it.unit} [${it.field}] «${hit}»: ${hint}`);
    process.exit(1);
  }
  console.log('Language check passed: no stop-list hits (pt, en, ru).');
}
