// Page transitions (cross-document View Transitions, src/lib/transitions.ts and src/styles/transitions.css), checked on dist/:
//   - the CSS has the @view-transition rule (navigation: auto) and the one under prefers-reduced-motion that turns it off;
//   - on no page does a view-transition-name appear twice (the browser drops the whole transition for a duplicate);
//   - every page has a valid speculation-rules block: prefetch only, no prerender (a prerendered page would run the counter without a visit);
//   - the name of a picture in a list (story-<slug>) is also the name of the main picture of that story page in the same language.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const errors = [];
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(dist);

const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n');
if (!/@view-transition\s*\{\s*navigation:\s*auto\s*\}/.test(css)) errors.push('no CSS rule "@view-transition { navigation: auto }" in dist/');
if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*@view-transition\s*\{\s*navigation:\s*none\s*\}/.test(css)) errors.push('no "@view-transition { navigation: none }" under prefers-reduced-motion: reduce');

const listNames = {};
const storyNames = {};
let pages = 0;
for (const file of files.filter((f) => f.endsWith('.html'))) {
  const rel = relative(dist, file).split(sep).join('/');
  const html = readFileSync(file, 'utf8');
  // The root page and /p/<id> only redirect: they are not pages of the layout and are left before anything is painted.
  if (!html.includes('id="main"')) continue;
  pages += 1;
  const names = [...html.matchAll(/view-transition-name:\s*([^;"'\s]+)/g)].map((m) => m[1]);
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) errors.push(`${rel}: view-transition-name "${n}" twice`);
    seen.add(n);
  }
  const blocks = [...html.matchAll(/<script type="speculationrules">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (blocks.length !== 1) errors.push(`${rel}: ${blocks.length} speculationrules blocks, expected 1`);
  for (const b of blocks) {
    let rules;
    try {
      rules = JSON.parse(b);
    } catch (e) {
      errors.push(`${rel}: speculationrules is not valid JSON (${e.message})`);
      continue;
    }
    if (rules.prerender || rules.prefetch === undefined) errors.push(`${rel}: speculationrules must have prefetch and no prerender`);
    if (JSON.stringify(rules).includes('"immediate"') || (rules.prefetch ?? []).some((r) => r.eagerness !== 'moderate')) errors.push(`${rel}: speculationrules eagerness must be "moderate"`);
  }
  const lang = rel.split('/')[0];
  const isStory = /^(pt\/historia|en\/story|ru\/istoriya)\/[^/]+\/index\.html$/.test(rel);
  for (const n of names.filter((x) => x.startsWith('story-'))) (isStory ? (storyNames[lang] ??= new Set()) : (listNames[lang] ??= new Set())).add(n);
}
for (const [lang, set] of Object.entries(listNames)) {
  for (const n of set) if (!storyNames[lang]?.has(n)) errors.push(`${lang}: "${n}" is on a picture in a list but on no story page (the picture would not flow)`);
}

if (errors.length) {
  console.error(`Transition check failed (${errors.length}):`);
  for (const e of errors.slice(0, 40)) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Transition check passed: ${pages} pages, no name twice, speculation rules are prefetch only, ${Object.values(storyNames).reduce((n, s) => n + s.size, 0)} story pictures flow from the lists.`);
