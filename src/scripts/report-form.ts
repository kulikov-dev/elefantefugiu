// "Found a mistake?" form: fills the address of the card from ?url=, checks the description and sends the form with fetch,
// so the reader stays on the page. If anything fails the message about writing directly appears; without this script the
// plain form post still works (the service forwards the message and sends the reader back to #sent).
import { hasEnoughText, pageFromQuery } from '../lib/report';

const form = document.querySelector<HTMLFormElement>('[data-report-form]');
if (form) {
  const urlField = form.querySelector<HTMLInputElement>('[data-report-url]');
  if (urlField && !urlField.value) urlField.value = pageFromQuery(location.search);

  const what = form.querySelector<HTMLTextAreaElement>('#f-what')!;
  const error = form.querySelector<HTMLElement>('#f-what-error')!;
  const failed = form.querySelector<HTMLElement>('[data-report-failed]')!;
  const button = form.querySelector<HTMLButtonElement>('[data-report-submit]')!;
  const sent = document.getElementById('sent')!;

  const showSent = () => {
    form.hidden = true;
    sent.hidden = false;
    sent.focus();
    for (const note of document.querySelectorAll<HTMLElement>('.report__note')) note.hidden = true;
  };
  // Arrived from the service (no-JS post): show the confirmation and hide the form.
  if (location.hash === '#sent') showSent();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    failed.hidden = true;
    if (!hasEnoughText(what.value)) {
      error.textContent = form.dataset.tooShort ?? '';
      error.hidden = false;
      what.setAttribute('aria-invalid', 'true');
      what.focus();
      return;
    }
    error.hidden = true;
    what.removeAttribute('aria-invalid');
    button.disabled = true;
    button.textContent = form.dataset.sending ?? '';
    try {
      const response = await fetch(form.dataset.ajax ?? form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const result = (await response.json().catch(() => ({}))) as { success?: string | boolean };
      if (!response.ok || String(result.success) === 'false') throw new Error('not sent');
      showSent();
    } catch {
      failed.hidden = false;
      button.disabled = false;
      button.textContent = form.dataset.submit ?? '';
    }
  });
}
