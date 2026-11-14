// The magnifier of the header (src/components/SearchButton.astro) is a link to the page of the search. With JavaScript the press opens the search over the
// page instead; the script of the search itself (src/scripts/search-ui.ts, with its styles) is read on the first press, so no page carries its weight.
// A press with a modifier key or a middle button is left to the browser (a new tab on the page of the search). If the script cannot be read, the link works.
document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('[data-search-open]') : null;
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (document.querySelector('[data-search-page]')) return; // the page of the search holds the field itself (search-page.ts)
  event.preventDefault();
  // The module opens the search on this event (no import of its exports: the loader stays small and the module brings nothing else with it).
  import('./search-ui').then(() => link.dispatchEvent(new CustomEvent('search:open', { bubbles: true })), () => location.assign(link.href));
});
