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
