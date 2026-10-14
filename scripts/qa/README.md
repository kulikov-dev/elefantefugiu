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
npm run behave                     # PASS / FAIL list, exit code 1 on failure
npm run shots                      # screenshots to scripts/qa/out/ (git-ignored)
```

Use another address with `BASE_URL=http://localhost:5000 npm run behave`.
The scripts expect the test data (`evento-exemplo-02`, `-07`, `-19`) and the default base path `/`.
If you build with `BASE_PATH`, serve it under that path yourself and set `BASE_URL` accordingly.

## What `behave` checks

1. No JavaScript, images blocked: hook, story and caption visible, `<details>` works, Share stays a plain link, no horizontal overflow at 360 px.
2. Hash and layer: `#detalhes` opens on load, toggling updates the address without new history entries, `#historia` closes the layer.
3. Keyboard: Tab order, visible focus outline on every stop, Enter and Space on the summary.
4. Share: button replaces the link, Web Share used when present, copy with confirmation, cancel is silent, refused copy shows the link.
5. Language switch leads to the same card; the report link carries the card address.
