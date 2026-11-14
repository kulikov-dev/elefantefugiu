// The page of the search (src/views/SearchView.astro): the field stands in the page. The script of the search is read here at once (the page is made for it).
const host = document.querySelector<HTMLElement>('[data-search-page]');
if (host) {
  import('./search-ui').then(
    () => host.dispatchEvent(new CustomEvent('search:mount', { bubbles: true })),
    () => undefined, // the page keeps its text for a reader without the search (hidden stays on the field)
  );
  // The magnifier of the header, on this page, takes the focus to the field.
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-search-open]') || event.button !== 0) return;
    event.preventDefault();
    host.querySelector<HTMLInputElement>('.search__input')?.focus();
  });
}
