# Eventmap Memory

Project notes not obvious from code. Update as decisions get made.

## State (2026-09-11)

Working prototype. Map view + table view + per-event pages. ~2200 lines of event JSON in `src/data/events.json` (multiple events, mix of tiers/topics). `public/events.json` is a leftover duplicate from an earlier fetch-based approach, code no longer reads it, not deleted yet.

## Decisions

- Data lives as a static JSON file, no CMS/DB. Simplest thing that works for a hand-curated event list.
- CARTO basemaps over Mapbox/OSM tiles directly: needs `PUBLIC_CARTO_KEY`, key is a public/client-side key (fine to expose, CARTO free tier).
- Theme (light/dark) stored in `localStorage` under `em_theme`, no server-side pref.

## Open questions / not yet decided

- No process yet for adding/updating events (manual JSON edit only). No validation script for lat/lng, duplicate slugs, or stale dates.
- `public/events.json` vs `src/data/events.json` duplication not resolved, pick one and delete the other.
- No deploy target confirmed yet (`astro.config.mjs` site is `eventmap.dantaylor.net`, implies Cloudflare Pages or similar per other Dan Taylor projects, not yet wired up).
