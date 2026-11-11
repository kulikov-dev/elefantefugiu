// The pieces of an answer that are the same in "Myth or fact" (made by Astro: src/components/MythVerdict.astro, StoryPlate.astro) and in "Which came first?" (made in the browser: here): the label of a verdict and the plate
// that leads to a story. The same classes and the same markup, styled once (src/styles/layout.css).
import { verdictIcon, type VerdictKind } from '../lib/verdict';

/** The label of a verdict: an icon (a check for a right guess, a cross for a wrong one) and the text, in the colours of `--color-verdict-*`. */
export function verdictLabel(kind: VerdictKind, text: string): HTMLElement {
  const el = document.createElement('span');
  el.className = `verdict verdict--${kind}`;
  el.innerHTML = verdictIcon(kind);
  el.append(text);
  return el;
}

/** The plate under an answer: the thumbnail (decorative), the title and "Whole story →". */
export function storyPlate(o: { href: string; title: string; thumb?: { src: string; srcset?: string } | undefined; more: string }): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'story-plate';
  a.href = o.href;
  if (o.thumb) {
    const img = document.createElement('img');
    img.className = 'story-plate__thumb';
    img.alt = '';
    img.src = o.thumb.src;
    if (o.thumb.srcset) {
      img.srcset = o.thumb.srcset;
      img.sizes = '6rem';
    }
    img.loading = 'lazy';
    a.append(img);
  }
  const text = document.createElement('span');
  text.className = 'story-plate__text';
  const title = document.createElement('span');
  title.className = 'story-plate__title';
  title.textContent = o.title;
  const more = document.createElement('span');
  more.className = 'story-plate__more';
  more.textContent = o.more;
  text.append(title, more);
  a.append(text);
  return a;
}
