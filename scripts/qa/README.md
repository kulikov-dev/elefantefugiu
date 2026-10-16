# Browser QA

Browser checks for the built site: layout at 360 px, no-JS and no-images behaviour,
layer state in the address hash, keyboard focus, the Share button, language switch.
They are **not** part of `npm run build` and have their own dependencies
(`puppeteer-core` and a bundled headless Chromium, versions pinned in `package.json`).
Only Chromium is covered. Safari and Firefox are not.

## Run

```sh
npm run build                      # in the repo root, makes dist/
cd scripts/qa
npm ci                             # once
npm run serve &                    # serves dist/ on http://localhost:4400 (base path "/")
npm run behave                     # card page: PASS / FAIL list, exit code 1 on failure
npm run listings                   # epoch and thread pages: PASS / FAIL list, exit code 1 on failure
npm run controls                   # stage 4b: epoch switcher, filter, grid, home, Surprise me
npm run map                        # stage 5: map page, links to it, map on epoch pages (several minutes; sections: node map.mjs nojs tiles limit filters preview layout link epoch weight)
npm run family                     # stage 6: family mode (sections: node family.mjs toggle lists recount nearby gate surprise map flash blocked)
npm run shots                      # screenshots to scripts/qa/out/ (git-ignored)
```

Use another address with `BASE_URL=http://localhost:5000 npm run behave`.
The scripts expect the test data (`evento-exemplo-02`, `-07`, `-19`, the epoch `avis-e-descobrimentos`, the thread `mar`) and the default base path `/`.
If you build with `BASE_PATH`, serve it under that path yourself and set `BASE_URL` accordingly.

## What `behave` checks

1. No JavaScript, images blocked: hook, story and caption visible, `<details>` works, Share stays a plain link, no horizontal overflow at 360 px.
2. Hash and layer: `#detalhes` opens on load, toggling updates the address without new history entries, `#historia` closes the layer.
3. Keyboard: Tab order, visible focus outline on every stop, Enter and Space on the summary.
4. Share: button replaces the link, Web Share used when present, copy with confirmation, cancel is silent, refused copy shows the link.
5. Language switch leads to the same card; the report link carries the card address.

## What `listings` checks

1. Epoch page without JavaScript and images: all 8 feed cards readable, thread chips are links, story layer closed and opens with native `<details>`.
2. In-place expansion: the story opens on the same page, `#c-<id>` appears in the address without new history entries, a link with that hash opens the card on load.
3. Back button: from a card page back to the feed at the same scroll position, with the card still open.
4. Counters and links: a thread chip leads to the thread page at that epoch's section, the counter equals the number of tiles there.
5. Thread page: grid of tiles (no expandable cards), one column at 360 px, epoch chips jump to their sections with matching counts, tiles lead to cards.
6. Neighbouring epochs link both ways; on a card page the epoch crumb and thread chips lead to the real pages.
7. Language switch keeps epoch and thread pages.
8. Keyboard: thread chips come before the feed in tab order, every stop has a visible outline, Enter and Space open and close a card.

## What `controls` checks (stage 4b)

1. Epoch switcher: nine epochs, current marked, two other MVP epochs linked, six "coming soon" without links.
2. Without JavaScript: thread chips are links, filter and view buttons are not shown, address parameters are ignored.
3. Filter and view: `?fio=` and `?vista=grelha` in the address, exactly the matching cards (primary or second thread), counters unchanged, one column at 360 px and several on a wide screen, state survives a reload.
4. Unknown parameters are ignored; empty thread message and "Show all" (the empty case is simulated, the test data has none).
5. Back from a card keeps address, visible cards and scroll position, in timeline and in grid.
6. Keyboard on the controls.
7. Home without JavaScript: hero buttons, three featured cards, nine tiles (three links, six "coming soon"), thread buttons, three steps.
8. Tile counts equal the cards on the epoch pages; Start, tiles and thread buttons lead to the right pages.
9. "Surprise me" in pt and en: eight clicks without an immediate repeat, never the heavy-topic card, last card remembered, works with blocked `localStorage`.
10. Home: language switch, keyboard focus outlines.

## What `map` checks (stage 5)

Tiles are answered with a grey picture; nothing leaves the machine. With another base path serve `dist/` under it and set `BASE_URL`.

1. `nojs`: no JavaScript: the map block and the filters are hidden, the plain list shows all 24 cards by epoch (pt and en), no overflow at 360 px.
2. `tiles`: tiles fail: "Mapa indisponível, aqui está a lista." and the plain list of all cards.
3. `limit`: every thread, every epoch, around 8 cards, zoom out and in (270 views): never more than 7 markers and clusters; the "In this area" list equals what markers and clusters cover; the sampling is not empty; "Show more" 7 -> 12 -> 17 and every card reachable; panning with the keyboard; attribution visible and clickable (desktop, phone with the sheet closed and open).
4. `filters`: `?fio=` and `?epoca=` read, unknown parameters dropped, survive a reload, "all" clears, history does not grow.
5. `preview`: markers are focusable buttons with names, Tab reaches them, Enter opens the preview (focus moves in, `?id=`), Escape closes it and returns focus, a cluster opens.
6. `layout`: phone: list is a bottom sheet (closed at first, aria-expanded); desktop: column to the right; no overflow.
7. `link`: "Open on the map" centres every card (24 of 24, dx and dy within 3 px) and opens its preview; English on a phone; filters that would hide the card are cleared; unknown id ignored; preview -> card -> Back returns to the same address, preview, filters and place on the screen.
8. `epoch`: epoch page: no JS (plain feed); desktop: feed left, map right and sticky; phone: Timeline | Map switch, map code not requested before the Map pane; marker <-> feed record highlight both ways (click, keyboard, scroll); thread filter drives the map (every thread: same cards in feed and map, at most 7); `?fio=` at load; tiles fail: feed gets the width; feed and grid at 900 to 1440 px without overflow.
9. `weight`: home, card, thread and about pages never request map code; on the map page the code waits until the block is near the screen.

## Family mode (`family.mjs`, stage 6)

Run against `dist/` served on port 4400. The sections `variant` needs a second build in which a whole epoch is 16+ and
therefore empty in the modes `all` and `12` (the test data has neither):

```sh
node prepare-variant.mjs                                   # builds /tmp/elefante-variant (real data untouched)
DIST=/tmp/elefante-variant/dist node serve.mjs 4401 &
VARIANT_URL=http://localhost:4401 node family.mjs variant
```

`FAMILY=all node map.mjs limit` (or `FAMILY=12`) runs the map suite in a family mode. The `map` suite is long: run it in
sections. Expected values come from `src/content/*.yaml` with the age rules written out in the script, independent of `src/lib/family.ts`.
