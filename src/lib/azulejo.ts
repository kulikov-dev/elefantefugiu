// Azulejo patterns (docs/visual-direction.md section 4). Seven one-colour SVG files in src/assets/azulejo/ are used as CSS
// masks; the colour comes from the epoch tokens. Which pattern belongs to which epoch is decided here, the files are
// imported in BaseLayout (?url, so the address keeps the base path).

export type AzulejoName = 'bussola' | 'rombo' | 'rosa' | 'no' | 'tapete' | 'onda' | 'canto' | 'no-v' | 'onda-v';

/**
 * Patterns that run in one direction (the braid, the waves): a band lays them left to right, the vertical strip along the timeline needs the tile
 * turned by 90 degrees (the file `<name>-v.svg`), so the braid and the waves run down the strip. The others look the same turned, and are used as they are.
 */
export const DIRECTED: readonly AzulejoName[] = ['no', 'onda'];

/**
 * Pattern of an epoch: compass (Avis and the Discoveries), rhombus (Pombal and 1755), rose (Estado Novo and 25 April), Solomon's knot
 * (Lusitania and Rome: the Roman floors of Conimbriga), carpet flower (Union, Restoration and the gold of Brazil: the "tapete" azulejo of the
 * 17th century), waves (Monarchy and Republic: the "mar largo" pavement of the Rossio, 1849).
 */
export const EPOCH_PATTERN: Record<string, Exclude<AzulejoName, 'canto' | 'no-v' | 'onda-v'>> = {
  'avis-e-descobrimentos': 'bussola',
  'pombal-e-terramoto': 'rombo',
  'estado-novo-e-25-de-abril': 'rosa',
  'lusitania-e-roma': 'no',
  'uniao-restauracao-e-ouro-do-brasil': 'tapete',
  'monarquia-e-republica': 'onda',
};

/** Pattern for pages outside an epoch (the 404 page uses the corner signature only). */
export const DEFAULT_PATTERN: Exclude<AzulejoName, 'canto' | 'no-v' | 'onda-v'> = 'bussola';

export function patternFor(epoch: string | undefined): Exclude<AzulejoName, 'canto' | 'no-v' | 'onda-v'> {
  return (epoch && EPOCH_PATTERN[epoch]) || DEFAULT_PATTERN;
}

/** The tile of the map waiting state is the pattern of the epoch, except the rose (docs/visual-direction.md section 8): that one gives the compass. */
export function waitPatternFor(epoch: string | undefined): Exclude<AzulejoName, 'rosa' | 'canto' | 'no-v' | 'onda-v'> {
  const own = patternFor(epoch);
  return own === 'rosa' ? 'bussola' : own;
}

/** The tile for the vertical strip: the turned file of a directed pattern, the same file for the others. */
export function stripPatternFor(epoch: string | undefined): AzulejoName {
  const own = patternFor(epoch);
  return DIRECTED.includes(own) ? (`${own}-v` as AzulejoName) : own;
}

/** An address (or data: URI) as a CSS url("...") value that survives an inline <style>. */
export function cssUrl(address: string): string {
  return `url("${address.replace(/\\/g, '%5C').replace(/"/g, '%22').replace(/[\r\n]/g, '')}")`;
}

/** The custom properties the stylesheet reads: the epoch's pattern, the pattern of the waiting tile, the corner signature. */
export function azulejoRule(files: Record<AzulejoName, string>, epoch: string | undefined): string {
  return `:root{--azulejo-url:${cssUrl(files[patternFor(epoch)])};--azulejo-strip-url:${cssUrl(files[stripPatternFor(epoch)])};--azulejo-wait-url:${cssUrl(files[waitPatternFor(epoch)])};--azulejo-corner-url:${cssUrl(files.canto)}}`;
}
