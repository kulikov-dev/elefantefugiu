// Checks the built site in dist/: every internal href/src must start with the base path
// and point to an existing file; a #fragment must match an id on the target page.
// Run after `npm run build` with the same BASE_PATH.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const raw = (process.env.BASE_PATH || '').trim();
const base = raw && raw !== '/' ? `/${raw.replace(/^\/+|\/+$/g, '')}/` : '/';
import { fileURLToPath } from 'node:url';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? htmlFiles(path) : path.endsWith('.html') ? [path] : [];
  });
}

const errors = [];
let checked = 0;
let fragments = 0;

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file);
}
function pageFile(path) {
  return statSync(path).isFile() ? path : join(path, 'index.html');
}

for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, 'utf8');
  for (const [, attr, value] of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
    if (value.startsWith('#')) {
      // Same-page anchor: "#" alone is not used on this site; every other one needs an id here.
      if (value.length > 1) {
        fragments += 1;
        if (!idsOf(file).has(decodeURIComponent(value.slice(1)))) errors.push(`${file.replace(dist, '')}: ${attr}="${value}" has no element with that id on the page`);
      }
      continue;
    }
    if (/^(https?:|mailto:|tel:|data:)/.test(value) || value === '') continue;
    // Inline-script variables are not attributes, so only real links get here.
    const where = file.replace(dist, '');
    if (!value.startsWith(base)) {
      errors.push(`${where}: ${attr}="${value}" does not start with base "${base}"`);
      continue;
    }
    const clean = value.slice(base.length).split('#')[0].split('?')[0];
    const target = join(dist, clean);
    const ok = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, 'index.html')));
    checked += 1;
    if (!ok) {
      errors.push(`${where}: ${attr}="${value}" has no matching file in dist/`);
      continue;
    }
    const fragment = value.split('#')[1];
    if (fragment && attr === 'href') {
      fragments += 1;
      if (!idsOf(pageFile(target)).has(decodeURIComponent(fragment))) errors.push(`${where}: href="${value}" points to a missing id "${fragment}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Link check failed:\n- ${[...new Set(errors)].join('\n- ')}`);
  process.exit(1);
}
console.log(`Link check passed for base "${base}" (${checked} internal links, ${fragments} fragments).`);
