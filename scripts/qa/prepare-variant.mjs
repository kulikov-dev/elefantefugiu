// Builds the fixture site for the suites that need cards the real site does not have (16+, a long epoch, a mode that leaves an
// epoch empty). The plan is in variant-plan.mjs. The real data is not touched: the build runs in a copy of the sources under the
// temporary directory (QA_VARIANT_DIR to choose another), so the fixtures can never reach dist/ of the real site.
// Usage: node prepare-variant.mjs   (then DIST=<tmp>/elefante-variant/dist node serve.mjs 4401)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE_EPOCH, MOVED, MOVED_TO, SIXTEEN, variantOf } from './variant-plan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = join(process.env.QA_VARIANT_DIR || tmpdir(), 'elefante-variant');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) cpSync(join(root, name), join(out, name), { recursive: true });
symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'), 'junction');

const dir = join(out, 'src/content/events');
let changed = 0;
for (const name of readdirSync(dir)) {
  const file = join(dir, name);
  const text = readFileSync(file, 'utf8');
  const id = text.match(/^id: (\S+)/m)?.[1] ?? '';
  if (!MOVED.includes(id) && !SIXTEEN.includes(id)) continue;
  const plan = variantOf({ id, status: 'draft' });
  let next = text.replace(/^status: draft\s*$/m, 'status: ready');
  if (plan.epoch === MOVED_TO) next = next.replace(/^epoch: .*$/m, `epoch: ${MOVED_TO}`).replace(/^year: .*$/m, `year: ${plan.year}`).replace(/^year_label:.*\n/m, '');
  if (plan.min_age === '16') next = next.replace(/^min_age:.*$/m, "min_age: '16'");
  if (next === text) throw new Error(`variant: nothing changed in ${name}`);
  writeFileSync(file, next);
  changed += 1;
}
if (changed !== MOVED.length + SIXTEEN.length) throw new Error(`variant: expected ${MOVED.length + SIXTEEN.length} fixture cards, changed ${changed}`);
console.log(`fixtures: ${MOVED.length} moved to ${MOVED_TO}, ${SIXTEEN.length} set to 16+ in ${FIXTURE_EPOCH}`);
execSync('npx astro build', { cwd: out, stdio: 'inherit', env: { ...process.env, ALLOW_PLACEHOLDER: 'true' } });
if (!existsSync(join(out, 'dist/index.html'))) throw new Error('variant build failed');
console.log(`variant ready: DIST=${join(out, 'dist')} node serve.mjs 4401`);
