// The "Found a mistake?" form (src/views/ReportView.astro). Pure helpers, covered by tests.
//
// The form is posted to FormSubmit (https://formsubmit.co), a service that forwards a form to an email address, so the static
// site needs no server of its own. The first time the form is used the service sends the owner a message to confirm the
// address; until it is confirmed the messages wait (see docs/STATE.md). The address is public anyway (it is on the About page).
import type { Lang } from '../i18n/routes';

export function formsubmitEndpoint(email: string, ajax: boolean): string {
  return `https://formsubmit.co/${ajax ? 'ajax/' : ''}${email}`;
}

/** The subject of the email; the language lets the team read the report in the right language. */
export function reportSubject(lang: Lang): string {
  return `O Elefante Fugiu: erro reportado (${lang})`;
}

/** What the reader typed is checked before sending: the description of the mistake needs a few characters. */
export const MIN_REPORT_LENGTH = 5;
export const hasEnoughText = (what: string): boolean => what.trim().length >= MIN_REPORT_LENGTH;

/** The title of the story from ?title= (shown in place of the long address): plain text, at most 200 characters. */
export function titleFromQuery(search: string): string {
  const raw = new URLSearchParams(search).get('title') ?? '';
  return raw.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** The way back to the story is offered only to an address of this very site (a link in the address bar must not send readers elsewhere). */
export function sameSiteUrl(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/** The page address from ?url=, only when it is an http(s) address (nothing else is put into the field). */
export function pageFromQuery(search: string): string {
  const raw = new URLSearchParams(search).get('url') ?? '';
  return /^https?:\/\/[^\s<>"]{1,500}$/.test(raw) ? raw : '';
}
