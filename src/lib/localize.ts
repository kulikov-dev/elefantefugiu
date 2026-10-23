// Third language support in the data (stage RU). Pure helpers, no Astro imports.
//
// A localized text is an object with `pt` and `en` and, from the Russian stage on, an optional `ru`. Russian is optional in
// the schema: an event needs it only when `ru_ready: true` (then every text object must have it). Pages are written for
// `[lang]` without caring whether the Russian text exists, so the site loader fills the gap once: `localize` gives every
// text object a `ru` (the Russian text when the event is ready for it, otherwise the English one: chain ru -> en -> pt).

/** A text in every language (what pages read after `localize`). */
export type LText = { pt: string; en: string; ru: string };

export type TextLike = { pt: string; en: string; ru?: string | undefined };

/** The same shape with `ru` always present (what the pages read). */
export type Localized<T> = T extends { pt: string; en: string }
  ? Omit<T, 'ru'> & { ru: string }
  : T extends Date
    ? T
    : T extends readonly (infer U)[]
      ? Localized<U>[]
      : T extends object
        ? { [K in keyof T]: Localized<T[K]> }
        : T;

export const isText = (v: unknown): v is TextLike =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as TextLike).pt === 'string' && typeof (v as TextLike).en === 'string';

/** Fills `ru` in every text object: the Russian text when `ruReady` and present, else English (then Portuguese if English is empty). */
export function localize<T>(value: T, ruReady: boolean): Localized<T> {
  const walk = (v: unknown): unknown => {
    if (isText(v)) {
      const own = v.ru?.trim() ? v.ru : undefined;
      return { ...v, ru: ruReady && own ? own : v.en.trim() ? v.en : v.pt };
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v instanceof Date || typeof v !== 'object' || v === null) return v;
    // The remark of a source (a `note` next to `url`) may miss a language on purpose: it is not filled from another one.
    const isSource = 'url' in v && 'accessed' in v;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, isSource && k === 'note' ? x : walk(x)]));
  };
  return walk(value) as Localized<T>;
}

/** Paths ("hook", "bridge.note", "groups[0].label") of the text objects that have no Russian text. */
export function missingRu(value: unknown, path = ''): string[] {
  if (isText(value)) return value.ru?.trim() ? [] : [path];
  if (Array.isArray(value)) return value.flatMap((x, i) => missingRu(x, `${path}[${i}]`));
  if (value instanceof Date || typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([k, x]) => missingRu(x, path ? `${path}.${k}` : k));
}
