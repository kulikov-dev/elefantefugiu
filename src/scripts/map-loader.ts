// Map "island" loader. Small on purpose: it only decides WHEN to load the map.
// Leaflet, its styles and the map code are a separate chunk, fetched when the block scrolls into view.
// Without JavaScript none of this runs: the block and the filters stay hidden and the plain list is shown.

const roots = [...document.querySelectorAll<HTMLElement>('[data-map]')];

/** The map cannot be shown (chunk not loaded, tiles not loaded): say so and fall back to the list. */
function showUnavailable(root: HTMLElement) {
  root.dataset.state = 'unavailable';
  root.removeAttribute('aria-busy');
  root.querySelector<HTMLElement>('[data-map-unavailable]')?.removeAttribute('hidden');
  // Map page: the plain list of all cards takes over; otherwise the "In this area" list shows everything.
  const plain = document.querySelector<HTMLElement>('[data-map-static]');
  if (plain) {
    plain.hidden = false;
    root.querySelector<HTMLElement>('[data-map-list]')?.setAttribute('hidden', '');
  }
  root.dispatchEvent(new CustomEvent('map:unavailable', { bubbles: true }));
}

for (const root of roots) {
  root.hidden = false;
  root.dataset.state = 'loading';
  root.setAttribute('aria-busy', 'true');
  for (const el of document.querySelectorAll<HTMLElement>('[data-map-js]')) el.hidden = false;
  const plain = document.querySelector<HTMLElement>('[data-map-static]');
  if (plain) plain.hidden = true;

  const start = () => {
    import('./map-island')
      .then((island) => island.mount(root, () => showUnavailable(root)))
      .catch(() => showUnavailable(root));
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(root);
  } else {
    start();
  }
}
