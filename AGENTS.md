## Project

Eventmap, branded "Tech Events Map" (domain: techeventsmap.com, live, wired up 2026-09-11). Astro static site. Interactive world map (Leaflet + CARTO basemaps) of tech, startup, AI, fintech conferences. Plus a plain table view, an about page, a contact form, and an event submission form.

Data: `src/data/events.json`, single source of truth. Fields: id, slug, name, city, country, lat, lng, start, end, tier (mega/major/notable), topics (array, keys in `src/lib/topics.ts`), source, url, v. Sources listed on `/about` (each with a short tag used in the `source` field): Dealroom (`dealroom`), Techmeme (`techmeme`), dev.events (`devevents`), Sesamers (`sesamers`), Black Unicorn PR (`blackunicorn`), confs.tech (`confstech`), Tech.eu (`techeu`), TechCrunch (`techcrunch`), Ballou PR (`balloupr`), Gallium Ventures (`galliumventures`), Qolaig (`qolaig`), FinTech Weekly (`fintechweekly`), Vestbee (`vestbee`), plus `manual` for individually verified one-offs.

**Workflow for adding events from a new data source:** fetch/scrape the source, cross-check every candidate against existing `events.json` entries by name (not just slug, editions/years vary) to avoid duplicates, filter to future events only, checking each candidate's exact end date against today's actual date (not just "is the year current" — a 2026 event found in September 2026 can easily have already happened), then confirm with the user before writing: (1) whether to introduce a new `source` tag (and matching `/about` row) vs reuse an existing one, and (2) any judgment call the source doesn't give a clean answer for (ambiguous topic mapping, missing exact date, conflicting dates vs. another source already in the data). Don't guess silently on those two things.

**Automated weekly discovery:** a launchd job (e.g. `~/Library/LaunchAgents/com.eventmap.discovery.plist`) runs `scripts/discover-events-cron.sh` every Monday 08:00 local time. It runs `claude -p` headlessly (scoped `--allowedTools`, `--permission-mode acceptEdits`, `--permission-prompts none`, prompt in `scripts/discover-events-prompt.txt`) with real internet access to check existing sources plus hunt for legitimate new ones, verify candidates, and open a PR (never pushes to main; ambiguous calls go in a "Needs manual review" PR section instead of being guessed, same rule as manual additions above). Logs in `logs/` (gitignored). A first attempt used a scheduled cloud routine instead, but the sandbox environment blanket-blocked almost all outbound HTTPS, making verification impossible; local launchd has normal internet access.

**Concurrent discovery-PR gotcha:** each weekly discovery run assigns new `id`s starting from the max `id` it sees in its own branch's `events.json`. If two discovery PRs are open at once (e.g. one from last week not yet merged when this week's run opens a new one), whichever merges second will conflict: same insertion point in the JSON array, and often overlapping `id` numbers reused for different events. Resolve by merging the now-current `main` into the stale branch, keeping `main`'s content as the base, then re-appending the stale branch's *new* events renumbered to start after `main`'s current max `id` (cross-check names against `main` for duplicates the two runs may have both found independently, and re-check every date against today, since more time has passed). Re-run `npm run validate-events` after resolving. This can cascade: merging PR A after PR B changes `main`'s max `id` again, so PR C may now also conflict even if it didn't before.

Validate event data before committing changes to it:

```
npm run validate-events
```

Checks (`scripts/validate-events.mjs`): duplicate id/slug, missing name/city/country, lat/lng range, date format and start<=end, valid tier, non-empty valid topics, url format.

Check that event URLs still resolve (not run automatically, run manually / periodically):

```
npm run check-urls
```

`scripts/check-urls.mjs`: HEAD (falling back to GET on 403/405) every event's `url`, 8 concurrent, 10s timeout, reports broken links.

Past events are removed from `events.json` entirely, not just filtered client-side, this is a current/upcoming listing only:

```
npm run prune-past-events
```

