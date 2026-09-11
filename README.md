# Eventmap

Interactive world map of tech, startup, AI and fintech conferences. Astro static site, Leaflet map with CARTO basemaps, plus a plain table view.

Live at: https://eventmap.dantaylor.net

## Features

- Map view (`/`) with topic/size/date filters and search
- Table view (`/events`) of all events, sortable by date
- Per-event pages (`/events/[slug]`) with dates, location, topics, official site link
- Light/dark theme toggle, preference saved locally

## Project structure

```text
/
├── public/
│   └── favicon.svg, favicon.ico
├── src/
│   ├── components/
│   │   └── SiteHeader.astro
│   ├── data/
│   │   └── events.json       # source of truth for all event data
│   ├── layouts/
│   │   └── Layout.astro
│   ├── lib/
│   │   └── topics.ts         # topic labels/colors, tier labels
│   └── pages/
│       ├── index.astro       # map view
│       └── events/
│           ├── index.astro   # table view
│           └── [slug].astro  # per-event page
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

## Setup

Requires a CARTO basemaps API key for map tiles.

```sh
cp .env.example .env
# then set PUBLIC_CARTO_KEY in .env
```

## Adding events

Edit `src/data/events.json`. Each entry needs: `id`, `slug`, `name`, `city`, `country`, `lat`, `lng`, `start`, `end`, `tier` (`mega` / `major` / `notable`), `topics` (array of keys from `src/lib/topics.ts`), `source`, `url`.
