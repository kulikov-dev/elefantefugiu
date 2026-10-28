// The habits of machine-written text (docs/style-ai-tells.md): stock words, constructions, endings that grade instead of stating a fact,
// empty praise, and a few rhythm metrics. Pure functions over one text of one language, so the test can feed them phrases.
// The rules are in scripts/lang-rules.json, section ai_tells. The result is a list of warnings; nothing here is an error.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type AiLang = 'pt' | 'en' | 'ru';
export type AiKind = 'cliche' | 'construction' | 'ending' | 'evaluation' | 'question' | 'triples' | 'dashes' | 'spread' | 'paragraph-start' | 'sentence-start' | 'evaluation-share';

export interface AiRule {
  re: string;
  hint: string;
}
export interface AiAllow {
  lang: AiLang;
  unit: string;
  match: string;
  field?: string;
  why: string;
}
export interface AiRules {
  fields: Record<'event' | 'epoch' | 'thread', string[]>;
  thresholds: {
    triples_in_a_row: number;
    triples_in_text: number;
    dashes_per_paragraph: number;
    sentence_spread_min_sentences: number;
    sentence_spread_min_variation: number;
    same_paragraph_start: number;
    same_sentence_start_in_a_row: number;
    evaluative_share: number;
  };
  cliches: Record<AiLang, AiRule[]>;
  constructions: Record<AiLang, AiRule[]>;
  endings: Record<AiLang, AiRule[]>;
  evaluative: Record<AiLang, string[]>;
  allow: AiAllow[];
}

export interface AiWarning {
  kind: AiKind;
  /** The fragment the warning is about (or the numbers for a metric). */
  fragment: string;
  hint: string;
}

const root = fileURLToPath(new URL('../..', import.meta.url));
export const aiRules = (JSON.parse(readFileSync(join(root, 'scripts/lang-rules.json'), 'utf8')) as { ai_tells: AiRules }).ai_tells;

/**
 * The regex word boundary knows only ASCII letters; here a word starts and ends at any letter ("Praça" is not "pra"). Which side a
 * "\b" is on follows from its place: after a letter, a quantifier or a closing bracket of a group it ends a word, after "}" (the
 * quantifier of a gap) or at the start of a pattern, a group or an alternative it starts one.
 */
const unicodeBoundaries = (pattern: string): string =>
  pattern.replace(/\\b/g, (_m, at: number) => {
    const prev = pattern[at - 1];
    const ends = prev !== undefined && prev !== '}' && (prev === ')' || /[\p{L}\d+*?]/u.test(prev));
    return ends ? '(?![\\p{L}\\d])' : '(?<![\\p{L}\\d])';
  });
const compiled = new Map<string, RegExp>();
const regex = (pattern: string): RegExp => {
  let re = compiled.get(pattern);
  if (!re) {
    re = new RegExp(unicodeBoundaries(pattern), 'giu');
    compiled.set(pattern, re);
  }
  return re;
};

/** A quotation is somebody else's words (a source, a speaker): it is not checked. It is replaced by a neutral word so the sentence stays a sentence. */
export const withoutQuotations = (text: string): string => text.replace(/«[^»]*»|“[^”]*”|"[^"]*"/g, 'QUOTE');

