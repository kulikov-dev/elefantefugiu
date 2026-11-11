// The line under the title of a card of "Which came first?" (docs/spec.md 5.9): the hook of the story, unless the hook gives the date away. Plain JS so that the build check
// (scripts/check-order.mjs) and the game (src/lib/order-build.ts) use one rule.
// A hook gives the date away when it has a number of three or four digits, the word "century" (век, séc., século, century), a Roman numeral (the number of a century: IV, XIX)
// or a word of an era (средневековый, medieval, Idade Média, античный, ancient). Such a hook is not shown; a story may have `order_hint` of its own (pt, en, ru) that is shown instead.
const NUMBER = /(?<![\d])\d{3,4}(?![\d])/u;
const CENTURY = /(?<![\p{L}])век|(?<![\p{L}])séc(?![\p{L}])|sécul|centur/iu;
const ROMAN = /(?<![\p{L}])(?=[IVX]{2,}(?![\p{L}]))[IVX]+(?![\p{L}])/u;
const ERA = /средневеков|medieval|medievo|idade média|античн|древн|ancient|antiguidade/iu;

/** @param {string | undefined} text */
export const hookGivesDate = (text) => typeof text === 'string' && (NUMBER.test(text) || CENTURY.test(text) || ROMAN.test(text) || ERA.test(text));

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