`scripts/prune-past-events.mjs`: drops any event whose `end` date is before today, overwrites `events.json`. Runs automatically as part of `npm run deploy` (before `astro build`), so it doesn't need to be run manually before a deploy. Run it manually if checking for stale entries outside a deploy.

Pages:
- `src/pages/index.astro` (map, client script inlined via `define:vars`)
- `src/pages/events/index.astro` (table view: tier filter, free-text search across name/city/country, "Export CSV" of the currently visible rows, per-row "Add to calendar" link), `src/pages/events/[slug].astro` (static per-event page via `getStaticPaths`)
- `src/pages/events.ics.ts` (single ICS feed of every event, `/events.ics`), `src/pages/events/[slug].ics.ts` (per-event ICS download, static via `getStaticPaths`) — both built from `src/lib/ics.ts` (`buildVEvent`/`buildCalendar`, end date is exclusive per iCal spec so it adds a day internally)
- `src/pages/about.astro` (data sources, builder bio, uses `public/dan.jpg`, original source photo kept in `assets-src/dan-original.png`)
- `src/pages/contact.astro` (contact form, Cloudflare Turnstile widget, honeypot field, posts to `/api/contact`)
- `src/pages/submit.astro` (event submission form, same Turnstile/honeypot pattern, posts to `/api/submit-event`, does not write to `events.json`, just emails the submission for manual review)

Env: `PUBLIC_CARTO_KEY` (CARTO basemap key), set in `.env`, required for map tiles to load. It's a public/client-side key, gets baked into the static HTML at build time, that's expected.

Fonts: `--font` (PT Sans) and `--mono` (PT Mono) CSS custom properties defined once in `Layout.astro` / `index.astro`'s global styles, loaded via a single Google Fonts `<link>`. Body text and nav use `var(--font)`, filter tags/meta/dates use `var(--mono)` (established pattern, keep new UI text on `var(--font)` unless it matches that mono use case). Don't hardcode a font-family anywhere, always reference the token.

## Contact form / Worker

Not a pure static site anymore, `wrangler.jsonc` now points `main` at `worker/index.js`, a custom Worker that:
- serves everything through the `ASSETS` binding (the built `./dist`), except
- `POST /api/contact`, handled in `worker/index.js`: honeypot check, field validation, verifies the Turnstile token server-side against `TURNSTILE_SECRET_KEY`, then sends mail via the `EMAIL` binding (Cloudflare Email Routing, `send_email` in `wrangler.jsonc`) to the destination address (`env.DESTINATION_EMAIL`, default `contact@techeventsmap.com`).
- `POST /api/submit-event`, same shape, sends "Tech Events Map submission" mail from `contact@techeventsmap.com`, reply-to the submitter's optional email. Manual review only, does not touch `events.json`.

`TURNSTILE_SECRET_KEY` and `DESTINATION_EMAIL` are set as Worker secrets (`wrangler secret list` shows secrets), not in `.env`, never commit them. `DESTINATION_EMAIL` is required, not optional: the `send_email` binding will only deliver to an address **verified as an Email Routing destination address** on the account, and `contact@techeventsmap.com` is a routing rule source, not a verified destination, so it is not a usable value. With the secret unset both form endpoints return a 500 and log `DESTINATION_EMAIL is not configured`. Use a secret rather than a plain var: `wrangler deploy` wipes plain vars that aren't declared in `wrangler.jsonc`, secrets survive.

The send payload uses the Email Sending Workers API shape (`env.EMAIL.send({ from, to, replyTo, subject, text, html })`). The reply-to field is `replyTo`, camelCase, not `reply_to`. The Turnstile site key is public and lives inline in `contact.astro` / `submit.astro`.

Email Routing (`EMAIL` binding, `send_email`) is live and verified on the `techeventsmap.com` zone: MX/SPF/DKIM records present, Email Routing status `ready`, destination email verified. Confirmed 2026-09-11.

## Deploy

Cloudflare Worker (not Pages, not the `@astrojs/cloudflare` SSR adapter). Deployed under name `eventmap` (account resolved via `CLOUDFLARE_ACCOUNT_ID` or Wrangler auth).

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
