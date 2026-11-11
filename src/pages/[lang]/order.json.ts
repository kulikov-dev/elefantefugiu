// The stories of "Which came first?" in a language: /pt/order.json, read by src/scripts/order.ts when the game page opens (the page itself carries no list).
// Made at every build from the stories published that day (src/lib/order-data.ts), so the daily build adds the stories whose day has come.
import type { APIRoute, GetStaticPaths } from 'astro';
import { LANGS, type Lang } from '../../i18n/routes';
import { orderStories } from '../../lib/order-data';
import { loadSite } from '../../lib/site-data';

export const getStaticPaths = (() => LANGS.map((lang) => ({ params: { lang }, props: { lang: lang as Lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { lang } = props as { lang: Lang };
  const site = await loadSite();
  return new Response(JSON.stringify(await orderStories(site, lang)), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
