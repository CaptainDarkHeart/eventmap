# Eventmap

An open source interactive world map of tech, startup, AI and fintech conferences. Astro static site, Leaflet map with CARTO basemaps, plus a plain table view.

- **Website**: https://techeventsmap.com
- **Source Code & Data**: https://github.com/CaptainDarkHeart/eventmap
- **License**: MIT

## Features

- Map view (`/`) with topic/size/date filters and search
- Table view (`/events`), sortable by date, free-text search, tier filter, CSV export of visible rows
- Per-event pages (`/events/[slug]`) with dates, location, topics, official site link
- Calendar (ICS) feeds: `/events.ics` for everything, `/events/[slug].ics` per event, plus an "Add to calendar" link per row on the table view
- Light/dark theme toggle, preference saved locally
- Contact form (`/contact`) and event submission form (`/submit`), both Turnstile + honeypot protected, handled by a Cloudflare Worker (submissions are emailed for manual review, not written to `events.json`)
- Custom 404 page

## Project structure

```text
/
├── public/
│   └── favicon.svg, favicon.ico
├── scripts/
│   ├── validate-events.mjs         # data integrity checks for events.json
│   ├── check-urls.mjs              # checks every event's url still resolves
│   ├── prune-past-events.mjs       # removes events whose end date has passed
│   ├── discover-events-prompt.txt  # prompt for the weekly discovery agent
│   └── discover-events-cron.sh     # headless `claude -p` wrapper, run by launchd
├── src/
│   ├── components/
│   │   └── SiteHeader.astro
│   ├── data/
│   │   └── events.json       # source of truth for all event data
│   ├── layouts/
│   │   └── Layout.astro
│   ├── lib/
│   │   ├── topics.ts         # topic labels/colors, tier labels
│   │   └── ics.ts            # builds iCalendar (.ics) output
│   └── pages/
│       ├── index.astro       # map view
│       ├── about.astro, contact.astro, submit.astro
│       ├── 404.astro
│       ├── events.ics.ts     # all-events calendar feed
│       └── events/
│           ├── index.astro   # table view (search, filter, CSV export)
│           ├── [slug].astro  # per-event page
│           └── [slug].ics.ts # per-event calendar download
├── worker/
│   └── index.js              # Cloudflare Worker: serves assets + /api/contact, /api/submit-event
└── package.json
```

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview the build locally |
| `npm run check` | Run Astro type checking |
| `npm run validate-events` | Validate `events.json` before committing changes to it |
| `npm run check-urls` | Check every event's `url` still resolves |
| `npm run deploy` | Build and deploy the Cloudflare Worker |

## Setup

Requires a CARTO basemaps API key for map tiles.

```sh
cp .env.example .env
# then set PUBLIC_CARTO_KEY in .env
```

## Adding events

Edit `src/data/events.json`. Each entry needs: `id`, `slug`, `name`, `city`, `country`, `lat`, `lng`, `start`, `end`, `tier` (`mega` / `major` / `notable`), `topics` (array of keys from `src/lib/topics.ts`), `source`, `url`. Run `npm run validate-events` before committing. Sources are listed with attribution on `/about`; adding events from a new source means adding its row there too.

## Automated event discovery

A launchd job (e.g. `~/Library/LaunchAgents/com.eventmap.discovery.plist`, not checked into this repo) runs `scripts/discover-events-cron.sh` every Monday at 08:00 local time. It invokes `claude -p` headlessly, with real internet access, to:

- check every existing source (see `/about`) plus search for legitimate new ones, for new future events
- verify each candidate (url resolves, not a duplicate by name, future-dated) before adding it
- add a new source's `/about` row + tag if one qualifies
- open a PR with the additions (never pushes to main); anything ambiguous goes in a "Needs manual review" section instead of being guessed

Logs land in `logs/` (gitignored). Run it manually with `launchctl kickstart -k gui/$(id -u)/com.eventmap.discovery`, or run `scripts/discover-events-cron.sh` directly.

A first attempt ran this as a scheduled cloud routine (Anthropic's remote-trigger API), but the sandbox environment's egress policy blanket-blocked almost all outbound HTTPS, making source verification impossible. The launchd approach uses this machine's normal internet access instead.

## Contributing

Tech Events Map is open source! Contributions are welcome:

- **Add or update an event**: Edit `src/data/events.json` directly and submit a pull request, or use the [event submission form](https://techeventsmap.com/submit). Make sure to run `npm run validate-events` before committing.
- **Fix bugs or suggest improvements**: Open an issue or submit a PR on [GitHub](https://github.com/CaptainDarkHeart/eventmap).

## License

This project is licensed under the [MIT License](LICENSE).

