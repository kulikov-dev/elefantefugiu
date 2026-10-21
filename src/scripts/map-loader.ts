// Map "island" loader. Small on purpose: it only decides WHEN to draw the map.
// Leaflet, its styles and the map code are a separate chunk, fetched as soon as the page has loaded (pages with a map only).
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

  // The map code is fetched as soon as the page has loaded (about 46 KB gzip), wherever the block is. Drawing the map waits
  // until the block can be seen: a hidden block (the phone's "Map" pane while the timeline shows) has no size yet, and
  // the tiles are only worth fetching for a map that is on the way into view (one screen of margin).
  const code = import('./map-island');
  const start = () => {
    code.then((island) => island.mount(root, () => showUnavailable(root))).catch(() => showUnavailable(root));
  };
  code.catch(() => showUnavailable(root));

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: '100%' },
    );
    observer.observe(root);
  } else {
    start();
  }
}
