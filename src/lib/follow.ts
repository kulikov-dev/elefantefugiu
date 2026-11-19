// "Follow the new stories": the monthly e-mail through Kit (a plain HTML form, no script of Kit) and, on the Russian pages, the Telegram channel in the same block.
// Pure helpers, so the rules run in plain unit tests; src/components/FollowBlock.astro is the markup and src/scripts/follow.ts the page.
import type { Lang } from '../i18n/routes';

/** The Kit form of each language (the list of readers is one per language). */
export const KIT_FORM_ID: Record<Lang, string> = { ru: '10212790', en: '10212921', pt: '10212936' };
/** The address the form posts to; Kit then shows its own "check your mail" page. */
export const kitAction = (lang: Lang): string => `https://app.kit.com/forms/${KIT_FORM_ID[lang]}/subscriptions`;

/** The key in localStorage: set when the reader has subscribed or closed the block; the story pages then never show it again on this device. */
export const FOLLOW_KEY = 'followDone';
/** The event for the counter: one per language, sent when the form is submitted. */
export const followEvent = (lang: Lang): string => `subscribe-${lang}`;

/** Shown in a story only for a reader who has read at least one other story and has not closed it or subscribed. */
export function showFollow(read: readonly string[], currentId: string, done: boolean): boolean {
  return !done && read.some((id) => id !== currentId);
}
