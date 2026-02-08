# AGENTS.md

## Project purpose

Static-first US Constitution reader for `usconstitution.app`, hosted on Cloudflare Pages.

## Core constraints

- Keep dependencies minimal.
- Preserve no-JS readability and navigation.
- Use progressive enhancement for search/filter.
- Keep `constitution.json` as canonical source data.

## Source of truth and generation

- Canonical data: `/Users/johnwheeler/git/us-constitution/constitution.json`
- Generator script: `/Users/johnwheeler/git/us-constitution/scripts/build-content.mjs`
- Generated files:
  - `/Users/johnwheeler/git/us-constitution/src/generated/constitution-prerender.html`
  - `/Users/johnwheeler/git/us-constitution/src/generated/search-index.json`
- `src/index.html` contains marker blocks and is updated by `npm run build:data`.

## Commands

- `nvm use`
- `npm install`
- `npm run build:data`
- `npm run dev`
- `npm run build`

## UI and UX requirements

- Sidebar contains search/filter controls and contents navigation.
- Main column prioritizes uninterrupted constitutional text.
- Keep controls single-column and keyboard accessible.
- Anchor links must remain reliable in both JS and no-JS paths.

## Style guidance

- Use U.S.-flag-informed colors:
  - Blue: `#002868`
  - Red: `#BF0A30`
  - White: `#FFFFFF`
- Use typography that aligns with U.S. civic/government styling:
  - UI/sans: `Public Sans`
  - Reading/serif: `Merriweather`
- Prioritize legibility and scannability over decorative effects.

## Deployment

- Build output: `dist`
- Cloudflare Pages config file: `/Users/johnwheeler/git/us-constitution/wrangler.jsonc`
- Preferred flow: Git-connected auto-deploy with preview branches.
