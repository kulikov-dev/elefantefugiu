// The texts and addresses of the cabinet of rarities for a language: /pt/cabinet.json, read by src/scripts/cabinet.ts (a page with a hidden word or a sardine, the preview of the owner).
import type { APIRoute, GetStaticPaths } from 'astro';
import { LANGS, type Lang } from '../../i18n/routes';
import { cabinetPayload } from '../../lib/cabinet-data';
import { loadSite } from '../../lib/site-data';

export const getStaticPaths = (() => LANGS.map((lang) => ({ params: { lang }, props: { lang: lang as Lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { lang } = props as { lang: Lang };
  return new Response(JSON.stringify(cabinetPayload(await loadSite(), lang)), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
