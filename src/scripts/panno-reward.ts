// The reward of a panel read to the end (docs/spec.md 5.2): the enlarged panel in a native <dialog>, and "Share". src/scripts/read-marks.ts decides when the two
// controls are shown (every story read); this file only wires them. The enlarged picture is asked for when the dialog is first opened.

/** The share line of the panel: the Web Share API when the browser has it, otherwise the link is copied and a quiet line says so for 2 seconds. */
function wireShare(panel: HTMLElement): void {
  const button = panel.querySelector<HTMLButtonElement>('[data-panno-share]');
  const status = panel.querySelector<HTMLElement>('[data-panno-status]');
  if (!button || !status) return;
  let timer: number | undefined;
  const say = (message: string, ms: number): void => {
    status.textContent = message;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => (status.textContent = ''), ms);
  };
  button.addEventListener('click', async () => {
    const d = panel.dataset;
    const url = new URL(d.shareUrl ?? '', location.href).href;
    // The one event of the panel: "panno-share-<epoch>", on the press itself (the counter is the one already on the site; without it nothing breaks).
    try {
      const counter = (window as unknown as { goatcounter?: { count?: (vars: { path: string; title: string; event: true }) => void } }).goatcounter;
      if (typeof counter?.count === 'function') counter.count({ path: `panno-share-${d.epochId ?? ''}`, title: d.shareTitle ?? '', event: true });
    } catch {
      // The counter failed: nothing to tell the reader.
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: d.shareTitle ?? '', text: d.shareText ?? '', url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return; // the reader closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      say(d.copied ?? '', 2000);
    } catch {
      say(`${d.copyFailed ?? ''} ${url}`, 6000);
    }
  });
}

/** The enlarged panel: opens from the button over the panel, closes with the cross, Esc or a click beside the picture; the focus goes back to the button. */
function wireZoom(panel: HTMLElement): void {
  const zoom = panel.querySelector<HTMLButtonElement>('[data-panno-zoom]');
  const dialog = panel.querySelector<HTMLDialogElement>('[data-panno-dialog]');
  const scroll = panel.querySelector<HTMLElement>('[data-panno-scroll]');
  const image = panel.querySelector<HTMLImageElement>('[data-panno-full]');
  const close = panel.querySelector<HTMLButtonElement>('[data-panno-close]');
  if (!zoom || !dialog || !scroll || !image || !close || typeof dialog.showModal !== 'function') return;
  // On a phone held upright the picture is wider than the screen: it is opened scrolled to its middle.
  const centre = (): void => {
    scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) / 2;
  };
  image.addEventListener('load', centre);
  zoom.addEventListener('click', () => {
    if (!image.getAttribute('src')) {
      image.src = panel.dataset.imageFull ?? '';
    }
    dialog.showModal();
    centre();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target === scroll) dialog.close();
  });
  dialog.addEventListener('close', () => zoom.focus());
}

export function wirePannoReward(panel: HTMLElement): void {
  wireShare(panel);
  wireZoom(panel);
}
