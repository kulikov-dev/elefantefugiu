// The contact address is never written out in the HTML: without JavaScript the page shows "name [at] host" in a span that carries the
// two halves apart, and src/scripts/email.ts puts the real mailto link in its place. Pure, covered by tests.
const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The two halves of an address, split at the last "@". */
export function splitEmail(email: string): { user: string; host: string } {
  const at = email.lastIndexOf('@');
  return { user: email.slice(0, at), host: email.slice(at + 1) };
}

/** What a reader without JavaScript sees. */
export const obscuredEmail = (email: string): string => {
  const { user, host } = splitEmail(email);
  return `${user} [at] ${host}`;
};

/** The span for an address inside a text; the script turns it into a link. */
export function emailMarkup(email: string): string {
  const { user, host } = splitEmail(email);
  return `<span class="email" data-email-user="${escapeHtml(user)}" data-email-host="${escapeHtml(host)}">${escapeHtml(obscuredEmail(email))}</span>`;
}
