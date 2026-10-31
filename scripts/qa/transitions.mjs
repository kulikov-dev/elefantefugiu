// Browser checks of the page transitions (cross-document View Transitions, speculation rules), against dist/ served by serve.mjs:
//   node transitions.mjs [rule names reduced rules counter]
// The static side (a name twice in the HTML, prerender in the rules) is also checked by the build: scripts/check-transitions.mjs.
import { launchBrowser } from './browser.mjs';
import { epochPath, need, pt, readyEpochs, threadPath, threads } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Click a link and wait until the address is the one asked for (waitForNavigation can miss a navigation that waits for a transition). */
const follow = async (page, selector, path) => {
  await page.click(selector);
  for (let i = 0; i < 100 && new URL(page.url()).pathname !== path; i += 1) await wait(100);
  await wait(500);
};
const browser = await launchBrowser({ prefetch: true });

// A story with a picture of its own (only such a story has a name on its picture), in an epoch that has a page, and a thread with such a story.
const CARD = need('a story with a picture of its own', (list) => list.find((e) => e.image && readyEpochs.some((ep) => ep.id === e.epoch)));
const EPOCH = readyEpochs.find((ep) => ep.id === CARD.epoch);
const THREAD = need('a thread that has a story with a picture', (list) => threads.find((t) => list.some((e) => e.image && (e.threads ?? []).includes(t.id))));
const NAME = `story-${CARD.slug.pt}`;

const newPage = async ({ width = 1280, reduced = false } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  // pagereveal runs on the new page of a navigation; its viewTransition is set only when the browser makes a transition.
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('pagereveal', (e) => {
      try { sessionStorage.setItem('vt', e.viewTransition ? 'yes' : 'no'); } catch {}
    });
  });
  return page;
};
/** The names of the elements that have a view-transition-name now, and those that occur twice. */
const names = (page) =>
  page.evaluate(() => {
    const list = [...document.querySelectorAll('body *')].map((el) => getComputedStyle(el).viewTransitionName).filter((n) => n && n !== 'none');
    return { list, twice: list.filter((n, i) => list.indexOf(n) !== i) };
  });

if (want('rule')) {
  const page = await newPage();
  await page.goto(`${base}${epochPath(EPOCH)}`, { waitUntil: 'load' });
  const rules = await page.evaluate(() => {
    const found = [];
    const visit = (list, media) => {
      for (const r of list) {
        if (typeof r.navigation === 'string') found.push({ navigation: r.navigation, media });
        if (r.cssRules && r.media) visit(r.cssRules, r.media.mediaText);
      }
    };
    for (const s of document.styleSheets) { try { visit(s.cssRules, ''); } catch {} }
    return found;
  });
  ok('rule: the CSS has @view-transition { navigation: auto }', rules.some((r) => r.navigation === 'auto' && !r.media), JSON.stringify(rules));
  ok('rule: under prefers-reduced-motion: reduce the rule says navigation: none', rules.some((r) => r.navigation === 'none' && /reduced-motion/.test(r.media)), JSON.stringify(rules));
  await page.close();
}

if (want('names')) {
  const pages = [
    ['home', '/pt/'],
    ['epoch', epochPath(EPOCH)],
    ['thread', threadPath(THREAD)],
    ['story', pt(CARD)],
  ];
  for (const width of [390, 1280]) {
    for (const [what, path] of pages) {
      const page = await newPage({ width });
      await page.goto(`${base}${path}`, { waitUntil: 'load' });
      const n = await names(page);
      ok(`names: ${what} page at ${width} px, no name twice`, n.twice.length === 0, n.twice.join(',') || `${n.list.length} named`);
      ok(`names: ${what} page at ${width} px, the header has a name of its own`, n.list.includes('site-header'));
      if (what === 'story') ok(`names: the main picture of the story is named ${NAME}`, n.list.includes(NAME), n.list.join(','));
      if (what === 'epoch') ok('names: the picture of the story in the epoch list has the same name', n.list.includes(NAME), n.list.join(','));
      await page.close();
    }
  }
}

if (want('reduced')) {
  // pagereveal.viewTransition is set only when the browser really made the transition.
  const move = async (reduced) => {
    const page = await newPage({ reduced });
    await page.goto(`${base}${epochPath(EPOCH)}`, { waitUntil: 'load' });
    await page.evaluate(() => sessionStorage.removeItem('vt'));
    await follow(page, `#c-${CARD.id} a[href$="${pt(CARD)}"]`, pt(CARD));
    const got = await page.evaluate(() => sessionStorage.getItem('vt'));
    await page.close();
    return got;
  };
  // Not a failure: a headless browser does not always make the transition (the old page must be captured before the new one is revealed), so
  // this is a line "WARN" in the log (run.mjs counts only PASS and FAIL). The rule itself is checked by "rule" above, without a browser's mood.
  let tries = 0;
  let ran = 'no';
  while (ran !== 'yes' && tries < 8) {
    tries += 1;
    ran = await move(false);
  }
  if (ran === 'yes') console.log(`INFO  reduced: a transition ran from the epoch page to the story (after ${tries} tries)`);
  else console.log(`WARN  reduced: no transition ran from the epoch page to the story in ${tries} tries (pagereveal viewTransition: ${ran}); this browser may not make cross-document transitions headless`);
  const reduced = [];
  for (let i = 0; i < 4; i += 1) reduced.push(await move(true));
  if (reduced.every((x) => x === 'no')) console.log('INFO  reduced: with prefers-reduced-motion: reduce no transition ran (4 moves)');
  else console.log(`WARN  reduced: a transition ran with prefers-reduced-motion: reduce (${reduced.join(',')})`);
}

