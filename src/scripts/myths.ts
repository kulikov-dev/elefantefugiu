// "Myth or fact" (src/views/MythsView.astro, docs/spec.md 5.8). A press on "Myth" or "Fact" opens the answer of that card, marks the button pressed, turns both off and sends one
// anonymous event `myth-<id>` to GoatCounter (the counter already on the site; without it nothing breaks). Nothing is kept: no storage, no score. The focus moves to the answer,
// so a reader with a screen reader hears it (the pressed button is off by then). Without this script the <details> of each card opens by "Answer".
import { answerEvent } from '../lib/myths';

type Counter = { count?: (vars: { path: string; title: string; event: true }) => void };

document.querySelectorAll<HTMLElement>('[data-myth]').forEach((card) => {
  const id = card.dataset.myth ?? '';
  const answer = card.querySelector<HTMLDetailsElement>('[data-answer]');
  const body = card.querySelector<HTMLElement>('[data-body]');
  const buttons = [...card.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  if (!answer || !body || buttons.length === 0) return;
  const respond = (picked: HTMLButtonElement): void => {
    if (answer.open || buttons.some((b) => b.disabled)) return;
    picked.setAttribute('aria-pressed', 'true');
    for (const b of buttons) b.disabled = true;
    answer.open = true;
    try {
      const event = answerEvent(id);
      (window as unknown as { goatcounter?: Counter }).goatcounter?.count?.({ path: event, title: card.dataset.title ?? event, event: true });
    } catch {
      // The counter failed: nothing to tell the reader.
    }
    body.focus({ preventScroll: true });
  };
  for (const b of buttons) b.addEventListener('click', () => respond(b));
});
