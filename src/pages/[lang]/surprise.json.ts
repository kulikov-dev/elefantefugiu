// The list for "Surprise me" of a language: /pt/surprise.json, read by src/scripts/surprise-link.ts when a link to the surprise page is clicked
// (the reader then goes straight to a story). The same stories as the list of the surprise page itself; about 100 bytes a story.
import type { APIRoute, GetStaticPaths } from 'astro';
import { LANGS, storyPath, type Lang } from '../../i18n/routes';
import { familyAttrs } from '../../lib/family';
import { surpriseCandidates } from '../../lib/home';
import { loadSite } from '../../lib/site-data';

export const getStaticPaths = (() => LANGS.map((lang) => ({ params: { lang }, props: { lang: lang as Lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { lang } = props as { lang: Lang };
  const site = await loadSite();
  const list = surpriseCandidates(site.events).map((e) => ({ id: e.id, href: storyPath(lang, e.slug[lang]), minAge: familyAttrs(e)['data-min-age'], sensitive: familyAttrs(e)['data-sensitive'] === 'true' }));
  return new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
