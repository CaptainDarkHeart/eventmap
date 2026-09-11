# Eventmap Memory

Project notes not obvious from code. Update as decisions get made.

## State (2026-09-11)

Live at techeventsmap.com (custom domain wired up and cut over 2026-09-11). Map view, table view (search/filter/CSV export), per-event pages, calendar/ICS feeds (site-wide and per-event), about page, contact form, event submission form. ~2200+ lines of event JSON in `src/data/events.json`, single source of truth.

`scripts/validate-events.mjs` (`npm run validate-events`): duplicate id/slug, missing fields, lat/lng range, date validity, tier/topic validity, url format. Run after hand-editing events.json. `scripts/check-urls.mjs` (`npm run check-urls`, manual/periodic) checks every event url still resolves.

Contact form (`/contact`) and event submission form (`/submit`) both post to Worker routes (`/api/contact`, `/api/submit-event`) in `worker/index.js`: honeypot, field validation, Turnstile server-side verification, mail via Cloudflare Email Routing (`EMAIL` binding) to dantaylormedia@gmail.com. Submission form emails only, doesn't touch events.json (manual review). `TURNSTILE_SECRET_KEY` is a Worker secret, not in any repo file.

`assets-src/dan-original.png` is the unprocessed source photo for the about-page headshot (`public/dan.jpg` is the processed/served version), keep both.

Fonts: PT Sans / PT Mono loaded once via Google Fonts, exposed as `--font` / `--mono` CSS vars. Body/nav/UI text uses `--font`; filter tags, dates, meta rows use `--mono` as an established convention. New UI text defaults to `--font` unless it matches that mono pattern.

## Decisions

- Data lives as a static JSON file, no CMS/DB. Simplest thing that works for a hand-curated event list.
- CARTO basemaps over Mapbox/OSM tiles directly: needs `PUBLIC_CARTO_KEY`, key is a public/client-side key (fine to expose, CARTO free tier).
- Theme (light/dark) stored in `localStorage` under `em_theme`, no server-side pref.
- Contact form backend is a hand-rolled Worker route, not a third-party form service (Formspree etc.), keeps it on the same Worker as the static site with no extra vendor.
- Spam protection is Turnstile + honeypot, no CAPTCHA-alternative or rate limiting beyond that yet.
- Deploy target is a Cloudflare Worker (custom `main: worker/index.js`, serves built assets via `ASSETS` binding), not Cloudflare Pages and not the `@astrojs/cloudflare` SSR adapter.

## Resolved (previously open questions)

- Custom domain: techeventsmap.com and www.techeventsmap.com are both attached to the `eventmap` Worker, zone cut over and certs issued 2026-09-11. `astro.config.mjs`'s `site` value updated to match, no longer the `eventmap.dantaylor.net` placeholder.
- Email Routing (`EMAIL` binding) sending address verified on the techeventsmap.com zone: MX/SPF/DKIM present, status `ready`, destination dantaylormedia@gmail.com verified.

## Open questions / not yet decided

- No `.dev.vars` file for local Worker dev, so `TURNSTILE_SECRET_KEY` isn't available to `wrangler dev` locally, only to the deployed Worker. Fine for now since testing happens against the deployed version.
