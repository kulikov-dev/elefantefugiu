// Builds the search index with Pagefind from the built site (part of postbuild, before the checks that read dist/).
// Only the pages that carry data-pagefind-body are indexed: the stories (src/views/StoryView.astro; a draft, a stand-in and a not-yet-published page have none).
// The index is split by the language of the page (<html lang>), so a query is answered in the language of the page it is typed on.
// Fails when the number of pages indexed differs from the number of pages that ask for it, or when a language has none.
// Usage: node scripts/make-search.mjs   (after astro build)
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pagefind from 'pagefind';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

// What should be in the index: the built pages that carry the attribute, by language.
const wanted = { pt: 0, en: 0, ru: 0 };
for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  if (!html.includes('data-pagefind-body')) continue;
  const lang = html.match(/<html lang="([a-z]+)"/)?.[1];
  if (lang in wanted) wanted[lang] += 1;
}

rmSync(join(dist, 'pagefind'), { recursive: true, force: true });
const { index, errors: createErrors } = await pagefind.createIndex({});
if (!index) {
  console.error(`make-search: ${createErrors.join('; ')}`);
  process.exit(1);
}
const added = await index.addDirectory({ path: dist });
const written = await index.writeFiles({ outputPath: join(dist, 'pagefind') });
await pagefind.close();

// Our own interface is used (src/scripts/search-ui.ts): the interface files Pagefind writes next to the index are not served.
for (const name of readdirSync(join(dist, 'pagefind'))) if (/^pagefind-(component-|modular-)?ui\.|^pagefind-highlight\.js$/.test(name)) rmSync(join(dist, 'pagefind', name));

const errors = [...added.errors, ...written.errors];
// The entry file of the index says how many pages each language got (added.page_count counts the pages read, not the pages kept).
const entry = JSON.parse(readFileSync(join(dist, 'pagefind', 'pagefind-entry.json'), 'utf8'));
const indexed = Object.fromEntries(Object.entries(entry.languages).map(([lang, info]) => [lang, info.page_count]));
for (const [lang, n] of Object.entries(wanted)) {
  if (n === 0) errors.push(`no page of the language ${lang} asks for the index`);
  if ((indexed[lang] ?? 0) !== n) errors.push(`${lang}: ${indexed[lang] ?? 0} pages indexed, ${n} ask for it (data-pagefind-body)`);
}
if (errors.length) {
  console.error(`make-search failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`make-search: ${Object.entries(indexed).map(([l, n]) => `${l} ${n}`).join(', ')} pages indexed`);
