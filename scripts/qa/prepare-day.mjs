// Builds the real site (no fixtures) as if it were built on a given day: SITE_TODAY=<day>. The suite of the holidays needs this because the pages of a holiday
// (noindex, sitemap, the picture of the home page, the header without JavaScript) are decided when the site is built, by the day of the build; a suite that
// takes whatever day it is today passes in some weeks and fails in others. The build runs in a copy of the sources under the temporary directory, so dist/
// of the real site is not touched.
// Usage: node prepare-day.mjs <name> <YYYY-MM-DD>   (then DIST=<tmp>/elefante-day-<name>/dist node serve.mjs <port>)
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [name, day] = process.argv.slice(2);
if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) throw new Error('usage: node prepare-day.mjs <name> <YYYY-MM-DD>');
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = join(process.env.QA_VARIANT_DIR || tmpdir(), `elefante-day-${name}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// .og-cache holds the lists of the preview cards (scripts/make-og.mjs, make-festa-og.mjs): without it the pages get no card of their own.
for (const item of ['src', 'public', '.og-cache', 'astro.config.mjs', 'tsconfig.json', 'package.json']) if (existsSync(join(root, item))) cpSync(join(root, item), join(out, item), { recursive: true });
symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'), 'junction');
// BASE_URL and VARIANT_URL are the addresses the suites are given; Vite takes BASE_URL for the base path of the build, so they stay out of the build.
const { BASE_URL, VARIANT_URL, ...env } = process.env;
execSync('npx astro build', { cwd: out, stdio: 'inherit', env: { ...env, SITE_TODAY: day, ALLOW_PLACEHOLDER: 'true' } });
if (!existsSync(join(out, 'dist/index.html'))) throw new Error(`the build of ${name} (${day}) failed`);
console.log(`day build ${name} (${day}) ready: DIST=${join(out, 'dist')}`);
