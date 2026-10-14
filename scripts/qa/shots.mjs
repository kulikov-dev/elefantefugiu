import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
import { mkdirSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://localhost:4400';
const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
// Card pages to photograph at 360px: with image + interactive, layer 3 open, sensitive (en), without image.
const shots = [
  ['pt/historia/evento-exemplo-02', 'card02-pt', {}],
  ['pt/historia/evento-exemplo-02', 'card02-pt-open', { hash: '#detalhes' }],
  ['en/story/example-event-19', 'card19-en', {}],
  ['pt/historia/evento-exemplo-07', 'card07-pt-noimg', {}],
  ['pt/epoca/avis-e-descobrimentos', 'epoch-avis-pt', {}],
  ['pt/epoca/avis-e-descobrimentos', 'epoch-avis-pt-open', { hash: '#c-evento-exemplo-02' }],
  ['en/thread/sea', 'thread-sea-en', {}],
];
for (const [path, name, opt] of shots) {
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${base}/${path}/${opt.hash ?? ''}`, { waitUntil: 'networkidle0' });
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  console.log(name, 'horizontal overflow px:', overflow);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
