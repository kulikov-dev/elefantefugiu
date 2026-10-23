// Time to first paint and to the preloaded fonts, with and without preload, on a throttled connection (about slow 4G).
// Two builds are served: 4401 with both fonts preloaded, 4400 without (the current dist/), e.g.
//   DIST=/tmp/dist-before node serve.mjs 4401 &   node serve.mjs 4400 &   node preload-time.mjs
// Numbers are medians of 5 runs on an emulated slow 4G connection.
import { fsPath, launchBrowser } from './browser.mjs';
const RUNS = 5;
const variants = { 'with preload': 'http://localhost:4401', 'no preload': 'http://localhost:4400' };
const pages = ['/pt/historia/evento-exemplo-01/', '/pt/'];
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const browser = await launchBrowser();
for (const path of pages) {
  const out = {};
  for (const [name, base] of Object.entries(variants)) {
    const fcp = []; const fonts = []; const total = [];
    for (let i = 0; i < RUNS; i += 1) {
      const page = await browser.newPage();
      await page.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true });
      const cdp = await page.createCDPSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 94000 });
      await page.goto(base + path, { waitUntil: 'networkidle0', timeout: 60000 });
      const m = await page.evaluate(() => {
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        const res = performance.getEntriesByType('resource').filter((r) => /\.woff2/.test(r.name));
        const critical = res.filter((r) => /source-serif-4-latin-400-normal|playfair-display/.test(r.name));
        return { fcp: fcpEntry?.startTime ?? NaN, fonts: Math.max(...critical.map((r) => r.responseEnd)), total: performance.getEntriesByType('navigation')[0].loadEventEnd };
      });
      fcp.push(m.fcp); fonts.push(m.fonts); total.push(m.total);
      await page.close();
    }
    out[name] = { fcp: Math.round(median(fcp)), fonts: Math.round(median(fonts)), total: Math.round(median(total)) };
  }
  for (const [name, v] of Object.entries(out)) console.log(`${path}: ${name.padEnd(15)} FCP ${v.fcp} ms, Source Serif 400 + Playfair ready ${v.fonts} ms, load ${v.total} ms`);
}
await browser.close();
