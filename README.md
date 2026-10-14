# O Elefante Fugiu

Static bilingual (pt / en) site with short interactive stories from Portuguese
history, tied to a map and to time. Built with Astro and TypeScript, published
to GitHub Pages. No server, no accounts, no cookies, no third-party trackers.

Product and page specs: `docs/design.md`, `docs/spec.md`. Current project state: `docs/STATE.md`.

## Requirements

- Node.js 22.12 or newer
- npm

## Run locally

```sh
npm install
npm run dev
```

The dev server runs at http://localhost:4321/. Open `/pt/` or `/en/`.

## npm scripts

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Astro dev server at http://localhost:4321/ |
| `npm run build` | Full build: i18n key check, unit tests, data check, Astro build, then `postbuild` |
| `npm run postbuild` | Runs by itself after `build`: internal links, card pages, page weight |
| `npm run preview` | Serves `dist/` locally |
| `npm run check` | `astro check` (types, Astro files) |
| `npm run check:data` | Validates `src/content/*.yaml` and prints a data summary (errors fail, warnings do not) |
| `npm run check:links` | Every internal link in `dist/` starts with the base path and points to an existing file |
| `npm run check:cards` | Built card pages: one `h1`, heading order, alt text, labels, sources, bridge, meta tags, hreflang, `noindex` only on placeholder cards |
| `npm run check:weight` | Weight of card pages without images (HTML + CSS + JS, raw, gzip, brotli) against the 500 KB budget |
| `npm test` | Unit tests (`tests/`, `node:test` with `tsx`): thread visibility, `min_age`, card helpers |
| `npm run export:ui-table` | Prints a key / PT / EN table of all interface strings for review by a native speaker (`-- --format csv`, `-- --out file`) |

`check:links`, `check:cards` and `check:weight` need a finished build (`dist/`).
Browser checks (Chromium) are separate and not part of the build: see `scripts/qa/README.md`.

To test a project-site build with a base path:

```sh
SITE_URL=https://USER.github.io BASE_PATH=/REPO npm run build
```

## Configuration

| Variable   | Meaning                                              | Default                 |
| ---------- | ---------------------------------------------------- | ----------------------- |
| `SITE_URL` | Public origin of the site, without a path            | `http://localhost:4321` |
| `BASE_PATH`| Path the site is served from, e.g. `/REPO`; empty or `/` for a domain root | empty |
| `ALLOW_PLACEHOLDER` | `false` makes the build fail while any entry has `placeholder: true` | `true` |

All internal links are built from the base path (`src/i18n/routes.ts`), so the
site works under a non-empty base. `npm run build` fails if an internal link
ignores the base or points to a missing page.

## Content data

Content lives in `src/content/` as YAML (schemas in `src/data/schemas.ts`):

```
events/<id>.yaml   one file per event; the file name equals the id
epochs.yaml  threads.yaml  featured.yaml
```

Interface strings are not content data: they live in `src/i18n/pt.json` and
`src/i18n/en.json` (the build checks that both have the same keys).

`npm run check:data` reports problems as `file [field, language]: message`
and prints a summary. Length limits for entries with `placeholder: true` are
warnings only. Test data is latin filler with `placeholder: true`; run
`ALLOW_PLACEHOLDER=false npm run build` to see what still blocks a real launch.

## Publishing to GitHub Pages

1. Push the repository to GitHub (branch `main`).
2. In the repository, open Settings, Pages, and set Source to **GitHub Actions**.
3. Push to `main` (or run the workflow manually). `.github/workflows/deploy.yml`
   builds the site and deploys it.

By default the workflow builds a project site at `https://OWNER.github.io/REPO/`:
`SITE_URL` is `https://OWNER.github.io` and `BASE_PATH` is `/REPO`. You can
override both with repository variables (Settings, Secrets and variables, Actions, Variables).

## Moving to a custom domain

1. Point the domain's DNS to GitHub Pages and set the custom domain in Settings, Pages.
2. Create the repository variable `SITE_URL` with the new origin, for example `https://example.pt`.
3. Delete the repository variable `BASE_PATH` if you set one. When `SITE_URL` is set and `BASE_PATH` is not, the workflow builds with the base `/`.
4. Run the workflow again. No code changes are needed.

## Project structure

```
src/pages        routes: / (language chooser), /[lang]/[...page] (stubs), /[lang]/[segment]/[slug] (card page), 404
src/layouts      BaseLayout (head, meta tags, header, footer)
src/components   header, footer, language switch, and the card components (CardLayers, TagLabel, AgeBadge, ...)
src/content      YAML content: events/, epochs, threads, featured
src/data         Zod schemas
src/lib          pure helpers (card logic, thread visibility), covered by tests/
src/i18n         pt.json, en.json, route map, t() helper
src/styles       tokens, reset, base, layout
tests            unit tests
scripts          build-time checks and tools; scripts/qa = browser checks (own dependencies)
docs             design.md, spec.md, STATE.md
```

## Licenses

Code: MIT (`LICENSE`). Texts: CC BY-SA 4.0 (`LICENSE-CONTENT.md`).