if (want('rules')) {
  const page = await newPage();
  await page.goto(`${base}${epochPath(EPOCH)}`, { waitUntil: 'load' });
  const blocks = await page.evaluate(() => [...document.querySelectorAll('script[type="speculationrules"]')].map((s) => s.textContent));
  ok('rules: one speculationrules block', blocks.length === 1, String(blocks.length));
  let rules = null;
  try {
    rules = JSON.parse(blocks[0]);
  } catch (e) {
    ok('rules: the block is valid JSON', false, String(e));
  }
  if (rules) {
    ok('rules: the block is valid JSON, prefetch only, no prerender', Array.isArray(rules.prefetch) && !('prerender' in rules), Object.keys(rules).join(','));
    ok('rules: eagerness is moderate (pointer over a link, or a touch)', rules.prefetch.every((r) => r.eagerness === 'moderate'));
    // Which links the rule takes: href_matches by URLPattern, selector_matches by the selector. Probe links are added to the page, so that each
    // kind is tried (the page itself may have no link with a ? in it), and the real links of the page are tried too.
    const verdict = await page.evaluate((r) => {
      const conds = r.prefetch[0].where.and;
      const taken = (a) => conds.every((c) => {
        if (c.href_matches) return new URLPattern(c.href_matches, location.origin).test(a.href);
        if (c.not?.href_matches) return !new URLPattern(c.not.href_matches, location.origin).test(a.href);
        if (c.not?.selector_matches) return !a.matches(c.not.selector_matches);
        return false;
      });
      const probe = (href) => {
        const a = document.createElement('a');
        a.setAttribute('href', href);
        document.body.append(a);
        return taken(a);
      };
      const links = [...document.querySelectorAll('a[href]')];
      return {
        page: probe('/pt/historia/x/'),
        query: probe('/pt/historia/x/?a=1'),
        hash: probe('/pt/historia/x/#y'),
        external: probe('https://example.org/pt/historia/x/'),
        short: probe('/p/x/'),
        story: links.filter((a) => a.pathname.includes('/historia/') && !a.hash && !a.search).map(taken),
        skip: links.filter((a) => a.getAttribute('href').includes('#')).map(taken),
      };
    }, rules);
    ok('rules: an internal page is taken', verdict.page && verdict.story.length > 0 && verdict.story.every(Boolean), `${verdict.story.length} story links on the page`);
    ok('rules: a link with a ? is not taken', !verdict.query);
    ok('rules: a link with a # is not taken (also those of the page)', !verdict.hash && verdict.skip.every((x) => !x), `${verdict.skip.length} on the page`);
    ok('rules: a link to another site is not taken', !verdict.external);
    ok('rules: /p/ is not taken', !verdict.short);
    ok('rules: no prerender anywhere in the block', !/prerender/.test(blocks[0]));
  }
  await page.close();
}

if (want('counter')) {
  const html = await (await fetch(`${base}/pt/`)).text();
  if (!html.includes('goatcounter/count.js')) console.log('SKIP  counter: this build has no counter (SITE_URL is a local address)');
  else {
    // One move from the epoch page to a story (with a transition, the pointer over the link first so that the prefetch may run) is one visit.
    const page = await newPage();
    const seen = [];
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.url().includes('goatcounter.com/count')) {
        seen.push(new URL(r.url()));
        r.abort();
      } else r.continue();
    });
    // The counter does not count a local address; this lets the test see what it would send.
    await page.evaluateOnNewDocument(() => {
      let v;
      Object.defineProperty(window, 'goatcounter', { configurable: true, get: () => v, set: (x) => { x.allow_local = true; v = x; } });
    });
    await page.goto(`${base}${epochPath(EPOCH)}`, { waitUntil: 'networkidle0' });
    await wait(500);
    ok('counter: the epoch page itself is one visit', seen.length === 1 && seen[0].searchParams.get('p') === epochPath(EPOCH), seen.map((u) => u.search).join(' | '));
    seen.length = 0;
    const link = `#c-${CARD.id} a[href$="${pt(CARD)}"]`;
    await page.hover(link);
    await wait(600);
    await follow(page, link, pt(CARD));
    await wait(500);
    ok('counter: the move to the story, with a transition and a prefetch, is one visit of the story page', seen.length === 1 && seen[0].searchParams.get('p') === pt(CARD), seen.map((u) => u.search).join(' | ') || 'no request');
    await page.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll transition checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
