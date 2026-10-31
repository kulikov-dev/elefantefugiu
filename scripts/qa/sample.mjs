// MAP_SAMPLE for the long sweeps of the map suites (map.mjs: "limit" and "link").
//   MAP_SAMPLE unset or "full"   every view / card, as before
//   MAP_SAMPLE=30                30 views picked at random, the same pick for the same seed, plus the edge cases the suite names itself
//   MAP_SEED=<n>                 seed of the pick (the weekly run uses the number of the week, so over weeks all views come up)
// The edge cases (every thread, every epoch, the marker limit, the borders of Portugal) are never sampled away: the suite adds them.

const raw = process.env.MAP_SAMPLE ?? '';
export const SAMPLE = /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : 0; // 0: everything
export const SEED = Number(process.env.MAP_SEED || 0) || 0;

/** mulberry32: a small seeded generator, the same numbers on every machine. */
function rng(seed) {
  let a = (seed + 0x6d2b79f5) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` of the items (all of them when sampling is off or n is not smaller), in their own order, picked with the seed. */
export function pick(items, n, salt = 0) {
  if (!SAMPLE || n >= items.length) return items.slice();
  const rand = rng(SEED * 1009 + salt);
  const order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, n).sort((a, b) => a - b).map((i) => items[i]);
}

export const describe = () => (SAMPLE ? `sample of ${SAMPLE}, seed ${SEED}` : 'full');
