// The pictures of the cabinet of rarities, as SVG strings (docs/drafts/cabinet-mockup.html): the tin of sardines, one sardine, the garlands of the holiday.
// Colours are the --cab-* tokens of src/styles/tokens.css (a presentation attribute reads var() too), so the pictures follow the theme. Pure functions, no DOM.
import { SARDINES } from './cabinet';

const BODY = 'M15 0 C30 -7.5 68 -9.5 108 -9 C128 -8.6 142 -6.5 150 -3 Q156 -.5 156 .5 Q153 3 146 5.5 C134 8.6 118 9.2 104 9.2 C66 9.4 30 7.5 15 0 Z';
const TAIL = 'M17 0 L2 -8.5 Q8 0 2 8.5 Z';

const fishGradient = (id: string): string =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cab-fish-a)"/><stop offset=".35" stop-color="var(--cab-fish-b)"/><stop offset=".52" stop-color="var(--cab-fish-c)"/><stop offset=".8" stop-color="var(--cab-fish-d)"/><stop offset="1" stop-color="var(--cab-fish-e)"/></linearGradient>`;

/** The body of a sardine drawn at the origin (nose to the right), without its wrapper. */
function sardineBody(gradient: string): string {
  let spots = '';
  for (let k = 0; k < 5; k++) spots += `<circle cx="${(112 + k * 5.2).toFixed(1)}" cy="${(-3.4 + k * 0.15).toFixed(2)}" r="1.1" fill="var(--cab-fish-line)" opacity=".55"/>`;
  return (
    `<path d="${TAIL}" fill="var(--cab-fish-fin)" stroke="var(--cab-fish-line)" stroke-width=".8"/>` +
    `<path d="M74 -9.2 L82 -13 L90 -9.1 Z" fill="var(--cab-fish-fin)" stroke="var(--cab-fish-line)" stroke-width=".6"/>` +
    `<path d="${BODY}" fill="url(#${gradient})" stroke="var(--cab-fish-line)" stroke-width=".9"/>` +
    `<path d="M22 0 C60 -1.6 108 -1.8 132 -1" fill="none" stroke="var(--cab-fish-eye)" stroke-width=".9" opacity=".8"/>` +
    spots +
    `<path d="M136 -7.2 Q130 0 137 6.6" fill="none" stroke="var(--cab-fish-line)" stroke-width=".9"/>` +
    `<circle cx="146" cy="-1.6" r="2.3" fill="var(--cab-fish-eye)" stroke="var(--cab-fish-line)" stroke-width=".6"/><circle cx="146.4" cy="-1.6" r="1.1" fill="var(--cab-fish-line)"/>`
  );
}

/** One sardine, alone (the hidden ones on the pages). `uid` keeps the gradient id unique on the page. */
export const sardineSvg = (uid: string): string =>
  `<svg viewBox="0 -14 158 24" aria-hidden="true" focusable="false"><defs>${fishGradient(`${uid}-g`)}</defs>${sardineBody(`${uid}-g`)}</svg>`;

