// @ts-check
import { defineConfig } from 'astro/config';

// Site address and base path come from the environment so the project can move
// to a custom domain without code changes (see README).
const site = (process.env.SITE_URL || 'http://localhost:4321').trim().replace(/\/+$/, '');
const rawBase = (process.env.BASE_PATH || '').trim();
const base = rawBase && rawBase !== '/' ? `/${rawBase.replace(/^\/+|\/+$/g, '')}` : '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    locales: ['pt', 'en'],
    defaultLocale: 'pt',
    routing: {
      prefixDefaultLocale: true,
      // "/" is a custom page that picks the language on the client.
      redirectToDefaultLocale: false,
    },
  },
});
