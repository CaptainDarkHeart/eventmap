# Eventmap Memory

Project notes not obvious from code. Update as decisions get made.

## State (2026-09-11)

Grew from a bare map prototype into a small marketing site: map view, table view, per-event pages, an about page (data sources + builder bio), and a working contact form. Branded "Tech Events Map", intended domain techeventsmap.com. ~2200 lines of event JSON in `src/data/events.json`. `public/events.json` duplicate has been deleted, `src/data/events.json` is the only copy now.

`scripts/validate-events.mjs` added (`npm run validate-events`), checks duplicate id/slug, missing fields, lat/lng range, date validity, tier/topic validity, url format. Run it after hand-editing events.json.

Contact form (`/contact`) posts to `/api/contact`, handled by a new custom Worker script at `worker/index.js`: honeypot, field validation, Cloudflare Turnstile server-side verification, then sends mail through Cloudflare Email Routing (`EMAIL` binding) to dantaylormedia@gmail.com. `TURNSTILE_SECRET_KEY` is a Worker secret, already set remotely, not in any repo file.

`assets-src/dan-original.png` is the unprocessed source photo for the about-page headshot (`public/dan.jpg` is the processed/served version), keep both, don't delete the source.

## Decisions

- Data lives as a static JSON file, no CMS/DB. Simplest thing that works for a hand-curated event list.
- CARTO basemaps over Mapbox/OSM tiles directly: needs `PUBLIC_CARTO_KEY`, key is a public/client-side key (fine to expose, CARTO free tier).
- Theme (light/dark) stored in `localStorage` under `em_theme`, no server-side pref.
- Contact form backend is a hand-rolled Worker route, not a third-party form service (Formspree etc.), keeps it on the same Worker as the static site with no extra vendor.
- Spam protection is Turnstile + honeypot, no CAPTCHA-alternative or rate limiting beyond that yet.

## Open questions / not yet decided

- Custom domain not wired up. Dan said (2026-09-11) `eventmap.dantaylor.net` in `astro.config.mjs` has nothing to do with this project, techeventsmap.com is the real intended domain (used already in `/about` and the contact page's `hello@techeventsmap.com`), but `astro.config.mjs`'s `site` value hasn't been updated to match, still says `eventmap.dantaylor.net`. Worth fixing before this goes live for real, sitemap URLs will be wrong otherwise.
- Cloudflare Email Routing (`EMAIL` binding) needs its sending address verified in the dashboard for whatever zone ends up hosting this Worker. Not confirmed done, no custom domain attached yet to check against.
- No `.dev.vars` file for local Worker dev, so `TURNSTILE_SECRET_KEY` isn't available to `wrangler dev` locally, only to the deployed Worker. Fine for now since testing happens against the deployed version.

## Deploy (2026-09-11)

Wired to Cloudflare as a Worker. Started as static-assets-only mode, then became a custom Worker (`main: worker/index.js`) once the contact form needed server-side logic (Turnstile verification, email sending), still serves the built site itself through the `ASSETS` binding. Account is Dan's main one (dantaylormedia@gmail.com), picked explicitly since `wrangler whoami` showed two accounts and non-interactive deploy needs `account_id` pinned in `wrangler.jsonc`.
