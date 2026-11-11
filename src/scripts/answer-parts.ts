// The label of a verdict is the same in "Myth or fact" (made by Astro: src/components/MythVerdict.astro) and in "Which came first?" (made in the browser: here). The same classes and the same markup, styled once (src/styles/layout.css).
import { verdictIcon, type VerdictKind } from '../lib/verdict';

/** The label of a verdict: an icon (a check for a right guess, a cross for a wrong one) and the text, in the colours of `--color-verdict-*`. */
export function verdictLabel(kind: VerdictKind, text: string): HTMLElement {
  const el = document.createElement('span');
  el.className = `verdict verdict--${kind}`;
  el.innerHTML = verdictIcon(kind);
  el.append(text);
  return el;
}
