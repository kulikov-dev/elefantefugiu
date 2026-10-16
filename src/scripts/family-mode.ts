// What other scripts need from family mode: the current mode and a way to hear about changes.
// The mode lives on <html data-family>, put there before the first paint by the script in <head>.
import { normalizeFamilyMode, type FamilyMode } from '../lib/family';

export const currentFamilyMode = (): FamilyMode => normalizeFamilyMode(document.documentElement.dataset.family);

/** Calls back after the reader changes the mode (toggle, another tab, "Show all modes"). */
export function onFamilyChange(callback: (mode: FamilyMode) => void): void {
  document.addEventListener('family:change', (event) => callback(normalizeFamilyMode((event as CustomEvent<{ mode: FamilyMode }>).detail?.mode)));
}
