// Shared helpers of the browser suites: start the browser and turn file URLs into paths that also work on Windows.
//   CHROME_PATH=/path/to/chrome   use this browser (any Chrome or Chromium); without it a Chrome or Edge installed on the machine
//                                 is looked for (Windows, macOS), and on Linux the bundled @sparticuz/chromium is used.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const start = async () => {
  const own = process.env.CHROME_PATH || CANDIDATES.find((p) => existsSync(p));
  if (own) return puppeteer.launch({ executablePath: own, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
};

// The browser of a long suite can die between two pages on a busy runner ("Session with given id not found", "Target closed"). A page that
// cannot be opened for that reason is opened again in a new browser, and the log says so (a line "NOTE"); any other error is thrown as it is.
const DEAD = /Session with given id not found|Target closed|Connection closed|Protocol error|Browser has disconnected/i;

export async function launchBrowser() {
  let browser = await start();
  const again = async (open) => {
    try {
      return await open(browser);
    } catch (e) {
      if (!DEAD.test(String(e?.message))) throw e;
      console.log(`NOTE  the browser died (${String(e.message).slice(0, 80)}); started a new one and opened the page again`);
      await browser.close().catch(() => {});
      browser = await start();
      return open(browser);
    }
  };
  return new Proxy({}, {
    get(_, name) {
      if (name === 'newPage') return () => again((b) => b.newPage());
      if (name === 'createBrowserContext') return () => again((b) => b.createBrowserContext());
      const value = browser[name];
      return typeof value === 'function' ? value.bind(browser) : value;
    },
  });
}

/** A file URL (new URL('../../x', import.meta.url)) as a path of the operating system, with a trailing slash kept. */
export const fsPath = (url) => fileURLToPath(url);
