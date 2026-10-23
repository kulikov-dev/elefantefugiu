// How a distance is said to a reader: "right here", "350 m", "2.1 km". One rule for "Nearby" on a card page and for the map's
// "Near me" list. Pure function; the caller formats the number for its language and puts it into its own phrase ("in {n} m").

export type DistanceParts = { kind: 'here' } | { kind: 'm'; n: number } | { kind: 'km'; n: number };

/** Under 50 m: here. Under a kilometre: metres rounded to 10. Then kilometres with one decimal, whole kilometres from 100 km. */
export function distanceParts(km: number): DistanceParts {
  if (km < 0.05) return { kind: 'here' };
  if (km < 1) return { kind: 'm', n: Math.round(km * 100) * 10 };
  return { kind: 'km', n: km >= 100 ? Math.round(km) : Math.round(km * 10) / 10 };
}
