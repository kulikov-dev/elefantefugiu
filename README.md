# O Elefante Fugiu

Static trilingual (pt / en / ru) site with short interactive stories from Portuguese
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
| `npm run check:listings` | Built epoch and thread pages against the data: feed order, counters (all three family-mode numbers), sections, neighbouring epochs, every card reachable from a feed |
| `npm run check:ru` | Built Russian pages against the data: `lang`, `og:locale`, own or stand-in text, the "not translated" banner, `noindex`, `hreflang` (also on the Portuguese and English pages of the same cards); part of `postbuild` |
| `npm run check:cards` | Built card pages: one `h1`, heading order, alt text, labels, sources, bridge, meta tags, hreflang, `noindex` only on placeholder cards; family mode: head script, toggle, intermediate screen, "Nearby" and previous / next per mode |
| `npm run check:weight` | Weight of card, epoch and thread pages without images (HTML + CSS + JS, raw, gzip, brotli) against the 500 KB budget; also prints the size of the map code, which is counted apart |
| `npm run check:contrast` | WCAG contrast of every colour pair in both themes and all epoch palettes (part of `npm run build`) |
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

## Browser checks

`npm run qa` runs every browser suite (Chromium, `scripts/qa`) against the finished build: one line per suite, the failed checks of a failing suite, and one summary line (`--verbose` prints every log and the full table); `npm run qa -- --list` shows the suites, `npm run qa -- <suite>` runs one, `--resume` continues an interrupted run, `BASE_PATH=/elefante npm run qa` runs against a build made with that base path. See `scripts/qa/README.md`.

The browser checks run in GitHub Actions, not on the developer's machine:

- `.github/workflows/deploy.yml`: `astro check`, `npm test` and `npm run build` (the build checks and every `postbuild` check) with `SITE_URL=https://elefantefugiu.pt`; the site is published only when all of it passes.
- `.github/workflows/qa-smoke.yml`: on every push to main and every pull request, six main suites (`listings`, `pages`, `bridge`, `map-basic`, `family-controls`, `service`: home, epoch and thread pages, static pages, a story page, the map, the age button, the service pages and the 404 page).
- `.github/workflows/qa-full.yml`: the full `npm run qa` (all suites, the variant build, the mascot) every Monday at 07:00 UTC and by hand (Actions tab, "QA full", Run workflow). The log holds a short summary; the full logs of every suite are the artifact `qa-full`.

Look at the results in the Actions tab or with the GitHub CLI: `gh run list --workflow "QA smoke"`, `gh run view <id>`, `gh run view <id> --log-failed`. Locally, after a change, run only `npm run build` and `npm test`; the full `npm run qa` only when you really need it.

## Themes and fonts

Light and dark themes and three epoch palettes (`docs/visual-direction.md`) are CSS tokens in `src/styles/tokens.css`, each colour a `light-dark()` pair; `<html data-theme>` (system, light, dark: header icon and footer radio group, key `theme` in `localStorage`) and `<html data-epoch>` select them, set before the first paint by the one inline script in `<head>`. Fonts (Playfair Display, Source Serif 4, Oswald) are self-hosted from Fontsource packages, Latin subset only, with metric-matched fallback faces (`src/styles/fonts.css`, `node scripts/font-fallbacks.mjs`); `docs/STATE.md` says how to add Cyrillic for `/ru/`. Browser checks: `scripts/qa/theme.mjs`.

## Azulejo patterns

Four one-colour SVG patterns in `src/assets/azulejo/` (compass for Avis and the Discoveries, rhombus for Pombal and 1755, rose for the Estado Novo and 25 April, and a single corner signature) are drawn as CSS masks (`src/styles/azulejo.css`) in the epoch's primary colour. `BaseLayout` imports them with `?url` (so the paths keep `BASE_PATH`) and puts the addresses in `:root` (`src/lib/azulejo.ts`). Decorative layers only, `aria-hidden`: a band under the epoch header and on the card page, a band on the key events of the feed, a strip along the timeline, the corner on epoch pages and on the 404 page. Opacity belongs to the layer (`--azulejo-opacity-frame`), never to text; `npm run check:contrast` checks text over the pattern at the highest opacity. The compass or the rhombus is also the "breathing tile" of the map while it loads (shown only after 300 ms, still with `prefers-reduced-motion`). Browser checks: `scripts/qa/azulejo.mjs`.

## Interactives

