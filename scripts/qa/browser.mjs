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

export async function launchBrowser() {
  const own = process.env.CHROME_PATH || CANDIDATES.find((p) => existsSync(p));
  if (own) return puppeteer.launch({ executablePath: own, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}

/** A file URL (new URL('../../x', import.meta.url)) as a path of the operating system, with a trailing slash kept. */
export const fsPath = (url) => fileURLToPath(url);
