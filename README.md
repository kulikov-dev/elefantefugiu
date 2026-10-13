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

## Build and check

```sh
npm run build      # i18n key check, data check, Astro build, internal link check
npm run preview    # serve dist/ locally
npm run check      # astro check (types)
npm run check:data # validate src/content/*.yaml and print a data summary
```

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
epochs.yaml  threads.yaml  featured.yaml  ui.yaml
```

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
src/pages        routes: / (language chooser), /[lang]/[...page] (stubs), 404
src/layouts      BaseLayout (head, header, footer)
src/components   Logo, SiteHeader, SiteFooter, LanguageSwitch
src/content      YAML content: events/, epochs, threads, featured, ui
src/data         Zod schemas
src/i18n         pt.json, en.json, route map, t() helper
src/styles       tokens, reset, base, layout
scripts          build-time checks (i18n keys, data, internal links)
docs             design.md, spec.md, STATE.md
```

## Licenses

Code: MIT (`LICENSE`). Texts: CC BY-SA 4.0 (`LICENSE-CONTENT.md`).
