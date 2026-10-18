// Geometry and wording for the two interactives (docs/spec.md section 6: ArmyDots, ShipScale). Pure functions, no DOM,
// so they are unit-tested. Every number here is a coordinate in the SVG's own viewBox, not a CSS size; colours and
// CSS sizes live in tokens.css.

/** Replaces {name} placeholders in an interface string. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));

/** A number in the reader's language: 5 000 in Portuguese, 5,000 in English. */
export const formatNumber = (n: number, lang: 'pt' | 'en'): string => new Intl.NumberFormat(lang === 'pt' ? 'pt-PT' : 'en', { maximumFractionDigits: 1, useGrouping: true }).format(n);

/** "8" or "1.5": a ratio for a sentence (whole number from 10 up, one decimal below). */
export const ratioNumber = (ratio: number, lang: 'pt' | 'en'): string => formatNumber(ratio >= 10 ? Math.round(ratio) : Math.round(ratio * 10) / 10, lang);

// ---------------------------------------------------------------- ArmyDots

export const DOT_COLUMNS = 20;
/** Side of one cell, and the dot radius, in viewBox units. */
export const DOT_CELL = 12;
export const DOT_RADIUS = 4.5;

export interface DotGroupInput {
  id: string;
  min: number;
  max: number;
  unit_per_dot: number;
}

export interface DotCounts {
  /** Filled dots: the lowest estimate. */
  solid: number;
  /** Empty dots: the rest of the range up to the highest estimate. */
  range: number;
  total: number;
}

/** Dots of one group: filled up to the low estimate, empty up to the high one; at least one dot. */
export function dotCounts(group: DotGroupInput): DotCounts {
  const total = Math.max(1, Math.round(group.max / group.unit_per_dot));
  const solid = Math.min(total, Math.max(0, Math.round(group.min / group.unit_per_dot)));
  return { solid, range: total - solid, total };
}

export interface PlacedDot {
  x: number;
  y: number;
  kind: 'solid' | 'range';
}

export interface DotLayout {
  width: number;
  height: number;
  groups: { id: string; /** Baseline of the group's name drawn above its dots. */ labelY: number; dots: PlacedDot[] }[];
}

/** Height reserved above each group for its name, in viewBox units. */
export const DOT_LABEL_ROW = 16;

/**
 * Group under group: a row for the group's name, then rows of dots, one empty row between groups. Every group has the same
 * dot size and number of columns (one scale). The name is part of the drawing, so the groups differ by position and
 * words, not by colour alone.
 */
export function layoutDots(groups: readonly DotGroupInput[], columns = DOT_COLUMNS): DotLayout {
  let top = 0;
  const placed = groups.map((group, index) => {
    if (index > 0) top += DOT_CELL;
    const labelY = top + DOT_LABEL_ROW - 4;
    top += DOT_LABEL_ROW;
    const { solid, total } = dotCounts(group);
    const dots: PlacedDot[] = [];
    for (let i = 0; i < total; i += 1) {
      dots.push({
        x: (i % columns) * DOT_CELL + DOT_CELL / 2,
        y: top + Math.floor(i / columns) * DOT_CELL + DOT_CELL / 2,
        kind: i < solid ? 'solid' : 'range',
      });
    }
    top += Math.ceil(total / columns) * DOT_CELL;
    return { id: group.id, labelY, dots };
  });
  return { width: columns * DOT_CELL, height: top, groups: placed };
}

/** Largest and smallest group by the middle of their estimates, and how many times the first holds the second. */
export function groupRatio<T extends { min: number; max: number }>(groups: readonly T[]): { big: T; small: T; ratio: number } {
  const mid = (g: T) => (g.min + g.max) / 2;
  const sorted = [...groups].sort((a, b) => mid(b) - mid(a));
  const big = sorted[0]!;
  const small = sorted[sorted.length - 1]!;
  return { big, small, ratio: mid(small) === 0 ? Infinity : mid(big) / mid(small) };
}

// ---------------------------------------------------------------- ShipScale

export const SHIP_WIDTH = 400;
export const SHIP_PAD = 16;
export const SHIP_ROW = 96;
/** Height of a silhouette when the data gives none, as a share of its length. */
export const SHIP_DEFAULT_HEIGHT = 0.3;

export interface ShipInput {
  id: string;
  length_m: number;
  height_m?: number | undefined;
}

export interface ShipShape {
  id: string;
  /** Length and height on the drawing, same scale for every ship. */
  length: number;
  height: number;
  hull: string;
  mast: string;
  sail: string;
}

const r = (n: number) => Math.round(n * 10) / 10;

/** A simple placeholder silhouette (hull, mast, sail) with its bottom-left corner at (0, 0); y grows downwards, so the ship is drawn upwards. */
export function silhouette(length: number, height: number): Pick<ShipShape, 'hull' | 'mast' | 'sail'> {
  const hullDepth = height * 0.3;
  const mastX = length * 0.5;
  const sail = length * 0.2;
  const top = -height;
  const deck = -hullDepth;
  return {
    hull: `M0 ${r(deck)}L${r(length)} ${r(deck)}L${r(length * 0.92)} 0L${r(length * 0.08)} 0Z`,
    mast: `M${r(mastX)} ${r(deck)}L${r(mastX)} ${r(top)}`,
    sail: `M${r(mastX - sail)} ${r(top + height * 0.08)}L${r(mastX + sail)} ${r(top + height * 0.08)}L${r(mastX + sail)} ${r(deck - height * 0.04)}L${r(mastX - sail)} ${r(deck - height * 0.04)}Z`,
  };
}

/** One scale for all ships: the longest one fills the width. */
export function shipShapes(items: readonly ShipInput[]): { scale: number; ships: ShipShape[]; rowHeight: number } {
  const longest = Math.max(...items.map((i) => i.length_m));
  const scale = (SHIP_WIDTH - 2 * SHIP_PAD) / longest;
  const ships = items.map((item) => {
    const length = item.length_m * scale;
    const height = (item.height_m ?? item.length_m * SHIP_DEFAULT_HEIGHT) * scale;
    return { id: item.id, length, height, ...silhouette(length, height) };
  });
  const tallest = Math.max(...ships.map((s) => s.height));
  return { scale, ships, rowHeight: Math.max(SHIP_ROW, Math.ceil(tallest) + 28) };
}

/** Largest and smallest ship by length and how many times longer the first is. */
export function shipRatio<T extends { length_m: number }>(items: readonly T[]): { big: T; small: T; ratio: number } {
  const sorted = [...items].sort((a, b) => b.length_m - a.length_m);
  const big = sorted[0]!;
  const small = sorted[sorted.length - 1]!;
  return { big, small, ratio: big.length_m / small.length_m };
}
