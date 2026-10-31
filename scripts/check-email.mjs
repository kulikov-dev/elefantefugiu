// The contact address must not be written out anywhere in the built site: a page shows "name (arroba) host" (pt), "name (at) host" (en) or "name (собака) host" (ru) and the
// script puts the mailto link and its text together from two halves (src/lib/contact.ts, src/scripts/email.ts). Looks for the address (the exact one and anything that
// looks like one) in the text files of dist/; the About page has no address at all; the Legal page of each language has the span with the words for "@" and the halves.
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
// The exact address of the project (src/data/static-pages.ts): found nowhere, in no file of dist/.
const EXACT = /CONTACT_EMAIL = '([^']+)'/.exec(readFileSync(fileURLToPath(new URL('../src/data/static-pages.ts', import.meta.url)), 'utf8'))?.[1];
if (!EXACT) {
  console.error('Email check failed: CONTACT_EMAIL is not in src/data/static-pages.ts');
  process.exit(1);
}
const found = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (TEXT.test(name)) {
      const text = readFileSync(path, 'utf8');
      if (ADDRESS.test(text) || text.includes(EXACT)) found.push(path.slice(dist.length));
    }
  }
};
walk(dist);
if (found.length) {
  console.error(`Email check failed: something that looks like an address is written out in ${found.length} file(s):\n- ${found.join('\n- ')}`);
  process.exit(1);
}

// What each page says in place of the address.
const errors = [];
const LEGAL = { pt: 'pt/legal', en: 'en/legal', ru: 'ru/pravovaya-informaciya' };
const ABOUT = { pt: 'pt/sobre', en: 'en/about', ru: 'ru/o-proekte' };
const WORD = { pt: '(arroba)', en: '(at)', ru: '(собака)' };
const [user, host] = EXACT.split('@');
for (const lang of ['pt', 'en', 'ru']) {
  const legal = join(dist, LEGAL[lang], 'index.html');
  if (!existsSync(legal)) errors.push(`${LEGAL[lang]}/index.html is missing`);
  else {
    const html = readFileSync(legal, 'utf8');
    if (!html.includes(`>${user} ${WORD[lang]} ${host}</span>`)) errors.push(`${LEGAL[lang]}: the address is not written as "${user} ${WORD[lang]} ${host}" for a reader without JavaScript`);
    if (!html.includes(`data-email-user="${user}"`) || !html.includes(`data-email-host="${host}"`)) errors.push(`${LEGAL[lang]}: the two halves of the address for the script are missing`);
    if (html.includes('href="mailto:')) errors.push(`${LEGAL[lang]}: a mailto link is written out in the HTML (the script puts it together)`);
  }
  const about = join(dist, ABOUT[lang], 'index.html');
  if (existsSync(about) && /data-email-user="|href="mailto:/.test(readFileSync(about, 'utf8'))) errors.push(`${ABOUT[lang]}: the About page must lead to the contact form, not show the address`);
}
if (errors.length) {
  console.error(`Email check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('Email check passed: no email address is written out in dist/; the Legal pages give the words for @ and the two halves, the About pages show no address.');
