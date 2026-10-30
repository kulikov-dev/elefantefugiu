// Arrows of the time strip on the home page (from 48rem up; the CSS hides them below): each press scrolls the strip by one epoch, the arrow at the
// end of the strip is disabled. Without this script the buttons stay hidden and the strip is scrolled by hand (finger, trackpad, keyboard).
const strip = document.querySelector<HTMLElement>('[data-timeline-scroller]');
const prev = document.querySelector<HTMLButtonElement>('[data-timeline-prev]');
const next = document.querySelector<HTMLButtonElement>('[data-timeline-next]');
const EDGE = 2; // pixels of tolerance for fractional widths

if (strip && prev && next) {
  const items = [...strip.querySelectorAll<HTMLElement>('.timeline__item')];
  /** Where the left edge of an epoch stands inside the scrolled strip. */
  const leftOf = (item: HTMLElement) => item.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;

  const update = () => {
    const max = strip.scrollWidth - strip.clientWidth;
    prev.disabled = strip.scrollLeft <= EDGE;
    next.disabled = max <= EDGE || strip.scrollLeft >= max - EDGE;
  };

  const go = (direction: 1 | -1) => {
    const here = strip.scrollLeft;
    const target = direction > 0 ? items.find((item) => leftOf(item) > here + EDGE) : [...items].reverse().find((item) => leftOf(item) < here - EDGE);
    const left = target ? leftOf(target) : direction > 0 ? strip.scrollWidth : 0;
    strip.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  strip.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(strip);
  prev.removeAttribute('hidden');
  next.removeAttribute('hidden');
  update();
}
