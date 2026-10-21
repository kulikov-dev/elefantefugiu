// The language switch keeps ?fio=, ?vista=, ?epoca= and ?id= (same values in every language).
// The query changes at runtime (replaceState), so links are refreshed right before they can be used.
import { withCarried } from '../lib/lang-params';

const links = [...document.querySelectorAll<HTMLAnchorElement>('.lang-switch a[href]')];
const originals = links.map((link) => link.getAttribute('href') ?? '');

const sync = () => {
  links.forEach((link, i) => link.setAttribute('href', withCarried(originals[i]!, location.search)));
};

sync();
const group = document.querySelector('.lang-switch');
for (const type of ['pointerdown', 'focusin', 'mouseover', 'touchstart', 'contextmenu']) {
  group?.addEventListener(type, sync, { passive: true });
}

// The list closes on Escape (focus returns to the button), on a click elsewhere and when focus leaves it.
const menu = document.querySelector<HTMLDetailsElement>('[data-lang-switch]');
if (menu) {
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector<HTMLElement>('summary')?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (menu.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  });
  menu.addEventListener('focusout', (event) => {
    if (menu.open && event.relatedTarget instanceof Node && !menu.contains(event.relatedTarget)) menu.open = false;
  });
}
