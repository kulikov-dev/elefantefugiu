export {};
// The side by side / overlaid switch of the ship interactive. Without this script the side by side drawing is shown
// and the switch stays hidden. The switch is a radio group, so the arrow keys work and there is one tab stop.
const figure = document.querySelector<HTMLElement>('[data-viz-ships]');
const group = document.querySelector<HTMLElement>('[data-viz-switch]');

if (figure && group) {
  group.hidden = false;
  for (const input of group.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
    input.addEventListener('change', () => {
      if (input.checked) figure.dataset.mode = input.value;
    });
  }
}
