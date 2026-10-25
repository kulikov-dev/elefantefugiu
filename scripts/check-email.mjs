// The contact address must not be written out anywhere in the built site: the pages show "name [at] host" and the script puts the link
// together from two halves (src/lib/contact.ts, src/scripts/email.ts). Looks for the address (and for anything that looks like one) in the text files of dist/.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(dist)) {
  console.error('dist/ is missing: build first');
  process.exit(1);
}
const TEXT = /\.(html|js|json|xml|txt|webmanifest)$/;
const ADDRESS = /[A-Za-z0-9._+-]+@[A-Za-z0-9-]+\.(?:com|org|net|pt|eu|io)\b/;
const found = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (TEXT.test(name) && ADDRESS.test(readFileSync(path, 'utf8'))) found.push(path.slice(dist.length));
  }
};
walk(dist);
if (found.length) {
  console.error(`Email check failed: something that looks like an address is written out in ${found.length} file(s):\n- ${found.join('\n- ')}`);
  process.exit(1);
}
console.log('Email check passed: no email address is written out in dist/.');
