// Inline markup of the static page texts (src/data/static-pages.ts):
//   {{about}} {{method}} {{report}} {{legal}} {{map}}  a link to that page of the site (the link text is the title of the page);
//   {{method|text}}                                     the same link with another text (for a case ending in Russian);
//   {{email}}                                           the contact address: "name [at] host", a mailto link once the script runs (src/lib/contact.ts);
//   {{stories}}                                         a value computed at build time, here the number of stories with its noun;
//   **text**                                            bold.
// Everything else is escaped. An unknown token is an error (a typo must not reach the page). Pure function, covered by tests.

import { emailMarkup } from './contact';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

export interface PageLink {
  href: string;
  label: string;
}

/** Values the page computes (a number with its noun, for example); each is escaped. */
export type InlineValues = Record<string, string>;

/** HTML of a text: escaped, with the tokens and the bold marks replaced. */
export function renderInline(text: string, link: (key: string) => PageLink | undefined, email: string, values: InlineValues = {}): string {
  return escapeHtml(text)
    .replace(/\{\{(\w+)(?:\|([^}]+))?\}\}/g, (_, key: string, label: string | undefined) => {
      if (key === 'email') return emailMarkup(email);
      if (key in values) return escapeHtml(values[key]!);
      const target = link(key);
      if (!target) throw new Error(`Unknown token {{${key}}} in a static page text`);
      // The label was escaped together with the text above (it is inside the braces), so it is used as it is.
      return `<a href="${escapeHtml(target.href)}">${label ?? escapeHtml(target.label)}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
