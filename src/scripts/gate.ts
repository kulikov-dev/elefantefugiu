// Card page, family mode: the intermediate screen for a card the current mode hides (docs/spec.md 3.6).
// The card is in the HTML all the time; CSS hides it while the screen is up (family.css, data-gate-modes).
//   "Open"  shows the card for this visit only: the mode does not change and nothing is stored.
//   "Back"  goes back when the reader came from this site; otherwise the link leads to the epoch page.
// The hash (#detalhes, #historia) stays in the address, so a shared link keeps working after "Open".
const card = document.querySelector<HTMLElement>('[data-gate-modes]');

if (card) {
  const openButton = card.querySelector<HTMLButtonElement>('[data-gate-open]');
  const backLink = card.querySelector<HTMLAnchorElement>('[data-gate-back]');

  openButton?.addEventListener('click', () => {
    card.setAttribute('data-gate-open', '');
    // Focus and scroll go to the card: the title first, or the layer the hash points at.
    const heading = card.querySelector<HTMLElement>('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    (target ?? heading)?.scrollIntoView({ block: 'start' });
  });

  backLink?.addEventListener('click', (event) => {
    let fromThisSite = false;
    try {
      fromThisSite = history.length > 1 && document.referrer !== '' && new URL(document.referrer).origin === location.origin;
    } catch {
      // An odd referrer: use the link.
    }
    if (fromThisSite) {
      event.preventDefault();
      history.back();
    }
  });
}
