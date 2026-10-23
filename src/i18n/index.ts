import pt from './pt.json';
import en from './en.json';
import ru from './ru.json';
import { LANGS, LOCALES, type Lang } from './routes';
import type { LText } from '../lib/localize';

const dictionaries: Record<Lang, unknown> = { pt, en, ru };

/** Look up a UI string by dotted key. A missing key fails the build. */
export function t(lang: Lang, key: string): string {
  let node: unknown = dictionaries[lang];
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  if (typeof node !== 'string') {
    throw new Error(`Missing i18n key "${key}" for language "${lang}"`);
  }
  return node;
}

const pluralRules: Record<Lang, Intl.PluralRules> = {
  pt: new Intl.PluralRules(LOCALES.pt),
  en: new Intl.PluralRules(LOCALES.en),
  ru: new Intl.PluralRules(LOCALES.ru),
};

/** True when the key exists (a string) in the language. */
export function has(lang: Lang, key: string): boolean {
  let node: unknown = dictionaries[lang];
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  return typeof node === 'string';
}

/** Plural category of n in the language: one, few, many or other (Russian uses all four; pt and en only one and other). */
export function pluralCategory(lang: Lang, n: number): 'one' | 'few' | 'many' | 'other' {
  const form = pluralRules[lang].select(n);
  return form === 'one' || form === 'few' || form === 'many' ? form : 'other';
}

/**
 * Plural string: looks up `${key}_${category}` (falling back to `${key}_other`) and replaces {n} with the number, or with `shown` when
 * the number is to be written another way (with thousands separators, for example) while the form still follows n.
 */
export function plural(lang: Lang, key: string, n: number, shown: string = String(n)): string {
  const category = pluralCategory(lang, n);
  const form = has(lang, `${key}_${category}`) ? category : 'other';
  return t(lang, `${key}_${form}`).replace('{n}', shown);
}

/** All forms of a plural key that exist in the language: {one, few?, many?, other}. For scripts that count in the browser. */
export function pluralForms(lang: Lang, key: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const category of ['one', 'few', 'many', 'other']) if (has(lang, `${key}_${category}`)) out[category] = t(lang, `${key}_${category}`);
  return out;
}

/** One UI string in every language (for components that take a name per language). */
export function tAll(key: string): LText {
  return Object.fromEntries(LANGS.map((lang) => [lang, t(lang, key)])) as LText;
}