Two interactives live in the "More" layer of a card, driven by `interactive: {type, data}` in the event file (`army_dots`: "One against five", `ship_scale`: "Size of the nau"; schemas in `src/data/schemas.ts`). They are SVG and CSS without libraries, have a text and table alternative, and a static version without JavaScript. Their script and styles are inlined only into pages that show them (`npm run check:weight` prints their size and fails if the code reaches any other page). Browser checks: `scripts/qa/interactives.mjs`.

## Family mode

A three-way switch in the header (everything / all ages / up to 12+). The choice is kept in `localStorage` (key `family`); without JavaScript the switch is not shown and every story is visible. The rules are in `src/lib/family.ts`; the cards are hidden by CSS (`src/styles/family.css`) from `data-family` on `<html>`, which a small inline script in `<head>` sets before the first paint. A card that the current mode hides still opens, after an intermediate screen ("Open" is for one visit). Browser checks: `scripts/qa/family.mjs`.

## Configuration

| Variable   | Meaning                                              | Default                 |
| ---------- | ---------------------------------------------------- | ----------------------- |
| `SITE_URL` | Public origin of the site, without a path            | `http://localhost:4321` |
| `BASE_PATH`| Path the site is served from, e.g. `/REPO`; empty or `/` for a domain root | empty |
| `ALLOW_PLACEHOLDER` | `false` makes the build fail while any entry has `placeholder: true` | `true` |
| `CARTO_KEY` | Key of the CARTO basemaps; switches the map to Voyager (light theme) and Dark Matter (dark theme); empty = see below | empty |
| `TILE_URL` | Map tile address, `https://` and containing `{z}`, `{x}`, `{y}`; empty = public OpenStreetMap server | empty |
| `TILE_ATTRIBUTION` | Attribution shown on the map (HTML, links allowed); required when `TILE_URL` is set | empty |

All internal links are built from the base path (`src/i18n/routes.ts`), so the
site works under a non-empty base. `npm run build` fails if an internal link
ignores the base or points to a missing page.

### Map tiles

The production map uses the CARTO basemaps (raster tiles, non-commercial key): Voyager in the light theme, Dark Matter in
the dark one; the style changes with the theme of the site. Set the repository variable `CARTO_KEY` (Settings, Secrets and
variables, Actions, tab Variables); the deploy workflow passes it to the build. For a local build put `CARTO_KEY=...` in
`.env` (git-ignored, see `.env.example`). The key is not a secret: it is part of every tile address of the built site, so
restrict it to the site's domain in the CARTO dashboard.

With `CARTO_KEY` empty the map uses the public OpenStreetMap tile server. That is fine for development, but its
usage policy does not allow steady public traffic. Another provider: the variables `TILE_URL` and `TILE_ATTRIBUTION`
(they win over `CARTO_KEY`). The map shows the attribution, visible and clickable, whatever the source
("(c) OpenStreetMap contributors, (c) CARTO" with CARTO).
If tiles do not load, the map page and the epoch page fall back to the list of cards.

## Mistake reports, static pages, sitemap

