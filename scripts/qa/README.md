# Browser QA

Browser checks for the built site: layout on phones, no-JS and no-images behaviour, layer state in the address, keyboard focus, family mode,
the map, themes, the three languages. They are **not** part of `npm run build` and have their own dependencies (`puppeteer-core`,
versions pinned in `package.json`). Only Chromium is covered; Safari and Firefox are not.

## Run

```sh
npm run build              # in the repo root: makes dist/
npm run qa                 # every suite, one table at the end (about 25 minutes)
npm run qa -- --list       # the suites and what they cover
npm run qa -- behave map-tools     # only these suites
npm run qa -- --resume     # go on with the last run: suites that already have a result are skipped
npm run qa -- --verbose    # the whole log of every suite and the full table (by default: one line per suite, the failed checks of a failing suite, one summary line)
npm run qa -- --report     # the table of the last run, nothing is run
```

`npm run qa` installs `scripts/qa/node_modules` the first time, starts a static server for `dist/` (port 4400), builds the fixture site (see below) and
serves it (port 4401) when a suite needs it, and stops both at the end. Logs and results are in `scripts/qa/out/` (git-ignored). The exit code is 1
when any suite fails. A build with a base path: `BASE_PATH=/elefante npm run qa` (build with the same `BASE_PATH` first).

The browser: on Windows and macOS the installed Chrome or Edge is used (`CHROME_PATH=...` chooses another one); on Linux the bundled
`@sparticuz/chromium`. One suite alone: start `node serve.mjs` in `scripts/qa/` and run `node behave.mjs`.

## Where the cards come from

No suite names a card, an epoch, a thread or a number of stories that will change. `data.mjs` reads `src/content` (the files the build reads) and gives each
suite what it needs: `published` (cards with `status: ready`, exactly the cards of the real site), the ready epochs, the cards of an epoch, the threads
of an epoch, the interface strings, what is overseas. Where a suite needs a card of some kind (a heavy topic, a 12+ card, an interactive) it picks one
from the data, and fails with a clear message when the real content has none.

## The fixture build

The real content has no 16+ card, no epoch longer than 8 cards, no card with the ship interactive, no card that is not translated into Russian, no
epoch that a family mode leaves empty, and fewer cards than the marker limit of the map (30), so no clusters and no "Show more" button. For these
checks `prepare-variant.mjs` builds a **separate copy** of the site, outside the repository (`<tmp>/elefante-variant`, or `QA_VARIANT_DIR`), with
the fixtures of `variant-plan.mjs`:

- the eight draft stand-ins `evento-exemplo-17…24` (`status: draft` in the repository: they are not on the real site) are published in the copy;
- five of them move into the first epoch (it then has 10 cards: the Timeline / Grid switch appears, there is a heavy-topic card);
- three stay in Estado Novo, all of them 16+ (the age screen for 16+, an epoch that every mode leaves empty, the epoch palette and the "no elephant" rule);
- one of them carries a ship scale ("Size of the nau");
- the marker limit of the map is 7 in the copy (a patched copy of `src/lib/markers.ts`), so clusters and "Show more" exist.

The suites with `-variant` in the name run against it. The fixtures reach the real `dist/` never: the copy is built elsewhere, the real content marks them
`draft`, and `npm run build` ends with `scripts/check-published.mjs`, which fails if a page, a map point, a sitemap line, an id, a slug, a title or the
words `evento-exemplo` of a card that is not published appears anywhere in `dist/` (`tests/published.test.ts` tries it on stand-in builds).

## The suites

| suite | what it checks |
| --- | --- |
| `behave` | a plain card page: no JS and no images, the layer in the address, keyboard, Share, the language switch, the report link |
| `listings` | the epoch page and the thread page: feed, opening a card in place, Back, counters, neighbours, keyboard |
| `controls` / `controls-variant` | epoch filters and the view switch (the Timeline / Grid switch exists from 9 stories: the variant has it), the home page, "Surprise me" |
| `map-basic` | the map page without JS, with tiles failing, filters, preview, layout |
| `map-more` | links to the map, the map on the epoch page (side by side, phone panes, tiles failing), weight |
| `map-limit`, `map-limit-all`, `map-limit-12` | a sweep of views never draws more than the marker limit, in each family mode |
| `map-variant` | with the limit of 7: clusters, "Show more", filters, preview, links, the epoch map |
| `map-tools` / `map-tools-variant` | the tools under the zoom (Near me, All of Portugal, Whole world), the overseas plate, the legend and marker styles, the epoch scale |
| `bridge` | the marker preview, the caption, "Como chegar" (OpenStreetMap, `geo:` on Android only), the bridge block on the card |
| `family-controls`, `family-pages`, `family-map` | family mode: the radio group, lists, counters, recounting without reload, Nearby, the age screen, no flash, blocked storage, the map |
| `family-controls-variant`, `family-variant` | the same on the fixture build, and the 16+ epoch that every mode leaves empty |
| `family-menu` | the "With kids" button, the menu and its explanations, the hidden-stories line, the tooltip |
| `epoch-page` | years on the scale, equal compact cards, the view switch, the active card, the list of later epochs |
| `interactives` / `interactives-variant` | the dots of Aljubarrota (and, in the variant, the ship scale): keyboard, text alternative, colour, motion, no JS, code only where used, family modes |
| `theme` / `theme-variant` | theme and its storage, palettes of the epochs (Estado Novo in the variant), fonts, header on phones, the `light-dark()` fallback |
| `azulejo` / `azulejo-variant` | the patterns in both themes, the waiting tile of the map, reduced motion, layout shifts, the neutral header |
| `ru` / `ru-variant` | the language menu, the root choice, Cyrillic fonts only where Cyrillic is drawn, plural forms; the banner for a card that is not translated (variant) |
| `pages` | the static pages, the report form (answered by the test, nothing leaves the machine), "Continue", the QR address |
| `service` | the service pages, the form from a story, the thank-you screen, 404 in every language |
| `mascot` / `mascot-variant` | the elephant: logo, 404, walking by the pager, empty states, none on heavy cards and the regime epoch |

`shots.mjs` (screenshots) and `preload-time.mjs` are tools, not suites.

## Adding a suite

Write `<name>.mjs` that prints `PASS  ...` / `FAIL  ...` lines (and exits 1 on a failure), take the cards from `data.mjs`, start the browser with
`launchBrowser()` from `browser.mjs`, and add a line to `SUITES` in `run.mjs`. If it needs cards the real site does not have, give it a `variant`
argument (`variant: true` in `SUITES`) and extend `variant-plan.mjs` instead of editing the content.
