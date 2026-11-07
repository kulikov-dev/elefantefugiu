// Arrows of the time strip on the home page (from 48rem up; the CSS hides them below): each press scrolls the strip by one epoch, the arrow at the
// end of the strip is disabled. Without this script the buttons stay hidden and the strip is scrolled by hand (finger, trackpad, keyboard).
// A strip with a chosen epoch (aria-pressed, the filter of the map page) is scrolled so that the choice is in view, on load and whenever the choice changes.
const strip = document.querySelector<HTMLElement>('[data-timeline-scroller]');
const prev = document.querySelector<HTMLButtonElement>('[data-timeline-prev]');
const next = document.querySelector<HTMLButtonElement>('[data-timeline-next]');
const STRIP_EDGE = 2; // pixels of tolerance for fractional widths

if (strip && prev && next) {
  const items = [...strip.querySelectorAll<HTMLElement>('.timeline__item')];
  /** Where the left edge of an epoch stands inside the scrolled strip. */
  const leftOf = (item: HTMLElement) => item.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;

  const update = () => {
    const max = strip.scrollWidth - strip.clientWidth;
    prev.disabled = strip.scrollLeft <= STRIP_EDGE;
    next.disabled = max <= STRIP_EDGE || strip.scrollLeft >= max - STRIP_EDGE;
  };

  const go = (direction: 1 | -1) => {
    const here = strip.scrollLeft;
    const target = direction > 0 ? items.find((item) => leftOf(item) > here + STRIP_EDGE) : [...items].reverse().find((item) => leftOf(item) < here - STRIP_EDGE);
    const left = target ? leftOf(target) : direction > 0 ? strip.scrollWidth : 0;
    strip.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const revealChosen = () => {
    const chosen = strip.querySelector<HTMLElement>('[aria-pressed="true"]')?.closest<HTMLElement>('.timeline__item');
    if (!chosen) return;
    const left = leftOf(chosen);
    const right = left + chosen.getBoundingClientRect().width;
    if (left < strip.scrollLeft || right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - strip.clientWidth / 4), behavior: 'auto' });
    }
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  strip.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(strip);
  prev.removeAttribute('hidden');
  next.removeAttribute('hidden');
  revealChosen();
  new MutationObserver(revealChosen).observe(strip, { attributes: true, attributeFilter: ['aria-pressed'], subtree: true });
  update();
}
