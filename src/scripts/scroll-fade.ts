// A strip that scrolls sideways (the time strip of the home page, the scale of epochs on the map page, the tabs of an epoch on a phone)
// shows with a fade where there is more behind the edge: data-fade-start / data-fade-end on the element, which layout.css turns into a mask.
const STRIPS = [...document.querySelectorAll<HTMLElement>('[data-scroll-fade]')];
const EDGE = 2; // pixels of tolerance for fractional widths

const update = (strip: HTMLElement) => {
  const max = strip.scrollWidth - strip.clientWidth;
  const left = Math.abs(strip.scrollLeft);
  strip.toggleAttribute('data-fade-start', max > EDGE && left > EDGE);
  strip.toggleAttribute('data-fade-end', max > EDGE && left < max - EDGE);
};

for (const strip of STRIPS) {
  update(strip);
  strip.addEventListener('scroll', () => update(strip), { passive: true });
}
if (STRIPS.length > 0) {
  window.addEventListener('resize', () => STRIPS.forEach(update));
  // Fonts and images arriving later change the widths.
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver((entries) => entries.forEach((e) => update(e.target as HTMLElement)));
    for (const strip of STRIPS) {
      observer.observe(strip);
      if (strip.firstElementChild) observer.observe(strip.firstElementChild);
    }
  }
}
