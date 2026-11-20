// The pictures of the cabinet of rarities: the sardine and the tin (watercolour PNGs cut out by scripts/make-cabinet-shelf.mjs, served from /cabinet-art/) and the garlands of the holiday (SVG).
// The tin is made of tin.png and seven copies of sardine.png laid in the oil one under another; a sardine not found yet is a dashed outline (sardine-outline.svg as a mask). Pure functions, no DOM.
import { withBase } from '../i18n/routes';
import { SARDINES } from './cabinet';

/** Sizes of the cut pictures in docs/images/cabinet/art (printed by scripts/make-cabinet-shelf.mjs). */
export const SARDINE_SIZE = { width: 360, height: 125 } as const;
export const TIN_SIZE = { width: 720, height: 366 } as const;
/** The oil in tin.png, as a share of the picture: from 7% to 62% across, from 10% to 90% down. */
const OIL = { left: 7, right: 62, top: 10, bottom: 90 } as const;

const art = (file: string): string => withBase(`cabinet-art/${file}`);

/** One sardine, alone (the hidden ones on the pages). */
export const sardineHtml = (): string => `<img src="${art('sardine.png')}" width="${SARDINE_SIZE.width}" height="${SARDINE_SIZE.height}" alt="" decoding="async">`;

/**
 * The tin with `caught` sardines in it, SARDINES places in all. The sardines are as wide as the oil, one under another with a step of (height of the oil - height of a sardine) / 6, overlapping,
 * every second one turned round; a place not found yet is the dashed outline of the fish.
 */
export function tinHtml(caught: number): string {
  const width = OIL.right - OIL.left;
  // The height of a sardine as a share of the height of the tin.
  const fish = (width * TIN_SIZE.width * SARDINE_SIZE.height) / (SARDINE_SIZE.width * TIN_SIZE.height);
  const step = (OIL.bottom - OIL.top - fish) / (SARDINES - 1);
  let places = '';
  for (let i = 0; i < SARDINES; i++) {
    const style = `left:${OIL.left}%;top:${(OIL.top + i * step).toFixed(2)}%;width:${width}%`;
    const flip = i % 2 === 1 ? ' tin__fish--flip' : '';
    places += i < caught ? `<img class="tin__fish${flip}" style="${style}" src="${art('sardine.png')}" alt="" decoding="async">` : `<span class="tin__fish tin__fish--empty${flip}" style="${style}"></span>`;
  }
  return (
    `<span class="tin" style="--tin-ratio:${TIN_SIZE.width}/${TIN_SIZE.height};--tin-outline:url('${art('sardine-outline.svg')}')">` +
    `<img class="tin__body" src="${art('tin.png')}" width="${TIN_SIZE.width}" height="${TIN_SIZE.height}" alt="" decoding="async">${places}</span>`
  );
}

/** The cord is fixed at two points this far from the corners of the card, px. */
const BUNTING_INSET = 18;
const BUNTING_TOP = 10;
const BUNTING_SAG = 24;
const BUNTING_FLAG = { width: 20, height: 24, gap: 8 };
/** Four colours, no white. */
const BUNTING_COLOURS = [1, 2, 3, 4];

/**
 * The bunting of the finished cabinet (the same drawing as docs/drafts/cabinet-mockup-v4): the cord hangs from two points 18 px inside the corners of a card `width` px wide and sags about 24 px;
 * flags 20 x 24 with an 8 px gap, the top corners of every flag lie on the cord, the point is straight down. The width is the real width of the card, so nothing is stretched.
 */
export function buntingSvg(width: number): string {
  const x0 = BUNTING_INSET;
  const x1 = width - BUNTING_INSET;
  const y0 = BUNTING_TOP;
  const length = x1 - x0;
  const sag = Math.min(BUNTING_SAG, length * 0.04);
  const cordY = (x: number): number => {
    const t = (x - x0) / length;
    return y0 + 4 * sag * t * (1 - t);
  };
  const { width: fw, height: fh, gap } = BUNTING_FLAG;
  const count = Math.max(0, Math.floor((length - 24 + gap) / (fw + gap)));
  const start = x0 + (length - (count * fw + (count - 1) * gap)) / 2;
  const f = (n: number): string => n.toFixed(1);
  let out = `<path d="M${x0} ${y0} Q${f(x0 + length / 2)} ${f(y0 + 2 * sag)} ${f(x1)} ${y0}" fill="none" stroke="var(--color-muted)" stroke-width="1.4"/>`;
  out += `<circle cx="${x0}" cy="${y0}" r="2.6" fill="var(--color-muted)"/><circle cx="${f(x1)}" cy="${y0}" r="2.6" fill="var(--color-muted)"/>`;
  for (let i = 0; i < count; i++) {
    const xl = start + i * (fw + gap);
    const xr = xl + fw;
    const yl = cordY(xl);
    const yr = cordY(xr);
    const colour = BUNTING_COLOURS[i % BUNTING_COLOURS.length];
    out += `<path d="M${f(xl)} ${f(yl)} L${f(xr)} ${f(yr)} L${f(xl + fw / 2)} ${f(Math.max(yl, yr) + fh)} Z" fill="var(--cab-flag-${colour})"/>`;
  }
  return out;
}
