// The line under the title of a card of "Which came first?" (docs/spec.md 5.9): the hook of the story, unless the hook gives the date away. Plain JS so that the build check
// (scripts/check-order.mjs) and the game (src/lib/order-build.ts) use one rule.
// A hook gives the date away when it has a number from 100 to 2100 written without a separator of thousands (a year, "1646"; not "9 000", "9,000", "9.000"), the word "century"
// (век, séc., século, century), a Roman numeral (the number of a century: IV, XIX) or a word of an era (средневековый, medieval, Idade Média, античный, ancient).
// Such a hook is not shown; a story may have `order_hint` of its own (pt, en, ru) that is shown instead.
// A number with its groups of thousands ("9 000", "9,000", "9.000", also with a no-break or a thin space) is one token and is not a date.
const NUMBER_TOKEN = /(?<![\d])\d+(?:[ .,  ]\d{3}(?!\d))*(?![\d])/gu;
const CENTURY = /(?<![\p{L}])(?:век|века|веке|веку|веков)(?![\p{L}])|(?<![\p{L}])séc(?![\p{L}])|sécul|centur/iu;
const ROMAN = /(?<![\p{L}])(?=[IVX]{2,}(?![\p{L}]))[IVX]+(?![\p{L}])/u;
const ERA = /средневеков|medieval|medievo|idade média|античн|древн|ancient|antiguidade/iu;

/** Is there a number from 100 to 2100 that has no separator of thousands? */
const hasYearNumber = (/** @type {string} */ text) => (text.match(NUMBER_TOKEN) ?? []).some((token) => /^\d+$/.test(token) && Number(token) >= 100 && Number(token) <= 2100);

/** @param {string | undefined} text */
export const hookGivesDate = (text) => typeof text === 'string' && (hasYearNumber(text) || CENTURY.test(text) || ROMAN.test(text) || ERA.test(text));

/**
 * The line to show under the title: `order_hint` of the language when the story has one, else the hook unless it gives the date away, else nothing.
 * @param {{ hook?: Record<string, string | undefined>, order_hint?: Record<string, string | undefined> | undefined }} story
 * @param {string} lang
 */
export function hintOf(story, lang) {
  const own = story.order_hint?.[lang]?.trim();
  if (own) return own;
  const hook = story.hook?.[lang]?.trim();
  return hook && !hookGivesDate(hook) ? hook : undefined;
}
