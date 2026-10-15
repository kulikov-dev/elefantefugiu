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
| `npm run postbuild` | Runs by itself after `build`: internal links and anchors, card pages, epoch and thread pages, page weight |
| `npm run preview` | Serves `dist/` locally |
| `npm run check` | `astro check` (types, Astro files) |
| `npm run check:data` | Validates `src/content/*.yaml` and prints a data summary (errors fail, warnings do not) |
| `npm run check:links` | Every internal link in `dist/` starts with the base path and points to an existing file; every `#fragment` matches an id on the target page |
| `npm run check:listings` | Built epoch and thread pages against the data: feed order, counters, sections, neighbouring epochs, every card reachable from a feed |
| `npm run check:cards` | Built card pages: one `h1`, heading order, alt text, labels, sources, bridge, meta tags, hreflang, `noindex` only on placeholder cards |
| `npm run check:weight` | Weight of card, epoch and thread pages without images (HTML + CSS + JS, raw, gzip, brotli) against the 500 KB budget; also prints the size of the map code, which is counted apart |
| `npm run check:tokens` | Colours, fonts and sizes must come from `src/styles/tokens.css`: fails on values written directly in components or stylesheets (1px hairlines and media queries are allowed) |
| `npm test` | Unit tests: `tests/*.test.ts` (`node:test` with `tsx`: thread visibility, `min_age`, card helpers, filters, address parameters) and `tests/vitest/*.spec.ts` (Vitest: marker selection, map address state, tile settings) |
| `npm run test:unit` | Only the Vitest tests |
| `npm run export:ui-table` | Prints a key / PT / EN table of all interface strings for review by a native speaker (`-- --format csv`, `-- --out file`) |

`check:links`, `check:cards`, `check:listings`, `check:weight` and `check:tokens` run in `postbuild`; the first four need a finished build (`dist/`).
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
| `TILE_URL` | Map tile address, `https://` and containing `{z}`, `{x}`, `{y}`; empty = public OpenStreetMap server | empty |
| `TILE_ATTRIBUTION` | Attribution shown on the map (HTML, links allowed); required when `TILE_URL` is set | empty |

All internal links are built from the base path (`src/i18n/routes.ts`), so the
site works under a non-empty base. `npm run build` fails if an internal link
ignores the base or points to a missing page.

### Map tiles (open question)

With `TILE_URL` empty the map uses the public OpenStreetMap tile server. That is fine for development, but its
usage policy does not allow steady public traffic. **Before a public launch a tile provider (with a free tier)
or our own tiles are needed**; then set the repository variables `TILE_URL` and `TILE_ATTRIBUTION` (the deploy
workflow passes them to the build). The map shows the attribution, visible and clickable, whatever the source.
If tiles do not load, the map page and the epoch page fall back to the list of cards.

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
src/pages        routes: / (language chooser), /[lang]/[...page] (home and stubs), /[lang]/[map] (map page, own file so the map code reaches only map pages), /[lang]/[segment]/[slug] (cards, epochs, threads), 404
src/views        page bodies: StoryView, EpochView (feed and map), ThreadView, HomeView, MapView
src/scripts      client code: epoch-filter (thread filter, timeline/grid), epoch-map (feed and map talk to each other, phone pane switch), map-loader (loads the map when the block comes into view), map-island (Leaflet, loaded on demand), lang-carry (language switch keeps ?fio= ?vista=), surprise ("Surprise me")
src/layouts      BaseLayout (head, meta tags, header, footer)
src/components   header, footer, language switch, card components (CardLayers, TagLabel, ...), list components (EventCard, ThreadChip, PagerNav, EpochSwitcher)
src/content      YAML content: events/, epochs, threads, featured
src/data         Zod schemas
src/lib          pure helpers (card logic, thread visibility, home tiles, filter state, marker selection, map state, tile settings), covered by tests/
src/i18n         pt.json, en.json, route map, t() helper
src/styles       tokens (all colours, fonts, sizes), reset, base, layout, map (loaded only with the map)
tests            unit tests
scripts          build-time checks and tools; scripts/qa = browser checks (own dependencies)
docs             design.md, spec.md, STATE.md
```

## Licenses

Code: MIT (`LICENSE`). Texts: CC BY-SA 4.0 (`LICENSE-CONTENT.md`).
