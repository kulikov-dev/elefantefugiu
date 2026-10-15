// The language switch keeps ?fio=, ?vista=, ?epoca= and ?id= (same values in pt and en).
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
