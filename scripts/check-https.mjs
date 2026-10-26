// A page served over https must not load anything over http (mixed content: the browser then shows "Not secure" and blocks the
// resource). Looks in every text file of dist/ for http:// addresses: src, href of stylesheets and icons, srcset, url() in CSS,
// og:image and other meta contents, script strings. Not counted: XML namespaces (w3.org, sitemaps.org) and the href of ordinary
// links <a> (a link is followed, not loaded). A local build (SITE_URL is http itself, e.g. http://localhost:4321) is skipped.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(dist)) {
  console.error('dist/ is missing: build first');
  process.exit(1);
}
const site = (process.env.SITE_URL || 'http://localhost:4321').trim();
if (!site.startsWith('https://')) {
  console.log(`HTTPS check skipped: SITE_URL is ${site}, not an https address.`);
  process.exit(0);
}
const TEXT = /\.(html|css|js|mjs|svg|json|xml|txt|webmanifest)$/;
const NAMESPACE = /^http:\/\/(www\.w3\.org|www\.sitemaps\.org)\//;
const found = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!TEXT.test(name)) continue;
    let text = readFileSync(path, 'utf8');
    if (name.endsWith('.html')) text = text.replace(/<a\b[^>]*>/g, '');
    for (const m of text.matchAll(/http:\/\/[^\s"'`()<>\\]+/g)) {
      if (!NAMESPACE.test(m[0])) found.push(`${path.slice(dist.length)}: ${m[0]}`);
    }
  }
};
walk(dist);
if (found.length) {
  console.error(`HTTPS check failed: ${found.length} http:// address(es) that a page could load (use https):\n- ${[...new Set(found)].join('\n- ')}`);
  process.exit(1);
}
console.log('HTTPS check passed: no http:// resources in dist/ (XML namespaces and plain links excepted).');
