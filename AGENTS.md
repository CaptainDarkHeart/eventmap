## Project

Eventmap, branded "Tech Events Map" (domain: techeventsmap.com, live, wired up 2026-09-11). Astro static site. Interactive world map (Leaflet + CARTO basemaps) of tech, startup, AI, fintech conferences. Plus a plain table view, an about page, a contact form, and an event submission form.

Data: `src/data/events.json`, single source of truth. Fields: id, slug, name, city, country, lat, lng, start, end, tier (mega/major/notable), topics (array, keys in `src/lib/topics.ts`), source, url, v. Sources listed on `/about`: Dealroom, Techmeme, dev.events, Sesamers, Black Unicorn PR.

Validate event data before committing changes to it:

```
npm run validate-events
```

Checks (`scripts/validate-events.mjs`): duplicate id/slug, missing name/city/country, lat/lng range, date format and start<=end, valid tier, non-empty valid topics, url format.

Pages:
- `src/pages/index.astro` (map, client script inlined via `define:vars`)
- `src/pages/events/index.astro` (table), `src/pages/events/[slug].astro` (static per-event page via `getStaticPaths`)
- `src/pages/about.astro` (data sources, builder bio, uses `public/dan.jpg`, original source photo kept in `assets-src/dan-original.png`)
- `src/pages/contact.astro` (contact form, Cloudflare Turnstile widget, honeypot field, posts to `/api/contact`)
- `src/pages/submit.astro` (event submission form, same Turnstile/honeypot pattern, posts to `/api/submit-event`, does not write to `events.json`, just emails the submission for manual review)

Env: `PUBLIC_CARTO_KEY` (CARTO basemap key), set in `.env`, required for map tiles to load. It's a public/client-side key, gets baked into the static HTML at build time, that's expected.

## Contact form / Worker

Not a pure static site anymore, `wrangler.jsonc` now points `main` at `worker/index.js`, a custom Worker that:
- serves everything through the `ASSETS` binding (the built `./dist`), except
- `POST /api/contact`, handled in `worker/index.js`: honeypot check, field validation, verifies the Turnstile token server-side against `TURNSTILE_SECRET_KEY`, then sends mail via the `EMAIL` binding (Cloudflare Email Routing, `send_email` in `wrangler.jsonc`) to dantaylormedia@gmail.com.
- `POST /api/submit-event`, same shape, sends "Tech Events Map submission" mail from `contact@techeventsmap.com`, reply-to the submitter's optional email. Manual review only, does not touch `events.json`.

`TURNSTILE_SECRET_KEY` is set as a Worker secret (`wrangler secret list` shows it), not in `.env`, never commit it. The Turnstile site key is public and lives inline in `contact.astro` / `submit.astro`.

Email Routing (`EMAIL` binding, `send_email`) is live and verified on the `techeventsmap.com` zone: MX/SPF/DKIM records present, Email Routing status `ready`, destination `dantaylormedia@gmail.com` verified. Confirmed 2026-09-11.

## Deploy

Cloudflare Worker (not Pages, not the `@astrojs/cloudflare` SSR adapter). Deployed under account `cd625a8a773318340cd24e10532aa135` (dantaylormedia@gmail.com), name `eventmap`.

```
npm run deploy   # astro build && wrangler deploy
```

Custom domains `techeventsmap.com` and `www.techeventsmap.com` are attached to the `eventmap` Worker (zone added and nameservers cut over 2026-09-11, both hostnames enabled with certs issued). Not `eventmap.dantaylor.net` from the old `astro.config.mjs` site value, that was a placeholder.

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
