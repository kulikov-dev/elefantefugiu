// The small map of the home page: draws it only when the block comes near the screen (the Leaflet chunk is fetched then, not
// before). Without JavaScript the block stays a caption with a link to the map page.
const root = document.querySelector<HTMLElement>('[data-home-map]');

if (root) {
  const start = () => {
    import('./home-map-island')
      .then((island) => island.mount(root))
      .catch(() => {
        root.dataset.state = 'unavailable';
      });
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
