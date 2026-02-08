# usconstitution.app

Static-first US Constitution reader built with vanilla HTML/CSS/JS and Vite, designed for Cloudflare Pages.

## Features

- Full no-JS readable document with anchor navigation
- Client-side progressive enhancement for:
  - search (`text`, `id`, `searchTags`, labels)
  - filters (`part`, `article`, `amendment`, `status`)
- Shareable filter state via URL params:
  - `q`, `part`, `article`, `amendment`, `status`

## Requirements

- Node `>=22.12.0`
- `nvm` recommended (`.nvmrc` is included)

## Local development

```bash
nvm use
npm install
npm run dev
```

## Production build

```bash
nvm use
npm run build
```

Outputs to `dist/` (configured in `wrangler.jsonc` for Cloudflare Pages).

## Data pipeline

`npm run build:data` runs `scripts/build-content.mjs` which:

1. Reads `constitution.json`
2. Normalizes entries
3. Generates:
   - `src/generated/constitution-prerender.html`
   - `src/generated/search-index.json`
4. Injects generated TOC/content into `src/index.html`

## Cloudflare Pages (Git auto-deploy)

1. Push this project to GitHub/GitLab.
2. In Cloudflare Dashboard: Workers & Pages -> Create -> Pages -> Connect to Git.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy.
6. Add custom domain `usconstitution.app` in Pages project settings.

## Files

- `constitution.json`: canonical constitutional text data
- `src/index.html`: main static page shell + generated content markers
- `src/app.js`: progressive enhancement logic
- `src/styles.css`: responsive UI styles
- `public/_headers`: security and caching headers
- `wrangler.jsonc`: Cloudflare Pages output configuration