const ABBREVIATIONS = /(?:^|[\s(«“"])(?:\p{Lu}|\p{Lu}\p{Ll}|a\.C|d\.C|n\.º|n\.°|Sr|Sra|Dr|Dra|St|Mt|cf|etc|séc|c|p\. ex|т|г|гг|н|э|в|вв|др|см|ок|тыс|млн|руб|напр)\.$/u;

/** Sentences: split after . ! ? … when a capital letter, a quotation mark, a dash or a digit follows; initials and abbreviations do not end a sentence. */
export function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?…]+["»”)]*\s+(?=[\p{Lu}«“"—\d])/gu;
  for (const m of text.matchAll(re)) {
    const end = (m.index ?? 0) + m[0].trimEnd().length;
    const piece = text.slice(start, end);
    if (ABBREVIATIONS.test(piece)) continue;
    out.push(piece.trim());
    start = (m.index ?? 0) + m[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

const words = (text: string): string[] => text.match(/[\p{L}\d][\p{L}\d'’-]*/gu) ?? [];
/** The hit with a few words around it, cut at spaces (never in the middle of a word). */
const snippet = (text: string, at: number, length: number): string => {
  let from = Math.max(0, at - 28);
  let to = Math.min(text.length, at + length + 28);
  if (from > 0) from = Math.min(at, text.indexOf(' ', from) + 1 || at);
  if (to < text.length) to = text.lastIndexOf(' ', to) > at + length ? text.lastIndexOf(' ', to) : at + length;
  return text.slice(from, to).replace(/\s+/g, ' ').trim();
};

/** Three short items in a row ("A, B and C"), the shape machine text loves. */
const TRIPLE = /(?<![\p{L}\d])[\p{L}\d-]+(?: [\p{L}\d-]+){0,2}, [\p{L}\d-]+(?: [\p{L}\d-]+){0,2},? (?:and|e|и|ou|или|&) [\p{L}\d-]+/iu;

export interface AnalyzeOptions {
  rules?: AiRules;
  /** Where the text is, for the allow list. */
  unit?: string;
  field?: string;
}

/** All warnings for one text. `unit` and `field` only select the entries of the allow list. */
export function analyze(lang: AiLang, source: string, options: AnalyzeOptions = {}): AiWarning[] {
  const rules = options.rules ?? aiRules;
  const text = withoutQuotations(source).replace(/\*\*/g, '');
  const warnings: AiWarning[] = [];
  const allowed = (hit: string) => rules.allow.some((a) => a.lang === lang && a.unit === options.unit && (!a.field || a.field === options.field) && hit.includes(a.match));
  const add = (kind: AiKind, fragment: string, hint: string) => {
    if (!allowed(fragment) && !warnings.some((w) => w.kind === kind && w.fragment === fragment)) warnings.push({ kind, fragment, hint });
  };

  const scan = (kind: AiKind, list: AiRule[], within: string) => {
    for (const rule of list) for (const m of within.matchAll(regex(rule.re))) add(kind, snippet(within, m.index ?? 0, m[0].length), rule.hint);
  };
  scan('cliche', rules.cliches[lang], text);
  scan('construction', rules.constructions[lang], text);

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const sentences = paragraphs.flatMap(sentencesOf);

  // Endings: the last sentence of the text should be a fact or a detail, not an assessment.
  const last = sentences.at(-1);
  if (last) scan('ending', rules.endings[lang], last);

  // A question that opens or closes the text.
  const questionHint: Record<AiLang, string> = { en: 'a rhetorical question at the start or the end: state the fact', ru: 'риторический вопрос в начале или конце: скажите факт', pt: 'pergunta retórica no início ou no fim: diga o facto' };
  // A question as a hook is a device of the site, not a habit: only the long texts are checked.
  if (options.field !== 'hook') for (const s of [sentences[0], last]) if (s && sentences.length > 1 && /\?["»”)]*$/.test(s)) add('question', s.slice(0, 80), questionHint[lang]);

  // Empty praise: every word of the list is a hit; a high share of them is one more.
  let evaluative = 0;
  for (const pattern of rules.evaluative[lang]) {
    for (const m of text.matchAll(regex(pattern))) {
      evaluative += 1;
      add('evaluation', snippet(text, m.index ?? 0, m[0].length), lang === 'ru' ? 'пустая оценка: чем именно, назовите факт' : lang === 'pt' ? 'avaliação vazia: em quê, diga o facto' : 'empty praise: in what way, state the fact');
    }
  }
  const total = words(text).length;
  if (evaluative >= 2 && total > 0 && evaluative / total >= rules.thresholds.evaluative_share) add('evaluation-share', `${evaluative} praise words in ${total}`, 'too many assessments for the facts');

  // Triples: "A, B and C" in two sentences in a row, or three times in the text.
  const triple = sentences.map((s) => TRIPLE.test(s));
  let run = 0;
  let longest = 0;
  for (const t of triple) {
    run = t ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const triples = triple.filter(Boolean).length;
  if (longest >= rules.thresholds.triples_in_a_row || triples >= rules.thresholds.triples_in_text) add('triples', `${triples} lists of three, ${longest} in a row`, 'lists of three: keep the one item that has a fact');

  // Dashes: more than two per paragraph.
  for (const p of paragraphs) {
    const dashes = (p.match(/—|(?<=\s)–(?=\s)/gu) ?? []).length;
    if (dashes > rules.thresholds.dashes_per_paragraph) add('dashes', `${dashes} dashes in one paragraph`, 'too many dashes: split the sentence');
  }

  // The same length everywhere: the sentences of a text are nearly equally long.
  const lengths = sentences.map((s) => words(s).length);
  if (lengths.length >= rules.thresholds.sentence_spread_min_sentences) {
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
    if (mean > 0 && sd / mean < rules.thresholds.sentence_spread_min_variation) add('spread', `${lengths.length} sentences of ${Math.min(...lengths)}-${Math.max(...lengths)} words (spread ${(sd / mean).toFixed(2)})`, 'sentences are almost equally long: put a short one next to a long one');
  }

  // The same first word: of paragraphs, and of sentences in a row.
  const first = (s: string) => (words(s)[0] ?? '').toLowerCase();
  if (paragraphs.length >= rules.thresholds.same_paragraph_start) {
    const count = new Map<string, number>();
    for (const p of paragraphs) count.set(first(p), (count.get(first(p)) ?? 0) + 1);
    for (const [word, n] of count) if (word && n >= rules.thresholds.same_paragraph_start) add('paragraph-start', `${n} paragraphs start with «${word}»`, 'paragraphs begin the same way');
  }
  let same = 1;
  for (let i = 1; i < sentences.length; i += 1) {
    same = first(sentences[i]!) === first(sentences[i - 1]!) && first(sentences[i]!) !== '' ? same + 1 : 1;
    if (same === rules.thresholds.same_sentence_start_in_a_row) add('sentence-start', `${same} sentences in a row start with «${first(sentences[i]!)}»`, 'sentences begin the same way');
  }
  return warnings;
}