/** The tin with `caught` sardines in it (the rest are dashed places), 7 places in all. */
export function tinSvg(caught: number, uid: string): string {
  const slots: string[] = [];
  for (let i = 0; i < SARDINES; i++) {
    const y = 55 + i * 11;
    const transform = i % 2 === 1 ? `translate(196 ${y}) scale(-1 1)` : `translate(28 ${y})`;
    if (i < caught) slots.push(`<g transform="${transform}">${sardineBody(`${uid}-g`)}</g>`);
    else slots.push(`<g transform="${transform}" opacity=".5"><path d="${BODY}" fill="none" stroke="var(--cab-gold-dash)" stroke-width="1" stroke-dasharray="3 3"/><path d="${TAIL}" fill="none" stroke="var(--cab-gold-dash)" stroke-width="1" stroke-dasharray="2 2"/></g>`);
  }
  return (
    `<svg viewBox="0 0 262 152" aria-hidden="true" focusable="false"><defs>${fishGradient(`${uid}-g`)}` +
    `<linearGradient id="${uid}-can" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--cab-can-a)"/><stop offset=".5" stop-color="var(--cab-can-b)"/><stop offset="1" stop-color="var(--cab-can-c)"/></linearGradient>` +
    `<linearGradient id="${uid}-oil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cab-oil-a)"/><stop offset="1" stop-color="var(--cab-oil-b)"/></linearGradient>` +
    `<linearGradient id="${uid}-coil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--cab-coil-a)"/><stop offset=".45" stop-color="var(--cab-coil-b)"/><stop offset="1" stop-color="var(--cab-coil-a)"/></linearGradient>` +
    `<clipPath id="${uid}-in"><rect x="22" y="44" width="180" height="84" rx="15"/></clipPath></defs>` +
    `<ellipse cx="118" cy="142" rx="104" ry="7" fill="var(--color-text)" opacity=".12"/>` +
    `<rect x="12" y="34" width="200" height="104" rx="24" fill="url(#${uid}-can)" stroke="var(--color-text)" stroke-width="1.6"/>` +
    `<rect x="18" y="40" width="188" height="92" rx="19" fill="none" stroke="var(--cab-can-shine)" stroke-width="1.5" opacity=".7"/>` +
    `<rect x="22" y="44" width="180" height="84" rx="15" fill="url(#${uid}-oil)" stroke="var(--cab-rim)" stroke-width="1.2"/>` +
    `<g clip-path="url(#${uid}-in)">${slots.join('')}<path d="M30 52 C70 46 130 46 190 52" stroke="var(--cab-can-shine)" stroke-width="2" opacity=".35" fill="none"/></g>` +
    `<rect x="204" y="38" width="22" height="96" rx="11" fill="url(#${uid}-coil)" stroke="var(--color-text)" stroke-width="1.4"/>` +
    `<path d="M206 58h18M206 72h18M206 100h18M206 114h18" stroke="var(--cab-gold)" stroke-width="3"/>` +
    `<path d="M206 86h18" stroke="var(--cab-can-shine)" stroke-width="5"/><path d="M206 86h18" stroke="var(--cab-flag-4)" stroke-width="2"/>` +
    `<path d="M226 86 H238" stroke="var(--cab-rim)" stroke-width="4" stroke-linecap="round"/>` +
    `<ellipse cx="246" cy="86" rx="9" ry="13" fill="none" stroke="var(--cab-rim)" stroke-width="4"/>` +
    `<ellipse cx="246" cy="86" rx="9" ry="13" fill="none" stroke="var(--color-text)" stroke-width="1"/></svg>`
  );
}

/** The step of the flags on the cord, px. */
export const BUNTING_STEP = 34;

/**
 * The bunting of the finished cabinet: the cord sags a little between the two edges of a block `width` px wide, and a flag hangs at every step, its point down, turned to the tangent of the cord.
 * Five colours (white with a thin outline). The width is the real width of the block, so nothing is stretched.
 */
export function buntingSvg(width: number, height: number): string {
  const y0 = 2;
  const sag = Math.min(16, height / 4);
  const count = Math.max(1, Math.round(width / BUNTING_STEP));
  let flags = '';
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = width * t;
    const y = y0 + 2 * sag * t * (1 - t);
    const angle = (Math.atan((2 * sag * (1 - 2 * t)) / width) * 180) / Math.PI;
    flags += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})"><path d="M-9 0 H9 L0 22 Z" fill="var(--cab-flag-${(i % 5) + 1})" stroke="var(--cab-flag-line)" stroke-width=".6"/></g>`;
  }
  return `<path d="M0 ${y0} Q${(width / 2).toFixed(1)} ${y0 + 2 * sag} ${width.toFixed(1)} ${y0}" fill="none" stroke="var(--color-muted)" stroke-width="1.2"/>${flags}`;
}
