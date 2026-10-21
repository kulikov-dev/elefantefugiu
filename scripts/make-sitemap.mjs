// Writes dist/sitemap.xml and dist/robots.txt from the BUILT pages (run first in postbuild).
// The sitemap lists the pages that search engines may index: every page of dist/ except the ones with <meta name="robots"
// content="noindex"> (test text, Russian stand-in pages), the 404 page, the language chooser at the root and the QR pages
// (/p/...). Each entry carries the hreflang alternates the page itself declares, so the sitemap cannot disagree with the pages.
// robots.txt allows everything and names the sitemap. (A project site served from /REPO/ has its robots.txt at the wrong
// level for crawlers; it starts to count with a custom domain, see the README.)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const site = (process.env.SITE_URL || 'http://localhost:4321').replace(/\/+$/, '');
const rawBase = (process.env.BASE_PATH || '').trim();
const base = rawBase && rawBase !== '/' ? `/${rawBase.replace(/^\/+|\/+$/g, '')}` : '';

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  entries.push({ loc: canonical, alternates });
}

const urls = entries
  .map(
    (e) =>
      `  <url>\n    <loc>${xml(e.loc)}</loc>\n${e.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${xml(a.lang)}" href="${xml(a.href)}"/>`).join('\n')}${e.alternates.length ? '\n' : ''}  </url>`,
  )
  .join('\n');
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}${base}/sitemap.xml\n`);
console.log(`Sitemap written: ${entries.length} indexable pages (${site}${base}/sitemap.xml), robots.txt written.`);
