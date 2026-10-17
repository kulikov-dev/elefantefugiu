export {};
// "Show one by one" for the dots interactive. Without this script the drawing is complete and static.
// With "reduce motion" there is no animation and no button; the dots stay shown.
const figure = document.querySelector<SVGSVGElement>('[data-viz-dots] .viz__svg');
const button = document.querySelector<HTMLButtonElement>('[data-viz-play]');

if (figure && button) {
  const dots = [...figure.querySelectorAll<SVGCircleElement>('.dot')];
  const label = button.textContent ?? '';
  const playingLabel = button.dataset.playing ?? '…';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer: number | undefined;

  const showAll = () => {
    window.clearInterval(timer);
    timer = undefined;
    for (const dot of dots) dot.classList.remove('dot--waiting');
    button.disabled = false;
    button.textContent = label;
  };

  const sync = () => {
    // The button exists only when animation is allowed.
    button.hidden = reduce.matches;
    if (reduce.matches) showAll();
  };

  button.addEventListener('click', () => {
    if (reduce.matches || timer !== undefined) return;
    for (const dot of dots) dot.classList.add('dot--waiting');
    button.disabled = true;
    button.textContent = playingLabel;
    let shown = 0;
    // About three seconds in all, whatever the number of dots, and never slower than 60 ms a dot.
    const step = Math.min(60, Math.max(8, Math.round(3000 / dots.length)));
    timer = window.setInterval(() => {
      dots[shown]?.classList.remove('dot--waiting');
      shown += 1;
      if (shown >= dots.length) {
        showAll();
        button.focus();
      }
    }, step);
  });

  reduce.addEventListener('change', sync);
  sync();
}
