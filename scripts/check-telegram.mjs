// The Telegram channel (src/lib/social.ts) is in Russian only, so on dist/: every Russian page has its link in the footer, every Russian story page has the block at the end of the
// text, and no Portuguese or English page and no file outside /ru/ mentions t.me at all.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = process.env.CHECK_DIST || join(root, 'dist');
const URL_TELEGRAM = /TELEGRAM_URL = '([^']+)'/.exec(readFileSync(join(root, 'src/lib/social.ts'), 'utf8'))?.[1];
const errors = [];
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
let ruPages = 0;
let ruStories = 0;
for (const file of walk(dist).filter((f) => /\.(html|xml|json|js|txt)$/.test(f))) {
  const rel = relative(dist, file).split(sep).join('/');
  const text = readFileSync(file, 'utf8');
  const inRu = rel.startsWith('ru/');
  // 404.html holds the footers of all three languages (a script shows the visitor's own), so its Russian footer has the link.
  if (!inRu && rel !== '404.html' && /t\.me\//.test(text)) errors.push(`${rel}: mentions t.me, but the channel is shown on the Russian pages only`);
  if (!inRu || !rel.endsWith('.html')) continue;
  // The pages of the layout have the footer; the 404 page and redirects do not count.
  if (!text.includes('class="site-footer"')) continue;
  ruPages += 1;
  if (!text.includes(`href="${URL_TELEGRAM}"`)) errors.push(`${rel}: no link to the Telegram channel in the footer`);
  if (rel.startsWith('ru/istoriya/')) {
    ruStories += 1;
    if (!text.includes('class="telegram')) errors.push(`${rel}: no Telegram block at the end of the story`);
    if (!/<script[^>]*src="[^"]*telegram/i.test(text)) continue;
    errors.push(`${rel}: loads a script from Telegram`);
  }
}
if (ruStories === 0) errors.push('no Russian story page found in dist/');
if (errors.length) {
  console.error(`Telegram check failed (${errors.length}):`);
  for (const e of errors.slice(0, 30)) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Telegram check passed: ${ruPages} Russian pages with the footer link, ${ruStories} story pages with the block; no t.me on any other page.`);
