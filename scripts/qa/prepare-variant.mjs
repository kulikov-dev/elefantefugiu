// Builds a variant of the site for family.mjs in /tmp/elefante-variant (the real data is not touched):
// every card of the epoch estado-novo-e-25-de-abril gets min_age 16. The test data has no 16+ card and no epoch
// that a mode leaves empty; this build has both, so the 16+ text of the gate, the empty-mode message and the
// hidden sections can be checked in a browser.  Usage: node prepare-variant.mjs   (then DIST=/tmp/elefante-variant/dist node serve.mjs 4401)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const out = '/tmp/elefante-variant';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) cpSync(join(root, name), join(out, name), { recursive: true });
symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'));

const dir = join(out, 'src/content/events');
let changed = 0;
for (const name of readdirSync(dir)) {
  const file = join(dir, name);
  const text = readFileSync(file, 'utf8');
  if (!/^epoch: estado-novo-e-25-de-abril\s*$/m.test(text)) continue;
  writeFileSync(file, text.replace(/^min_age:.*$/m, "min_age: '16'"));
  changed += 1;
}
console.log(`min_age 16 set on ${changed} cards`);
execSync('npx astro build', { cwd: out, stdio: 'inherit', env: { ...process.env, ALLOW_PLACEHOLDER: 'true' } });
if (!existsSync(join(out, 'dist/index.html'))) throw new Error('variant build failed');
console.log('variant ready: DIST=/tmp/elefante-variant/dist node serve.mjs 4401');