The "Found a mistake?" form posts to the FormSubmit service, which forwards it to the project address (`CONTACT_EMAIL` in `src/data/static-pages.ts`); the first message must be confirmed once by the owner (see `docs/STATE.md`). Texts of the About, Method and Legal pages are in `src/data/static-pages.ts` (three languages, same sections). `npm run build` also writes `dist/sitemap.xml` and `dist/robots.txt` from the built pages (only pages without `noindex`; `robots.txt` counts at the root of a domain). `/p/{event id}/` is the QR address of a card (redirects to the card in the reader's language with `?src=qr`). `npm run make:og` makes PNG previews of the SVG pictures. `node scripts/export-addresses.mjs` prints the table of all addresses. Node 22 is pinned in `.nvmrc` and the workflow.

## Mascot

The elephant pictures are made from the originals in `docs/mascot/originals/` with `node scripts/make-mascot.mjs` (background removed, WebP into `public/mascot/`). `<Mascot pose="..." />` shows one; it never appears on card pages or on the pages of the Estado Novo epoch (`src/lib/mascot.ts`, `check-mascot.mjs`).

## Languages

`pt` (default), `en` and `ru`. Addresses are `/{lang}/...`; the table of all addresses is in `docs/spec.md` section 2 (Russian ones are Latin transliterations such as `/ru/istoriya/{slug}`). The root `/` goes to the saved language (`localStorage` key `lang`), then to the browser language (`ru*` to `/ru/`, `en*` to `/en/`, anything else to `/pt/`). The header switch is a small `<details>` menu (three segments do not fit next to the name on a 320 px phone).

Data: every localized field is `{pt, en, ru?}`. An event has `ru_ready` (default `false`). While it is `false`, `/ru/` shows the English text (fallback chain ru, en, pt) at the English address, with a banner, `noindex` and no `hreflang`; with `ru_ready: true` every localized field needs its `ru` text and the same length rules apply (`check:data` and the schema say which field is missing). Interface strings: `src/i18n/ru.json` (Russian plurals need `_one`, `_few`, `_many`, `_other`; `npm run check:i18n` checks all three files). `npm run export:ui-table` prints the PT / EN / RU table for a native speaker.

Fonts: the Cyrillic subsets of the three fonts are declared in `src/styles/fonts.css` with their own `unicode-range`, so only pages that draw Cyrillic letters fetch them (preloaded on the Russian pages only; the Portuguese and English pages preload nothing). Cyrillic fallback faces: `node scripts/font-fallbacks-cyrillic.mjs`.

## Content data

Content lives in `src/content/` as YAML (schemas in `src/data/schemas.ts`):

```
events/<id>.yaml   one file per event; the file name equals the id
epochs.yaml  threads.yaml  featured.yaml
```

Interface strings are not content data: they live in `src/i18n/pt.json`,
`en.json` and `ru.json` (the build checks that they have the same keys).

Adding a story: copy an existing `events/<id>.yaml`, fill the texts, `place`, `bridge` (with coordinates and address), `sources` and
`published` (the day of publication, `YYYY-MM-DD`; `updated` only after a substantive change). The schema.org markup (JSON-LD:
Article, Event, place with geo, breadcrumbs, the epoch's story list) is generated from these fields (`src/lib/schema.ts`), nothing is
written by hand. `npm run build` stops (`check:schema`) when an indexable page lacks any part of it.

A new or changed story goes through the language review (`docs/language-review/`): `npm run lang:pending` shows what was not read yet or
changed since it was read (`check:data` warns about the same); read only that, against `docs/glossary.md` (names, titles, places, quotation
marks, "ё"), then mark the texts with `npx tsx scripts/lang-mark.ts <pt|en|ru|all> [unit-prefix]` after the corrections are committed
(it writes `lang_review` into the story file and `docs/language-review/reviewed.json` for the rest). `npm run check:lang` (part of
`npm test`) fails on Brazilian forms in pt, British spellings and typography in en, names outside the glossary and an inconsistent "ё" in ru;
its rules and exceptions are in `scripts/lang-rules.json`.

`npm run check:data` reports problems as `file [field, language]: message`
and prints a summary. Length limits for entries with `placeholder: true` are
warnings only. Test data is latin filler with `placeholder: true`; run
`ALLOW_PLACEHOLDER=false npm run build` to see what still blocks a real launch.

## Publishing to GitHub Pages

1. Push the repository to GitHub (branch `main`).
2. In the repository, open Settings, Pages, and set Source to **GitHub Actions**.
3. Push to `main` (or run the workflow manually). `.github/workflows/deploy.yml`
   builds the site and deploys it.

By default the workflow builds for the domain `https://elefantefugiu.pt` (`SITE_URL`) served from the root (`BASE_PATH` is `/`).
`public/CNAME` carries the domain into the published site. Both are written into the workflow and cannot be overridden by repository
variables; for a test build on another address run `SITE_URL=... BASE_PATH=... npm run build` locally. `check:https` (part of `postbuild`) fails
the build if `dist/` contains an `http://` resource (mixed content).

## Moving to a custom domain

The domain is `elefantefugiu.pt` and is already the workflow default. What is left is on GitHub and at the registrar:

1. DNS at the registrar: for the apex `elefantefugiu.pt` four `A` records (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153) and, if wanted, four `AAAA` records (2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153); for `www` a `CNAME` to `kulikov-dev.github.io`.
2. Repository, Settings, Pages, Custom domain: `elefantefugiu.pt`, Save; when the DNS check passes, tick **Enforce HTTPS**.
3. Run the workflow again (repository variables `SITE_URL` and `BASE_PATH` are ignored).

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
src/styles       tokens (all colours, fonts, sizes), reset, base, layout, azulejo, theme, typography, map (loaded only with the map)
src/assets       azulejo/ (SVG patterns used as masks)
tests            unit tests
scripts          build-time checks and tools; scripts/qa = browser checks (own dependencies)
docs             design.md, spec.md, STATE.md
```

## Licenses

Code: MIT (`LICENSE`). Texts: CC BY-SA 4.0 (`LICENSE-CONTENT.md`).
