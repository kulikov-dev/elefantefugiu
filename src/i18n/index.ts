import pt from './pt.json';
import en from './en.json';
import type { Lang } from './routes';

const dictionaries: Record<Lang, unknown> = { pt, en };

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
