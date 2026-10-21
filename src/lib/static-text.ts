// Inline markup of the static page texts (src/data/static-pages.ts): {{about}} {{method}} {{report}} {{legal}} {{map}} become
// links to those pages (the link text is the title of the page), {{email}} the contact address. Everything else is escaped.
// Pure function, covered by tests.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

export interface PageLink {
  href: string;
  label: string;
}

/** HTML of a text: escaped, with the {{tokens}} replaced. An unknown token is an error (a typo must not reach the page). */
export function renderInline(text: string, link: (key: string) => PageLink | undefined, email: string): string {
  return escapeHtml(text).replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (key === 'email') return `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
    const target = link(key);
    if (!target) throw new Error(`Unknown token {{${key}}} in a static page text`);
    return `<a href="${escapeHtml(target.href)}">${escapeHtml(target.label)}</a>`;
  });
}
