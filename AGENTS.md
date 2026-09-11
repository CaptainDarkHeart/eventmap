## Project

Eventmap. Astro static site. Interactive world map (Leaflet + CARTO basemaps) of tech, startup, AI, fintech conferences. Plus a plain table view at `/events`.

Data: `src/data/events.json`, single source of truth. Fields: id, slug, name, city, country, lat, lng, start, end, tier (mega/major/notable), topics (array, keys in `src/lib/topics.ts`), source, url, v. `public/events.json` is a stale duplicate, not imported by code, safe to delete or keep in sync manually.

Pages: `src/pages/index.astro` (map, client script inlined via `define:vars`), `src/pages/events/index.astro` (table), `src/pages/events/[slug].astro` (static per-event page via `getStaticPaths`).

Env: `PUBLIC_CARTO_KEY` (CARTO basemap key), set in `.env`, required for map tiles to load.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
