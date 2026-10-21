// Plural form for a count in the browser: pick `${base}_${category}` (one, few, many, other) from a flat map of strings,
// falling back to `${base}_other`. The category comes from Intl.PluralRules of the page locale (Russian has four, pt and en two).
export function pickPlural(strings: Record<string, string>, base: string, n: number, locale: string): string {
  const category = new Intl.PluralRules(locale).select(n);
  return strings[`${base}_${category}`] ?? strings[`${base}_other`] ?? '';
}
