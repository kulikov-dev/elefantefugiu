// The glossary: the words of src/data/glossary.yaml found in a text and marked (docs/spec.md "Словарик"). Pure functions; the data is read in glossary-data.ts.
// The marks are made at build time: the first mention of an inline word on a page becomes a button with a tooltip next to it (src/scripts/glossary.ts opens it).
import type { GlossaryTerm } from '../data/schemas';
import type { Lang } from '../i18n/routes';

/** The languages the glossary is written in: the Portuguese text is not marked and has no page. */
export type GlossaryLang = 'ru' | 'en';
export const GLOSSARY_LANGS: readonly GlossaryLang[] = ['ru', 'en'];
export const isGlossaryLang = (lang: Lang): lang is GlossaryLang => lang === 'ru' || lang === 'en';

const LETTER = String.raw`\p{L}\p{N}`;

/** The pattern of one form: the word itself (regex characters escaped), `*` = any ending. */
const formSource = (form: string): string => form.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, `[${LETTER}]*`);

/**
 * The regular expression that finds a word in a text of `lang`: any of its forms, whole words only (a form inside a longer word or a hyphenated
 * name, "Руа-да-Прата", is not the word), case-insensitive. undefined when the word has no forms in that language.
 */
export function termRegex(term: GlossaryTerm, lang: GlossaryLang): RegExp | undefined {
  const forms = term.forms[lang];
  if (forms.length === 0) return undefined;
  // Longest first, so that a form that begins another one does not cut it short.
  const alternatives = [...forms].sort((a, b) => b.length - a.length).map(formSource).join('|');
  return new RegExp(`(?<![${LETTER}]|[\\p{L}]-)(?:${alternatives})(?![${LETTER}]|-[\\p{L}])`, 'giu');
}

export interface TermMatcher {
  term: GlossaryTerm;
  re: RegExp;
}

/** The words that are marked in the story (inline: true) and have forms in `lang`, ready to search. */
export function inlineMatchers(terms: readonly GlossaryTerm[], lang: GlossaryLang): TermMatcher[] {
  return terms.flatMap((term) => {
    const re = term.inline ? termRegex(term, lang) : undefined;
    return re ? [{ term, re }] : [];
  });
}

export const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The text of a paragraph as HTML: escaped, with the first mention of every word that is not in `seen` replaced by `render(term, matched)`.
 * `seen` is shared by all the paragraphs of a page, so a word is marked once on a page; the word is added to it when it is marked.
 */
export function markParagraph(text: string, matchers: readonly TermMatcher[], seen: Set<string>, render: (term: GlossaryTerm, matched: string) => string): string {
  let out = '';
  let pos = 0;
  for (;;) {
    let best: { index: number; matched: string; term: GlossaryTerm } | undefined;
    for (const { term, re } of matchers) {
      if (seen.has(term.id)) continue;
      re.lastIndex = pos;
      const m = re.exec(text);
      if (m && (!best || m.index < best.index)) best = { index: m.index, matched: m[0], term };
    }
    if (!best) break;
    out += escapeHtml(text.slice(pos, best.index)) + render(best.term, best.matched);
    seen.add(best.term.id);
    pos = best.index + best.matched.length;
  }
  return out + escapeHtml(text.slice(pos));
}

/** The markup of one mention: the word as a button, and the tooltip (what it is, and the link to the page of the glossary). The tooltip is hidden from search (Pagefind). */
export function renderMark(term: GlossaryTerm, matched: string, lang: GlossaryLang, href: string, allWords: string): string {
  const id = `gl-${term.id}`;
  return (
    `<span class="gl"><button type="button" class="gl__term" aria-describedby="${id}">${escapeHtml(matched)}</button>` +
    `<span class="gl__tip" id="${id}" lang="${lang}" data-pagefind-ignore><span class="gl__box">` +
    `<span class="gl__text">${escapeHtml(term.text[lang])}</span>` +
    `<a class="gl__all" href="${escapeHtml(href)}#${term.id}">${escapeHtml(allWords)}</a></span></span></span>`
  );
}

/** The ids of the stories that mention the word (any of its forms in `lang`), from the texts of each story. */
export function mentioningStories(term: GlossaryTerm, lang: GlossaryLang, texts: readonly { id: string; text: string }[]): string[] {
  const re = termRegex(term, lang);
  if (!re) return [];
  return texts.filter(({ text }) => ((re.lastIndex = 0), re.test(text))).map(({ id }) => id);
}
