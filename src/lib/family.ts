// Family mode: which cards a reader sees, by age label and heavy topic (docs/spec.md 3.6, docs/design.md 2.1).
// Pure functions without Astro or DOM imports, so they run in plain unit tests. The same functions are used
// at build time (counters, variants, the gate text) and in the browser ("Surprise me", the map).
//
// Rules:
//   off  every card
//   all  min_age "all", never a heavy topic
//   12   min_age "all" or "12", never a heavy topic
// The "Heavy topic" label on a card does not depend on the mode.

export type FamilyMode = 'off' | 'all' | '12';
export type MinAge = 'all' | '12' | '16';

/** All modes, in the order of the toggle. */
export const FAMILY_MODES: readonly FamilyMode[] = ['off', 'all', '12'];
export const FAMILY_KEY = 'family';
export const DEFAULT_FAMILY_MODE: FamilyMode = 'off';

/** What the filter needs to know about a card; `minAge` and `sensitive` are normalised before use. */
export interface AgeInfo {
  minAge: unknown;
  sensitive: unknown;
}

/** Adapter for event data (`min_age`, `sensitive`). */
export const ageInfoOf = (event: { min_age: unknown; sensitive: unknown }): AgeInfo => ({
  minAge: event.min_age,
  sensitive: event.sensitive,
});

/** A stored or typed value to a mode. Anything unknown means "off" (nothing is hidden by mistake). */
export function normalizeFamilyMode(value: unknown): FamilyMode {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'all') return 'all';
  if (text === '12' || text === '12+') return '12';
  return 'off';
}

/**
 * A value to an age label: 12, "12", " 12+ ", "ALL" are accepted.
 * An unknown value counts as "16", the strictest label: a card with a broken label is hidden, never shown by mistake.
 */
export function normalizeMinAge(value: unknown): MinAge {
  const text = String(value ?? '').trim().toLowerCase().replace(/\+$/, '');
  if (text === 'all') return 'all';
  if (text === '12') return '12';
  return '16';
}

/** `true`, "true", "1", "yes" mean heavy; `false`, "false", "0", "no", "" and a missing value mean not heavy; anything else is heavy (fail closed). */
export function normalizeSensitive(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  if (['false', '0', 'no', ''].includes(text)) return false;
  return true;
}

/** Is the card shown in this mode? */
export function isVisibleInMode(card: AgeInfo, mode: FamilyMode): boolean {
  if (mode === 'off') return true;
  if (normalizeSensitive(card.sensitive)) return false;
  const age = normalizeMinAge(card.minAge);
  return mode === 'all' ? age === 'all' : age === 'all' || age === '12';
}

/** The cards shown in this mode, in the same order. The input is not changed. */
export function filterByFamily<T extends AgeInfo>(cards: readonly T[], mode: FamilyMode): T[] {
  return cards.filter((card) => isVisibleInMode(card, mode));
}

/** Modes in which the card is shown / hidden. */
export const visibleModes = (card: AgeInfo): FamilyMode[] => FAMILY_MODES.filter((mode) => isVisibleInMode(card, mode));
export const hiddenModes = (card: AgeInfo): FamilyMode[] => FAMILY_MODES.filter((mode) => !isVisibleInMode(card, mode));

/** Number of shown cards per mode: the three numbers that counters carry in the markup. */
export function countByMode(cards: readonly AgeInfo[]): Record<FamilyMode, number> {
  return { off: filterByFamily(cards, 'off').length, all: filterByFamily(cards, 'all').length, '12': filterByFamily(cards, '12').length };
}

/** "Surprise me": never a heavy topic; in "off" any age; in the other modes the cards the mode shows. */
export function isSurpriseAllowed(card: AgeInfo, mode: FamilyMode): boolean {
  return !normalizeSensitive(card.sensitive) && isVisibleInMode(card, mode);
}

export interface GateReason {
  /** The age label that hides the card in this mode, or null when the age is not the reason. */
  age: '12' | '16' | null;
  /** True when the heavy topic hides the card. */
  heavy: boolean;
}

/** Why the card is hidden in this mode (for the intermediate screen); both empty when it is shown. */
export function gateReason(card: AgeInfo, mode: FamilyMode): GateReason {
  if (isVisibleInMode(card, mode)) return { age: null, heavy: false };
  const age = normalizeMinAge(card.minAge);
  const ageHides = mode === 'all' ? age !== 'all' : age === '16';
  return { age: ageHides ? (age === '12' ? '12' : '16') : null, heavy: normalizeSensitive(card.sensitive) };
}

/** Attributes every list item with a card carries; the CSS in family.css hides the item by them. */
export function familyAttrs(card: { min_age: unknown; sensitive: unknown }): { 'data-min-age': MinAge; 'data-sensitive': 'true' | 'false' } {
  return { 'data-min-age': normalizeMinAge(card.min_age), 'data-sensitive': String(normalizeSensitive(card.sensitive)) as 'true' | 'false' };
}

export interface FamilyVariant<T> {
  /** The modes this variant is shown in. */
  modes: FamilyMode[];
  value: T;
}

/**
 * Computes a value for each mode and merges the modes that give the same result (compared with `key`).
 * Used for everything that depends on the mode but cannot be hidden item by item:
 * counters, "Nearby", previous / next. The markup then holds one block per distinct result.
 */
export function groupVariants<T>(compute: (mode: FamilyMode) => T, key: (value: T) => string = (v) => JSON.stringify(v)): FamilyVariant<T>[] {
  const variants: FamilyVariant<T>[] = [];
  const keys: string[] = [];
  for (const mode of FAMILY_MODES) {
    const value = compute(mode);
    const k = key(value);
    const at = keys.indexOf(k);
    if (at >= 0) variants[at]!.modes.push(mode);
    else {
      keys.push(k);
      variants.push({ modes: [mode], value });
    }
  }
  return variants;
}

/** Counters in three variants: [{modes: [off, all, 12], value: 8}] when all three numbers are equal. */
export const countVariants = (counts: Record<FamilyMode, number>): FamilyVariant<number>[] => groupVariants((mode) => counts[mode], String);

/** Modes in which a counter is zero (the element it belongs to is then hidden or replaced by a message). */
export const zeroModes = (counts: Record<FamilyMode, number>): FamilyMode[] => FAMILY_MODES.filter((mode) => counts[mode] === 0);
