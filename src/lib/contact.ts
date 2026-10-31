// The contact address is never written out in the HTML: without JavaScript the page shows "name (arroba) host" (pt), "name (at) host" (en) or "name (собака) host" (ru)
// in a span that carries the two halves apart, and src/scripts/email.ts puts the real mailto link ("mailto:" and the text) together in its place. Pure, covered by tests.
import type { Lang } from '../i18n/routes';
const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The two halves of an address, split at the last "@". */
export function splitEmail(email: string): { user: string; host: string } {
  const at = email.lastIndexOf('@');
  return { user: email.slice(0, at), host: email.slice(at + 1) };
}

/** The word for "@" in the language of the page (what a reader without JavaScript sees in its place). */
export const AT_WORD: Record<Lang, string> = { pt: '(arroba)', en: '(at)', ru: '(собака)' };

/** What a reader without JavaScript sees: "name (at) host", the word in the language of the page ("[at]" when the language is not given). */
export const obscuredEmail = (email: string, lang?: Lang): string => {
  const { user, host } = splitEmail(email);
  return `${user} ${lang ? AT_WORD[lang] : '[at]'} ${host}`;
};

/** The span for an address inside a text; the script turns it into a link. */
export function emailMarkup(email: string, lang?: Lang): string {
  const { user, host } = splitEmail(email);
  return `<span class="email" data-email-user="${escapeHtml(user)}" data-email-host="${escapeHtml(host)}">${escapeHtml(obscuredEmail(email, lang))}</span>`;
}
