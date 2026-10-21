# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"O Elefante Fugiu": a static bilingual (pt / en) Astro + TypeScript site of short interactive stories from Portuguese history, tied to a map and to time. Deployed to GitHub Pages; no server, accounts, cookies or trackers. Node >= 22.12. `README.md` has the full script table, configuration and structure; product specs are in `docs/design.md` and `docs/spec.md`. `docs/STATE.md` (written in Russian) is the running log of decisions per stage and should be read before non-trivial changes.

## Commands

- `npm run dev` — dev server at http://localhost:4321/ (open `/pt/` or `/en/`)
- `npm run build` — runs i18n key check, contrast check, all unit tests, data check, then `astro build`; `postbuild` then runs links, cards, listings, weight and tokens checks against `dist/`. The build is the main gate: it fails on broken internal links, hard-coded colours/fonts/sizes, page weight over 500 KB, etc.
- `npm run check` — `astro check` (types)
- `npm run check:data` — validate `src/content/*.yaml`
- `npm test` — `node:test` tests in `tests/*.test.ts` plus Vitest in `tests/vitest/*.spec.ts`
  - single node:test file: `node --import tsx --test tests/events.test.ts`
  - single Vitest file: `npx vitest run tests/vitest/markers.spec.ts`
- `npm run qa` — Chromium browser suites in `scripts/qa` (own `package.json`/dependencies, needs a finished build; `-- --list`, `-- <suite>`, `--resume`). Not part of the build.
- Non-root hosting test: `SITE_URL=https://USER.github.io BASE_PATH=/REPO npm run build`
- `ALLOW_PLACEHOLDER=false npm run build` shows which `placeholder: true` entries still block a real launch.

## Architecture

- **Content** is YAML in `src/content/` (`events/<id>.yaml`, one per event, file name = id; plus `epochs`, `threads`, `featured`, `ui`). Zod schemas live in `src/data/schemas.ts` and are shared by Astro collections (`src/content.config.ts`) and `scripts/check-data.ts`. Interface strings are NOT content: they are in `src/i18n/pt.json` / `en.json` (the build requires identical keys).
- **Routing**: addresses come from one `ROUTES` map in `src/i18n/routes.ts`; every internal link must go through its helpers (`withBase`, `pagePath`, `storyPath`, ...) so base-path deployments work. Pages: `src/pages/[lang]/[segment]/[slug].astro` is a single route for cards, epochs and threads; the map page has its own route file (`[map].astro`) so map code only reaches map pages. `src/views/*` hold page bodies; routes only dispatch. `trailingSlash: 'always'`, directory format.
- **Logic** is in `src/lib/` as pure functions with no Astro imports (testable in plain Node); `site-data.ts` is the only file importing `astro:content`.
- **Client JS** (`src/scripts/`) is minimal and loaded per page: the map (Leaflet 1.9.4) is a lazy island (`map-loader.ts` decides when, `map-island.ts` is the separate chunk); interactives (`army-dots`, `ship-scale`) are inlined only on pages that use them. Features must degrade without JS (e.g. family mode shows everything).
- **Theming / family mode**: colours, fonts and sizes come only from `src/styles/tokens.css` (`light-dark()` pairs, `data-theme` and `data-epoch` on `<html>`); `check:tokens` rejects literals elsewhere (1px hairlines and media queries are allowed). One inline script in `<head>` (`src/lib/head-script.ts`) sets theme/epoch/family attributes before first paint; family-mode card hiding is CSS-driven from `data-family`.
- Map tiles default to public OSM (dev only); production needs `TILE_URL` + `TILE_ATTRIBUTION`.
