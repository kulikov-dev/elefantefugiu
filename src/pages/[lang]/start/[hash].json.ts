// The data of "Where to start" of a language (src/lib/start-data.ts): /pt/start/<hash>.json, read by src/scripts/start-set.ts.
import type { APIRoute, GetStaticPaths } from 'astro';
import { LANGS, type Lang } from '../../../i18n/routes';
import { loadSite } from '../../../lib/site-data';
import { startFile } from '../../../lib/start-data';

export const getStaticPaths = (async () => {
  const site = await loadSite();
  return Promise.all(LANGS.map(async (lang) => ({ params: { lang, hash: (await startFile(site, lang as Lang)).hash }, props: { lang: lang as Lang } })));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const site = await loadSite();
  return new Response((await startFile(site, (props as { lang: Lang }).lang)).json, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
