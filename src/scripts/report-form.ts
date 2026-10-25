// "Found a mistake?" form. From a story the page arrives with ?url= (the address) and ?title= (the title): the form then shows the
// title with a "change" link instead of the long address, which travels in the field that is not shown. Checks the description,
// sends the form with fetch so the reader stays on the page, and shows the thank-you screen with the way back to the story.
// If anything fails the message about writing directly appears; without this script the plain form post still works (the service
// forwards the message and sends the reader back to #sent).
import { hasEnoughText, pageFromQuery, sameSiteUrl, titleFromQuery } from '../lib/report';

const form = document.querySelector<HTMLFormElement>('[data-report-form]');
if (form) {
  const urlField = form.querySelector<HTMLInputElement>('[data-report-url]')!;
  const free = form.querySelector<HTMLElement>('[data-report-free]')!;
  const story = form.querySelector<HTMLElement>('[data-report-story]')!;
  const next = form.querySelector<HTMLInputElement>('[data-report-next]')!;
  const back = document.querySelector<HTMLAnchorElement>('[data-report-back]');

  const fromUrl = pageFromQuery(location.search);
  const fromTitle = titleFromQuery(location.search);
  const backUrl = fromUrl && sameSiteUrl(fromUrl, location.origin) ? fromUrl : '';

  if (fromUrl && !urlField.value) urlField.value = fromUrl;
  if (fromUrl && fromTitle) {
    // The title in place of the address; "change" brings the plain field back.
    story.querySelector<HTMLElement>('[data-report-story-title]')!.textContent = fromTitle;
    story.hidden = false;
    free.hidden = true;
    story.querySelector<HTMLButtonElement>('[data-report-change]')!.addEventListener('click', () => {
      story.hidden = true;
      free.hidden = false;
      urlField.focus();
      urlField.select();
    });
  }
  // The service sends the reader back to this page with the story still in the address, so the thank-you screen can lead back to it.
  if (fromUrl) {
    const params = new URLSearchParams({ url: fromUrl });
    if (fromTitle) params.set('title', fromTitle);
    next.value = `${form.dataset.reportPage ?? location.origin + location.pathname}?${params}#sent`;
  }

  const what = form.querySelector<HTMLTextAreaElement>('#f-what')!;
  const error = form.querySelector<HTMLElement>('#f-what-error')!;
  const failed = form.querySelector<HTMLElement>('[data-report-failed]')!;
  const button = form.querySelector<HTMLButtonElement>('[data-report-submit]')!;
  const sent = document.getElementById('sent')!;

  const showSent = () => {
    form.hidden = true;
    sent.hidden = false;
    if (back && backUrl) {
      back.href = backUrl;
      back.hidden = false;
    }
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
    button.setAttribute('aria-busy', 'true');
    button.textContent = form.dataset.sending ?? '';
    try {
      const response = await fetch(form.dataset.ajax ?? form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const result = (await response.json().catch(() => ({}))) as { success?: string | boolean };
      if (!response.ok || String(result.success) === 'false') throw new Error('not sent');
      showSent();
    } catch {
      failed.hidden = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = form.dataset.submit ?? '';
    }
  });
}
