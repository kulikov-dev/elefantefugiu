// Minimal static server for dist/ (base path "/"). Usage: node serve.mjs [port]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// DIST=/some/dist serves another build (the family-mode variant build, see prepare-variant.mjs).
const root = (process.env.DIST ? process.env.DIST.replace(/\/?$/, '/') : fileURLToPath(new URL('../../dist/', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 4400);
// BASE_PATH=/elefante serves a build made with that base path: /elefante/pt/ is dist/pt/ (the browser suites then use BASE_URL=http://localhost:4400/elefante).
const prefix = (process.env.BASE_PATH ?? '').replace(/\/$/, '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

createServer((req, res) => {
  let path = normalize(decodeURIComponent((req.url || '/').split(/[?#]/)[0])).replace(/^(\.\.[/\\])+/, '');
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) path = path.slice(prefix.length) || '/';
  let file = join(root, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    // Like GitHub Pages: an address that does not exist gets 404.html, with the status 404.
    const page = join(root, '404.html');
    if (existsSync(page)) {
      res.writeHead(404, { 'content-type': types['.html'] });
      res.end(readFileSync(page));
    } else {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`Serving dist/ on http://localhost:${port}`));
