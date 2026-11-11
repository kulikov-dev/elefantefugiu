// The icons of the verdict label (docs/spec.md 5.8, 5.9): the circle with a check (fact, a right guess), a cross (myth, a wrong guess) or a half disc (partly). One source for the Astro component
// (src/components/MythVerdict.astro) and for the scripts that make the same label in the browser (src/scripts/answer-parts.ts).
export type VerdictKind = 'myth' | 'fact' | 'part';

const MARK = {
  fact: '<path d="M5 8.3l2.2 2.2L11.2 5.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />',
  myth: '<path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />',
  part: '<path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />',
} as const;

/** The <svg> of the label of the kind (decorative: the words next to it say the same). */
export const verdictIcon = (kind: VerdictKind): string =>
  `<svg class="verdict__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />${MARK[kind]}</svg>`;
