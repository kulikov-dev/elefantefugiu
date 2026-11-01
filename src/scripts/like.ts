// The button "I liked it" at the end of a story (src/components/LikeButton.astro). Without JavaScript it is not shown at all (it starts hidden).
// The rules are in src/lib/like.ts: one anonymous event to GoatCounter, remembered in localStorage (like:<id>), the same answer whatever the counter does.
import { isLiked, like, type Counter } from '../lib/like';

const done = new Set<string>();
const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

document.querySelectorAll<HTMLButtonElement>('[data-like]').forEach((button) => {
  const id = button.dataset.like ?? '';
  const title = button.dataset.title ?? id;
  // The words "Thanks!" are in the page already (LikeButton.astro): pressing only turns aria-pressed on, the style does the rest.
  const show = (): void => button.setAttribute('aria-pressed', 'true');
  button.hidden = false;
  const deps = () => ({ counter: (window as unknown as { goatcounter?: Counter }).goatcounter, storage: storage(), done });
  if (isLiked(id, deps())) show();
  button.addEventListener('click', () => {
    like({ id, title }, deps());
    show();
  });
});
