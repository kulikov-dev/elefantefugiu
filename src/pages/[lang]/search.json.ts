// The data of the search interface in a language: /pt/search.json, read by src/scripts/search-ui.ts when the search is first opened (no page carries it).
// Made at every build from the stories published that day, so the places and the eras follow the daily build.
import type { APIRoute, GetStaticPaths } from 'astro';
import { LANGS, type Lang } from '../../i18n/routes';
import { t } from '../../i18n';
import { searchData } from '../../lib/search-data';
import { loadSite } from '../../lib/site-data';

export const getStaticPaths = (() => LANGS.map((lang) => ({ params: { lang }, props: { lang: lang as Lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { lang } = props as { lang: Lang };
  const site = await loadSite();
  return new Response(JSON.stringify(searchData(lang, site.events, site.epochs, t(lang, 'nav.surprise'), site.placePages)), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
