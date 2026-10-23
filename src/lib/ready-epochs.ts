// The sentences of the About page about how far the project has got, built from the data: how many epochs are ready (an epoch is ready
// when it has at least one published story), which ones, and how many are still to come. Forms: "One era is ready: ...", "Two eras
// are ready: ..."; Russian "Готова одна эпоха", "Готовы две эпохи", "Готовы пять эпох" (forms by Intl.PluralRules). Pure functions.
import type { Lang } from '../i18n/routes';
import { LOCALES } from '../i18n/routes';

/** Number words for 1 to 9 (in Russian and Portuguese the feminine, as "era" is feminine there); from 10 the digits are used. */
const WORDS: Record<Lang, readonly string[]> = {
  pt: ['uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'],
  en: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  ru: ['одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
};

const word = (lang: Lang, n: number): string => WORDS[lang][n - 1] ?? String(n);
const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Noun "era" in the form that goes with n. */
function noun(lang: Lang, n: number): string {
  const category = new Intl.PluralRules(LOCALES[lang]).select(n);
  if (lang === 'ru') return category === 'one' ? 'эпоха' : category === 'few' ? 'эпохи' : 'эпох';
  if (lang === 'pt') return n === 1 ? 'época' : 'épocas';
  return n === 1 ? 'era' : 'eras';
}

/** "«A», «B» и «C»" (the quotes of the language, "and" of the language). */
export function joinNames(lang: Lang, names: readonly string[]): string {
  const quoted = names.map((n) => (lang === 'en' ? `“${n}”` : `«${n}»`));
  const and = lang === 'ru' ? 'и' : lang === 'pt' ? 'e' : 'and';
  if (quoted.length <= 1) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} ${and} ${quoted[quoted.length - 1]}`;
}

/** "Готовы две эпохи: «A» и «B»" (no full stop: the caller adds ", всего 13 историй."). */
export function readyEpochsText(lang: Lang, names: readonly string[]): string {
  const n = names.length;
  const list = joinNames(lang, names);
  if (n === 0) return { pt: 'Ainda não há épocas prontas', en: 'No era is ready yet', ru: 'Готовых эпох пока нет' }[lang];
  if (lang === 'ru') return `${n === 1 ? 'Готова' : 'Готовы'} ${word(lang, n)} ${noun(lang, n)}: ${list}`;
  if (lang === 'pt') return `${n === 1 ? 'Está pronta' : 'Estão prontas'} ${word(lang, n)} ${noun(lang, n)}: ${list}`;
  return `${capital(word(lang, n))} ${noun(lang, n)} ${n === 1 ? 'is' : 'are'} ready: ${list}`;
}

/** "Семь эпох, от римской Лузитании до наших дней, в работе." (empty when nothing is left). */
export function soonEpochsText(lang: Lang, n: number): string {
  if (n <= 0) return '';
  if (lang === 'ru') return `${capital(word(lang, n))} ${noun(lang, n)}, от римской Лузитании до наших дней, в работе.`;
  if (lang === 'pt') return n === 1 ? 'Outra época, da Lusitânia romana aos nossos dias, está a caminho.' : `Outras ${word(lang, n)} épocas, da Lusitânia romana aos nossos dias, estão a caminho.`;
  return `${capital(word(lang, n))} more ${noun(lang, n)}, from Roman Lusitania to the present day, ${n === 1 ? 'is' : 'are'} in the works.`;
}
