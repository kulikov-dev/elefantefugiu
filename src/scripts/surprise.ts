// "Surprise me": opens a random card from the list embedded in the page, never the same one twice in a row.
// The last card is remembered in localStorage (inside try/catch: it can be blocked). Without this script the button stays hidden.
import { pickSurprise, SURPRISE_KEY } from '../lib/home';

const button = document.querySelector<HTMLButtonElement>('[data-surprise]');
const data = document.getElementById('surprise-data');

if (button && data) {
  let list: { id: string; href: string }[] = [];
  try {
    list = JSON.parse(data.textContent ?? '[]');
  } catch {
    list = [];
  }
  if (list.length > 0) {
    button.hidden = false;
    button.addEventListener('click', () => {
      let last: string | null = null;
      try {
        last = localStorage.getItem(SURPRISE_KEY);
      } catch {
        // Storage blocked: the card may repeat, nothing else is lost.
      }
      const id = pickSurprise(list.map((item) => item.id), last);
      const item = list.find((x) => x.id === id);
      if (!item) return;
      try {
        localStorage.setItem(SURPRISE_KEY, item.id);
      } catch {
        // See above.
      }
      location.assign(item.href);
    });
  }
}
