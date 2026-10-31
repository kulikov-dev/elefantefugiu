// The marks "read by a language editor": for a story in its YAML file (field lang_review), for everything else in
// docs/language-review/reviewed.json. A mark is the date and the hash of the text of one language of one unit at the time it was read
// (hashOf, scripts/lib/lang-texts.ts); when the text changes, the hash no longer matches and the unit is pending again.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { LANG_LIST, collectTexts, fieldHashes, hashOf, root, units, type TextLang } from './lang-texts';

export interface Mark {
  date: string;
  hash: string;
  /** Hash of every field of the unit when it was read (units kept in reviewed.json only), so that `lang:pending` can name the keys that changed. */
  fields?: Record<string, string>;
}
export const REVIEWED_JSON = join(root, 'docs/language-review/reviewed.json');

const readJson = (): Record<string, Mark> => {
  try {
    return JSON.parse(readFileSync(REVIEWED_JSON, 'utf8')) as Record<string, Mark>;
  } catch {
    return {};
  }
};

const storyFile = (unit: string) => join(root, 'src/content/events', `${unit.slice('event/'.length)}.yaml`);

/** The marks that exist now: key `unit/lang` -> mark. */
export function readMarks(): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  for (const [k, v] of Object.entries(readJson())) marks.set(k, v);
  const items = collectTexts();
  for (const unit of new Set(items.filter((i) => i.unit.startsWith('event/')).map((i) => i.unit))) {
    const data = parseDocument(readFileSync(storyFile(unit), 'utf8'), { customTags: ['timestamp'], schema: 'core' }).toJS();
    for (const lang of LANG_LIST) {
      const m = data.lang_review?.[lang];
      if (m) marks.set(`${unit}/${lang}`, { date: String(m.date instanceof Date ? m.date.toISOString().slice(0, 10) : m.date), hash: String(m.hash) });
    }
  }
  return marks;
}

export interface Pending {
  unit: string;
  lang: TextLang;
  why: 'not read' | 'changed after reading';
  /** Fields (keys) that are new, changed or gone since the mark; undefined when the mark has no per-field record. */
  changed?: string[];
}

/** The fields that differ between the record of a mark and the texts now. */
export function changedFields(before: Record<string, string>, now: Record<string, string>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(now)]);
  return [...keys].filter((k) => before[k] !== now[k]).sort();
}

/** What is not read yet or changed after it was read. */
export function pending(): Pending[] {
  const items = collectTexts();
  const marks = readMarks();
  return units(items).flatMap(({ unit, lang }): Pending[] => {
    const mark = marks.get(`${unit}/${lang}`);
    if (!mark) return [{ unit, lang, why: 'not read' as const }];
    if (mark.hash === hashOf(items, unit, lang)) return [];
    return [{ unit, lang, why: 'changed after reading' as const, ...(mark.fields ? { changed: changedFields(mark.fields, fieldHashes(items, unit, lang)) } : {}) }];
  });
}

/** Writes the marks for the given languages (and units, when `only` is given) with today's hashes. */
export function mark(langs: readonly TextLang[], date: string, only: (unit: string) => boolean = () => true): number {
  const items = collectTexts();
  const json = readJson();
  const stories = new Map<string, Partial<Record<TextLang, Mark>>>();
  let n = 0;
  for (const { unit, lang } of units(items)) {
    if (!langs.includes(lang) || !only(unit)) continue;
    const m: Mark = { date, hash: hashOf(items, unit, lang) };
    n += 1;
    if (unit.startsWith('event/')) stories.set(unit, { ...stories.get(unit), [lang]: m });
    else json[`${unit}/${lang}`] = { ...m, fields: fieldHashes(items, unit, lang) };
  }
  const sorted = Object.fromEntries(Object.entries(json).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(REVIEWED_JSON, `${JSON.stringify(sorted, null, 2)}\n`);
  for (const [unit, add] of stories) {
    const file = storyFile(unit);
    const raw = readFileSync(file, 'utf8');
    const nl = raw.includes('\r\n') ? '\r\n' : '\n';
    const text = raw.replace(/\r\n/g, '\n');
    const existing = parseDocument(text, { customTags: ['timestamp'], schema: 'core' }).toJS().lang_review ?? {};
    const merged: Record<string, Mark> = {};
    for (const lang of LANG_LIST) {
      const m = add[lang] ?? existing[lang];
      if (m) merged[lang] = { date: String(m.date instanceof Date ? m.date.toISOString().slice(0, 10) : m.date), hash: String(m.hash) };
    }
    const block = ['lang_review:', ...Object.entries(merged).flatMap(([lang, m]) => [`  ${lang}:`, `    date: '${m.date}'`, `    hash: '${m.hash}'`])].join('\n');
    // Replace the old block (up to the next top-level key) or append at the end.
    const stripped = text.replace(/^lang_review:\n(?:[ \t].*\n?)*/m, '');
    const out = `${stripped.replace(/\n*$/, '\n')}${block}\n`;
    writeFileSync(file, out.replace(/\n/g, nl));
  }
  return n;
}

/**
 * Adds the per-field record to the marks in reviewed.json that are still valid (the text has not changed since they were made) and have none;
 * date and hash stay as they are, so nothing becomes "read" that was not. Returns how many marks got a record.
 */
export function recordFields(): number {
  const items = collectTexts();
  const json = readJson();
  let n = 0;
  for (const [key, m] of Object.entries(json)) {
    const slash = key.lastIndexOf('/');
    const unit = key.slice(0, slash);
    const lang = key.slice(slash + 1) as TextLang;
    if (m.fields || m.hash !== hashOf(items, unit, lang)) continue;
    json[key] = { ...m, fields: fieldHashes(items, unit, lang) };
    n += 1;
  }
  const sorted = Object.fromEntries(Object.entries(json).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(REVIEWED_JSON, `${JSON.stringify(sorted, null, 2)}\n`);
  return n;
}
