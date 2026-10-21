// Azulejo patterns (docs/visual-direction.md section 4). Four one-colour SVG files in src/assets/azulejo/ are used as CSS
// masks; the colour comes from the epoch tokens. Which pattern belongs to which epoch is decided here, the files are
// imported in BaseLayout (?url, so the address keeps the base path).

export type AzulejoName = 'bussola' | 'rombo' | 'rosa' | 'canto';

/** Pattern of an epoch: compass (Avis and the Discoveries), rhombus (Pombal and 1755), rose (Estado Novo and 25 April). */
export const EPOCH_PATTERN: Record<string, Exclude<AzulejoName, 'canto'>> = {
  'avis-e-descobrimentos': 'bussola',
  'pombal-e-terramoto': 'rombo',
  'estado-novo-e-25-de-abril': 'rosa',
};

/** Pattern for pages outside an epoch (the 404 page uses the corner signature only). */
export const DEFAULT_PATTERN: Exclude<AzulejoName, 'canto'> = 'bussola';

export function patternFor(epoch: string | undefined): Exclude<AzulejoName, 'canto'> {
  return (epoch && EPOCH_PATTERN[epoch]) || DEFAULT_PATTERN;
}

/** An address (or data: URI) as a CSS url("...") value that survives an inline <style>. */
export function cssUrl(address: string): string {
  return `url("${address.replace(/\/g, '%5C').replace(/"/g, '%22').replace(/[\r\n]/g, '')}")`;
}

/** The custom properties the stylesheet reads: the epoch's pattern and the corner signature. */
export function azulejoRule(files: Record<AzulejoName, string>, epoch: string | undefined): string {
  return `:root{--azulejo-url:${cssUrl(files[patternFor(epoch)])};--azulejo-corner-url:${cssUrl(files.canto)}}`;
}
