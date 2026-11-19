// The block "Follow the new stories" (src/components/FollowBlock.astro). On a story it starts hidden; it is shown to a reader who has read another story and has
// not closed it or subscribed (rules in src/lib/follow.ts). Submitting the form or the "×" sets the flag, so the block is not shown again on this device; the submit
// also sends one anonymous event subscribe-<lang> to GoatCounter. Everything is in try/catch: without localStorage or the counter the form still works.
import { FOLLOW_KEY, followEvent, showFollow } from '../lib/follow';
import { READ_KEY, parseRead } from '../lib/read-marks';
import type { Lang } from '../i18n/routes';
import type { Counter } from '../lib/like';

const setDone = (): void => {
  try {
    localStorage.setItem(FOLLOW_KEY, '1');
  } catch {
    // Blocked storage: the block shows again on the next page.
  }
};

document.querySelectorAll<HTMLElement>('[data-follow]').forEach((block) => {
  const lang = (block.dataset.follow ?? 'en') as Lang;
  if (block.dataset.gated !== undefined) {
    try {
      const done = localStorage.getItem(FOLLOW_KEY) !== null;
      block.hidden = !showFollow(parseRead(localStorage.getItem(READ_KEY)), block.dataset.story ?? '', done);
    } catch {
      block.hidden = true;
    }
  }
  block.querySelector('form')?.addEventListener('submit', () => {
    setDone();
    try {
      const counter = (window as unknown as { goatcounter?: Counter }).goatcounter;
      counter?.count?.({ path: followEvent(lang), title: followEvent(lang), event: true });
    } catch {
      // The counter failed: the form goes on.
    }
  });
  block.querySelector('[data-follow-close]')?.addEventListener('click', () => {
    setDone();
    block.hidden = true;
  });
});
