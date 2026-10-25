// Puts the contact address together from the two halves in the page (see src/lib/contact.ts): a span becomes a mailto link, and the
// report form gets the address of the form service. The address is not written out anywhere in the HTML, so a plain page scraper does not find it.
import { formsubmitEndpoint } from '../lib/report';

for (const el of document.querySelectorAll<HTMLElement>('[data-email-user]')) {
  const address = `${el.dataset.emailUser}@${el.dataset.emailHost}`;
  if (el instanceof HTMLFormElement) {
    el.action = formsubmitEndpoint(address, false);
    el.dataset.ajax = formsubmitEndpoint(address, true);
    continue;
  }
  const link = document.createElement('a');
  link.href = `mailto:${address}`;
  link.textContent = address;
  el.replaceWith(link);
}
