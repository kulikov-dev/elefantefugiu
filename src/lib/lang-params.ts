// Query parameters that keep the same meaning in every language, so the language switch carries them over.
// Values are language-neutral ids (thread id, epoch id, card id) or fixed words (vista=grelha).
export const CARRIED_PARAMS = ['fio', 'vista', 'epoca', 'id'] as const;

/** Query string with only the carried parameters from `search`, in a stable order; "" when there are none. */
export function carriedQuery(search: string): string {
  const source = new URLSearchParams(search);
  const out = new URLSearchParams();
  for (const key of CARRIED_PARAMS) {
    const value = source.get(key);
    if (value) out.set(key, value);
  }
  const query = out.toString();
  return query ? `?${query}` : '';
}

/** Adds the carried parameters of `search` to a switch link, replacing any query it already has. Keeps the hash. */
export function withCarried(href: string, search: string): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  const path = (hashAt === -1 ? href : href.slice(0, hashAt)).split('?')[0]!;
  return path + carriedQuery(search) + hash;
}
