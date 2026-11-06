// Paragraphs of the "Story" and "More" layers (docs/spec.md 5.3): an empty line in the YAML is a paragraph break.
// What YAML makes of it depends on the block style, so the two layers are read differently.

/** "Story": folded text (`>-` or a plain scalar), where a line wrap is already a space and every newline is a paragraph break. */
export function storyParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * "More": some texts are folded (`>-`, paragraphs are a run of two newlines), some literal (`|-`, wraps are single newlines and
 * paragraphs a run of three; a few English texts have doubled newlines: wraps are two, paragraphs four). In every case the paragraph
 * break is the longest run of newlines in the text; a text whose longest run is one newline is a single paragraph with line wraps.
 */
export function moreParagraphs(text: string): string[] {
  const runs = (text.match(/\n+/g) ?? []).map((r) => r.length);
  const longest = Math.max(0, ...runs);
  const parts = longest >= 2 ? text.split(new RegExp(`\\n{${longest},}`)) : [text];
  return parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
