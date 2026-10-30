// Writes dist/sitemap.xml and dist/robots.txt from the BUILT pages (run first in postbuild).
// The sitemap lists the pages that search engines may index: every page of dist/ except the ones with <meta name="robots"
// content="noindex"> (test text, Russian stand-in pages), the 404 page, the language chooser at the root and the QR pages
// (/p/...). Each entry carries the hreflang alternates the page itself declares, so the sitemap cannot disagree with the pages.
// <lastmod> is the day of the last commit that touched the source of the page (git log), never a made-up date: a story, the day of
// its YAML file; an epoch or a thread, the latest of its stories; the home page, the latest of all stories; the plain pages (About,
// Method, Legal), the day of src/data/static-pages.ts. The other pages (map, surprise) have no entry for it. In a shallow clone (git
// knows only the last commit) every file would get the same day, so then no <lastmod> is written at all.
// robots.txt allows everything and names the sitemap. (A project site served from /REPO/ has its robots.txt at the wrong
// level for crawlers; it starts to count with a custom domain, see the README.)
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const site = (process.env.SITE_URL || 'http://localhost:4321').replace(/\/+$/, '');
const rawBase = (process.env.BASE_PATH || '').trim();
const base = rawBase && rawBase !== '/' ? `/${rawBase.replace(/^\/+|\/+$/g, '')}` : '';

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- <lastmod> from git ----
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const haveHistory = git('rev-parse', '--is-shallow-repository') === 'false';
const dayOf = (file) => (haveHistory ? git('log', '-1', '--format=%cs', '--', file) : '');
const latest = (days) => days.filter(Boolean).sort().at(-1) ?? '';
const events = readdirSync(join(root, 'src/content/events'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({ ...parse(readFileSync(join(root, 'src/content/events', f), 'utf8')), day: dayOf(`src/content/events/${f}`) }))
  .filter((e) => e.status === 'ready');
const bySlug = (lang) => new Map(events.map((e) => [e.slug[lang] ?? e.slug.en, e]));
const epochs = parse(readFileSync(join(root, 'src/content/epochs.yaml'), 'utf8'));
const threads = parse(readFileSync(join(root, 'src/content/threads.yaml'), 'utf8'));
const staticDay = dayOf('src/data/static-pages.ts');
const STORY = /^(pt|en|ru)\/(historia|story|istoriya)\/([^/]+)\/index\.html$/;
const EPOCH = /^(pt|en|ru)\/(epoca|era|epoha)\/([^/]+)\/index\.html$/;
const THREAD = /^(pt|en|ru)\/(fio|thread|niti)\/([^/]+)\/index\.html$/;
const STATIC = /^(pt\/(sobre|metodo|legal)|en\/(about|method|legal)|ru\/(o-proekte|metod|pravovaya-informaciya))\/index\.html$/;
const lastmodOf = (path) => {
  let m;
  if ((m = path.match(STORY))) return bySlug(m[1]).get(m[3])?.day ?? '';
  if ((m = path.match(EPOCH))) {
    const epoch = epochs.find((e) => (e.slug[m[1]] ?? e.slug.en) === m[3]);
    return epoch ? latest(events.filter((e) => e.epoch === epoch.id).map((e) => e.day)) : '';
  }
  if ((m = path.match(THREAD))) {
    const thread = threads.find((t) => (t.slug[m[1]] ?? t.slug.en) === m[3]);
    return thread ? latest(events.filter((e) => e.threads.includes(thread.id)).map((e) => e.day)) : '';
  }
  if (/^(pt|en|ru)\/index\.html$/.test(path)) return latest(events.map((e) => e.day));
  if (STATIC.test(path)) return staticDay;
  return '';
};

const entries = [];
for (const file of walk(dist).filter((f) => f.endsWith('.html')).sort()) {
  const path = relative(dist, file).replace(/\\/g, '/');
  if (path === '404.html' || path === 'index.html' || path.startsWith('p/')) continue;
  const html = readFileSync(file, 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical) {
    console.error(`make-sitemap: ${path} is indexable but has no canonical link`);
    process.exit(1);
  }
  const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ lang: m[1], href: m[2] }));
  entries.push({ loc: canonical, alternates, lastmod: lastmodOf(path) });
}

const urls = entries
  .map(
    (e) =>
      `  <url>\n    <loc>${xml(e.loc)}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''}${e.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${xml(a.lang)}" href="${xml(a.href)}"/>`).join('\n')}${e.alternates.length ? '\n' : ''}  </url>`,
  )
  .join('\n');
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}${base}/sitemap.xml\n`);
console.log(`Sitemap written: ${entries.length} indexable pages, ${entries.filter((e) => e.lastmod).length} with <lastmod>${haveHistory ? '' : ' (a shallow clone: no dates)'} (${site}${base}/sitemap.xml), robots.txt written.`);
