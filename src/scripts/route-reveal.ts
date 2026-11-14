// The route map (src/components/RouteMap.astro): the line is drawn once, when the map comes into view (about 1.2 s, the transition is in the component's CSS).
// Without this script, or with "reduce motion", the line is whole from the start.
const maps = document.querySelectorAll<HTMLElement>('[data-route]');

if (maps.length > 0 && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('route--in');
        seen.unobserve(entry.target);
      }
    },
    { threshold: 0.4 },
  );
  for (const map of maps) {
    map.classList.add('route--armed');
    seen.observe(map);
  }
}
