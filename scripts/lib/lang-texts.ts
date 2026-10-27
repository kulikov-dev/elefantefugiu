// Every text of the site, per language, for the language review (docs/language-review/): the inventory table, the hash of the text of a
// language at the time it was read (lang_review), the list of what is still to be read (npm run lang:pending) and the stop-lists
// (npm run check:lang). One walker, so all of them see the same texts.
//
// A "unit" is what is read and marked as read at once: one story, one static page, one epoch, one thread, one section of the interface
// strings. A unit has a key (`event/hanno-1514`, `static/legal`, `epoch/avis-e-descobrimentos`, `thread/mar`, `ui/pages`), and the hash of a
// language is taken over all text fields of the unit in that language, in a fixed order.
// Not read: drafts, test cards and placeholders; the Russian text of a story that is not `ru_ready`.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { STATIC_PAGES } from '../../src/data/static-pages';

export const LANG_LIST = ['pt', 'en', 'ru'] as const;
export type TextLang = (typeof LANG_LIST)[number];

export interface TextItem {
  /** Review unit: the key under which the date and the hash are kept. */
  unit: string;
  /** File the text is in (relative to the repository). */
  file: string;
  /** Field inside the file (`story`, `image.alt`, `sources[2].note`, `legal.sections[cookies].paragraphs[0]`). */
  field: string;
  lang: TextLang;
  text: string;
}

export const root = fileURLToPath(new URL('../..', import.meta.url));

const readYaml = (path: string): any => parseDocument(readFileSync(path, 'utf8'), { customTags: ['timestamp'], merge: true, schema: 'core' }).toJS();
const isLangObject = (v: unknown): v is Partial<Record<TextLang, string>> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => (LANG_LIST as readonly string[]).includes(k)) && Object.values(v).every((x) => typeof x === 'string');

/** Text objects ({pt, en, ru?}) anywhere in a YAML record, with the path to each. Fields named in `skip` are left out. */
function walkYaml(value: unknown, path: string, out: { field: string; texts: Partial<Record<TextLang, string>> }[], skip: Set<string>): void {
  if (isLangObject(value)) {
    out.push({ field: path, texts: value });
    return;
  }
  if (Array.isArray(value)) value.forEach((v, i) => walkYaml(v, `${path}[${i}]`, out, skip));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const next = path ? `${path}.${k}` : k;
      if (!skip.has(next)) walkYaml(v, next, out, skip);
    }
  }
}

function fromYaml(unit: string, file: string, record: unknown, langs: readonly TextLang[], skip = new Set<string>()): TextItem[] {
  const found: { field: string; texts: Partial<Record<TextLang, string>> }[] = [];
  walkYaml(record, '', found, skip);
  return found.flatMap(({ field, texts }) => langs.filter((l) => texts[l]?.trim()).map((lang) => ({ unit, file, field, lang, text: texts[lang]! })));
}

function stories(): TextItem[] {
  const dir = join(root, 'src/content/events');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .flatMap((f) => {
      const data = readYaml(join(dir, f));
      // Published and real only: no drafts, no test cards.
      if (data.status !== 'ready' || data.placeholder) return [];
      return fromYaml(`event/${data.id}`, `src/content/events/${f}`, data, data.ru_ready ? LANG_LIST : ['pt', 'en'], new Set(['lang_review']));
    });
}

function collection(name: 'epochs' | 'threads'): TextItem[] {
  const file = `src/content/${name}.yaml`;
  const kind = name === 'epochs' ? 'epoch' : 'thread';
  return (readYaml(join(root, file)) as any[]).flatMap((rec) => {
    if (rec.placeholder === true) return [];
    // An epoch lists its provisional fields; those are test text.
    const skip = new Set<string>(Array.isArray(rec.placeholder) ? rec.placeholder : []);
    return fromYaml(`${kind}/${rec.id}`, file, rec, LANG_LIST, skip);
  });
}

function staticPages(): TextItem[] {
  const out: TextItem[] = [];
  for (const [page, byLang] of Object.entries(STATIC_PAGES)) {
    for (const lang of LANG_LIST) {
      const p = (byLang as any)[lang];
      const add = (field: string, text: string) => out.push({ unit: `static/${page}`, file: 'src/data/static-pages.ts', field, lang, text });
      if (p.lead) add('lead', p.lead);
      (p.more ?? []).forEach((t: string, i: number) => add(`more[${i}]`, t));
      for (const s of p.sections) {
        add(`sections[${s.id}].heading`, s.heading);
        s.paragraphs.forEach((t: string, i: number) => add(`sections[${s.id}].paragraphs[${i}]`, t));
        (s.items ?? []).forEach((t: string, i: number) => add(`sections[${s.id}].items[${i}]`, t));
        (s.after ?? []).forEach((t: string, i: number) => add(`sections[${s.id}].after[${i}]`, t));
      }
    }
  }
  return out;
}

function flat(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') out.push([path, value]);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) flat(v, path ? `${path}.${k}` : k, out);
}

function interfaceStrings(): TextItem[] {
  return LANG_LIST.flatMap((lang) => {
    const pairs: [string, string][] = [];
    flat(JSON.parse(readFileSync(join(root, `src/i18n/${lang}.json`), 'utf8')), '', pairs);
    // Test cards are not read, so the strings of the placeholder notice are read with the interface; nothing is left out here.
    return pairs.map(([field, text]) => ({ unit: `ui/${field.split('.')[0]}`, file: `src/i18n/${lang}.json`, field, lang, text }));
  });
}

/** All the texts of the site that are read. */
export function collectTexts(): TextItem[] {
  return [...stories(), ...collection('epochs'), ...collection('threads'), ...staticPages(), ...interfaceStrings()];
}

/** The hash of the text of one language of a unit: over every field in the order of the inventory, with the field name. */
export function hashOf(items: TextItem[], unit: string, lang: TextLang): string {
  const h = createHash('sha256');
  for (const it of items.filter((i) => i.unit === unit && i.lang === lang)) h.update(`${it.field}\n${it.text}\n`);
  return h.digest('hex').slice(0, 12);
}

/** Unit keys and the languages each has text in. */
export function units(items: TextItem[]): { unit: string; lang: TextLang }[] {
  const seen = new Set<string>();
  const out: { unit: string; lang: TextLang }[] = [];
  for (const it of items) {
    const key = `${it.unit}|${it.lang}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ unit: it.unit, lang: it.lang });
    }
  }
  return out;
}
