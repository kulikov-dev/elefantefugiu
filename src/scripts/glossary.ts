// The words of the glossary in a story (src/lib/glossary.ts makes the markup): a tooltip opens under the word on hover (a mouse), on a press (a finger, a mouse),
// on focus from the keyboard; Esc and a press elsewhere close it. The tooltip is a sibling of the button inside .gl; data-open on .gl is the state.
// Without this script the style opens the tooltip on hover and on focus (html:not([data-js])).
const MARGIN = 16; // from the edge of the screen, px: the gutter of the page

const words = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.gl')];
const termOf = (word: HTMLElement) => word.querySelector<HTMLElement>('.gl__term');
const tipOf = (word: HTMLElement) => word.querySelector<HTMLElement>('.gl__tip');

/** Keeps the tooltip inside the screen: shifted sideways when it would cross an edge, above the word when there is no room under it. */
function place(word: HTMLElement): void {
  const tip = tipOf(word);
  if (!tip) return;
  word.classList.remove('gl--up');
  word.style.removeProperty('--gl-shift');
  const box = tip.getBoundingClientRect();
  const wide = document.documentElement.clientWidth;
  let shift = 0;
  if (box.right > wide - MARGIN) shift = wide - MARGIN - box.right;
  if (box.left + shift < MARGIN) shift = MARGIN - box.left;
  if (shift !== 0) word.style.setProperty('--gl-shift', `${Math.round(shift)}px`);
  const room = { below: window.innerHeight - box.top, above: tip.parentElement!.getBoundingClientRect().top };
  if (box.bottom > window.innerHeight && room.above > room.below) word.classList.add('gl--up');
}

function open(word: HTMLElement): void {
  for (const other of words()) if (other !== word) close(other);
  word.setAttribute('data-open', '');
  termOf(word)?.setAttribute('aria-expanded', 'true');
  place(word);
}

function close(word: HTMLElement): void {
  word.removeAttribute('data-open');
  word.removeAttribute('data-pinned');
  termOf(word)?.setAttribute('aria-expanded', 'false');
}

const wordOf = (target: EventTarget | null): HTMLElement | null => (target instanceof Element ? target.closest<HTMLElement>('.gl') : null);

for (const word of words()) termOf(word)?.setAttribute('aria-expanded', 'false');

// A mouse: the tooltip follows the pointer (a finger has no hover); a press on the word keeps it open.
document.addEventListener('pointerover', (event) => {
  const word = wordOf(event.target);
  if (word && event.pointerType === 'mouse' && !word.hasAttribute('data-open')) open(word);
});
document.addEventListener('pointerout', (event) => {
  const word = wordOf(event.target);
  if (word && event.pointerType === 'mouse' && !word.hasAttribute('data-pinned') && !word.contains(event.relatedTarget as Node | null)) close(word);
});

document.addEventListener('click', (event) => {
  const term = event.target instanceof Element ? event.target.closest<HTMLElement>('.gl__term') : null;
  const word = wordOf(term);
  if (word && term) {
    if (word.hasAttribute('data-pinned')) close(word);
    else {
      open(word);
      word.setAttribute('data-pinned', '');
    }
    return;
  }
  // A press elsewhere (not in a tooltip): close all.
  if (!wordOf(event.target)) for (const w of words()) close(w);
});

// The keyboard: Tab to the word opens it; leaving the word closes it; Esc closes and keeps the focus on the word.
document.addEventListener('focusin', (event) => {
  const word = wordOf(event.target);
  if (word && event.target instanceof Element && event.target.matches(':focus-visible') && !word.hasAttribute('data-open')) open(word);
});
// A press inside the tooltip (on its text, not on the link) takes the focus off the word: that is not leaving it.
let pressInside = false;
document.addEventListener('pointerdown', (event) => (pressInside = wordOf(event.target) !== null), true);
document.addEventListener('pointerup', () => setTimeout(() => (pressInside = false), 0), true);
document.addEventListener('focusout', (event) => {
  const word = wordOf(event.target);
  if (word && !pressInside && !word.contains(event.relatedTarget as Node | null)) close(word);
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const shown = words().filter((w) => w.hasAttribute('data-open'));
  if (shown.length === 0) return;
  const inside = wordOf(document.activeElement);
  for (const w of shown) close(w);
  if (inside) termOf(inside)?.focus();
});
