# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"O Elefante Fugiu": a static bilingual (pt / en) Astro + TypeScript site of short interactive stories from Portuguese history, tied to a map and to time. Deployed to GitHub Pages; no server, accounts, cookies or trackers. Node >= 22.12. `README.md` has the full script table, configuration and structure; product specs are in `docs/design.md` and `docs/spec.md`. `docs/STATE.md` (written in Russian) is the running log of decisions per stage and should be read before non-trivial changes.

## Commands

- `npm run dev` — dev server at http://localhost:4321/ (open `/pt/` or `/en/`)
- `npm run build` — runs i18n key check, contrast check, all unit tests, data check, then `astro build`; `postbuild` then runs links, cards, listings, weight and tokens checks against `dist/`. The build is the main gate: it fails on broken internal links, hard-coded colours/fonts/sizes, page weight over 500 KB, etc.
- `npm run check` — `astro check` (types)
- `npm run check:data` — validate `src/content/*.yaml`
- `npm test` — `astro check` (types), then `node:test` tests in `tests/*.test.ts`, Vitest in `tests/vitest/*.spec.ts`, and the language checks
  - single node:test file: `node --import tsx --test tests/events.test.ts`
  - single Vitest file: `npx vitest run tests/vitest/markers.spec.ts`
- `npm run qa` — Chromium browser suites in `scripts/qa` (own `package.json`/dependencies, needs a finished build; `-- --list`, `-- <suite>`, `--resume`, `--verbose`). Not part of the build. **Do not run it locally on your own initiative**: see the rule below.
- Non-root hosting test: `SITE_URL=https://USER.github.io BASE_PATH=/REPO npm run build`
- `ALLOW_PLACEHOLDER=false npm run build` shows which `placeholder: true` entries still block a real launch.

## Rules for Claude Code on checks

- After a change run locally only `npm run build` and `npm test` (that is the gate: `npm test` includes `astro check`, and the Deploy workflow runs the same check, so Deploy must never fail on something that these two commands catch locally; `npm run check:data` and `npm run check:lang` for content and texts).
- Run the full `npm run qa` (about 30 minutes) only when the owner asks for it directly; one named suite (`npm run qa -- bridge`) only to test a change of `scripts/qa` itself.
- The browser suites run in GitHub Actions: `qa-smoke.yml` (six main suites, every push and pull request) and `qa-full.yml` (all suites, every Monday and by hand). Look at their results there: `gh run list`, `gh run view <id>` (add `--log-failed` for a failed one). If `gh` is not installed, the public API answers too: `https://api.github.com/repos/kulikov-dev/elefantefugiu/actions/runs`.
- Never stop browsers or Node processes broadly (`taskkill /IM chrome.exe` and the like): stop the background task you started instead.

### Tests do not hold content numbers

- In `tests/` and `scripts/qa/` there is no number or list that depends on the content: the count of stories, epochs, threads or cards on the map, epoch ids, which epochs are open (MVP), how many cards an epoch has. Expectations are counted from the data (`scripts/qa/data.mjs`, `src/content/epochs.yaml`, `world.*` for the fixture build), and a limit on key presses, scrolls or clicks is derived from them (`TOTAL + 30` Tab stops, `ceil(cards / step) + 2` presses of "Show more"). A test that needs a kind of epoch or card picks it from the data and fails with a message naming what is missing (`need`).
- Pure unit tests with their own small input (`e1`, `e2`, ...) are fine: the input is part of the test.
- When the data changes (new stories, epochs open) or the behaviour of the map or navigation changes, run the affected QA suites locally before pushing to main (`npm run qa -- map-variant map-more`, and so on). A suite named in the change is not "the owner's full run": this is the one case where the rule above allows a named suite.

### "Show and wait for OK" means stop

When a prompt says to show something and wait for "ok" (or approval) before going on, stop after showing it, even if the later steps (docs, build, commit, push, deploy) are listed as one chain. Do not treat the chain as permission to continue: run those steps only after the owner's explicit "ok", and after any new corrections to what was shown, show the result again and wait again unless the owner said otherwise.

### Large changes (opening epochs, reworking the map or navigation)

Branch, not main: branch -> push -> QA full on the branch (`gh workflow run qa-full.yml --ref <branch>`, or Actions -> QA full -> Run workflow -> choose the branch; `qa-full.yml` has `workflow_dispatch` and checks out the chosen ref) -> `gh run watch` / `gh run view <id> --log-failed` -> merge into main only after it is green.

## Architecture

- **Content** is YAML in `src/content/` (`events/<id>.yaml`, one per event, file name = id; plus `epochs`, `threads`, `featured`, `ui`). Zod schemas live in `src/data/schemas.ts` and are shared by Astro collections (`src/content.config.ts`) and `scripts/check-data.ts`. Interface strings are NOT content: they are in `src/i18n/pt.json` / `en.json` (the build requires identical keys).
- **Routing**: addresses come from one `ROUTES` map in `src/i18n/routes.ts`; every internal link must go through its helpers (`withBase`, `pagePath`, `storyPath`, ...) so base-path deployments work. Pages: `src/pages/[lang]/[segment]/[slug].astro` is a single route for cards, epochs and threads; the map page has its own route file (`[map].astro`) so map code only reaches map pages. `src/views/*` hold page bodies; routes only dispatch. `trailingSlash: 'always'`, directory format.
- **Logic** is in `src/lib/` as pure functions with no Astro imports (testable in plain Node); `site-data.ts` is the only file importing `astro:content`.
- **Client JS** (`src/scripts/`) is minimal and loaded per page: the map (Leaflet 1.9.4) is a lazy island (`map-loader.ts` decides when, `map-island.ts` is the separate chunk); interactives (`army-dots`, `ship-scale`) are inlined only on pages that use them. Features must degrade without JS (e.g. family mode shows everything).
- **Theming / family mode**: colours, fonts and sizes come only from `src/styles/tokens.css` (`light-dark()` pairs, `data-theme` and `data-epoch` on `<html>`); `check:tokens` rejects literals elsewhere (1px hairlines and media queries are allowed). One inline script in `<head>` (`src/lib/head-script.ts`) sets theme/epoch/family attributes before first paint; family-mode card hiding is CSS-driven from `data-family`.
- Map tiles default to public OSM (dev only); production sets `CARTO_KEY` (CARTO Voyager / Dark Matter by theme) or `TILE_URL` + `TILE_ATTRIBUTION`.
