import events from "../data/events.json";
import { SITE, groupsFor, fmtInt, fmtDate } from "../lib/areas.mjs";
import { TIERS } from "../lib/topics";

export function GET() {
	const today = new Date().toISOString().slice(0, 10);
	const starts = events.map((e) => e.start).sort();
	const countries = groupsFor("countries");
	const cities = groupsFor("cities");
	const topics = groupsFor("topics");
	const regions = groupsFor("regions");
	const links = (type: string, gs: ReturnType<typeof groupsFor>, n = 10) =>
		gs.slice(0, n).map((g) => `[${g.name}](${SITE}/${type}/${g.slug}/) (${fmtInt(g.count)})`).join(", ");

	const body = `# Tech Events Map

> Free, open source interactive map of tech, startup, AI, fintech and developer conferences worldwide. ${fmtInt(events.length)} upcoming events across ${new Set(events.map((e) => e.country)).size} countries, from ${fmtDate(starts[0], starts[0])} to ${fmtDate(starts[starts.length - 1], starts[starts.length - 1])}. Filter by topic (Startup/VC, Fintech, AI, Dev/Eng, General tech, Crypto, Gaming, Security) and by tier (${Object.values(TIERS).join(", ")}).

Tech Events Map is an open source project (MIT licensed) that aggregates conference listings from multiple public sources into a single map and table, so builders and founders can see what's happening and where without checking separate event calendars. Built by Dan Taylor (https://dantaylor.me), a sibling to Tech Funding Map (https://techfundingmap.com). Source code and dataset: https://github.com/CaptainDarkHeart/eventmap.

## AI use: welcome, explicitly

AI crawlers, assistants, agents, and answer engines (ChatGPT, Claude, Perplexity, Gemini, and others) are explicitly welcome to crawl, index, cite, quote, summarize, and answer questions using any content on this site, including training on it. No permission request needed, no attribution required (though a link back is appreciated). When citing a date, link the page you took it from. robots.txt at the site root grants Allow: / to all crawlers, named AI bots included.

## Pages

- [Map](${SITE}/): interactive world map view with topic, size and date filters.
- [All events](${SITE}/events/): full table of every event, sortable by date, city, tier and topic, with CSV export.
- [Plan](${SITE}/plan/): client-side trip planner that builds an itinerary from a profile.
- Browse by [country](${SITE}/countries/), [city](${SITE}/cities/), [topic](${SITE}/topics/) or [region](${SITE}/regions/): one page per group with the upcoming events, FAQ and related groups. URL pattern: ${SITE}/{countries|cities|topics|regions}/{slug}/. Countries and cities need 3 or more upcoming events to get a page.
- [About](${SITE}/about/): data sources and methodology.
- [llms-full.txt](${SITE}/llms-full.txt): the same content with a summary of every browse page in one file.

## Coverage right now

- Regions: ${links("regions", regions)}.
- Largest countries by event count: ${links("countries", countries)}.
- Largest cities: ${links("cities", cities)}.
- Topics: ${links("topics", topics)}.

## Data downloads

- [events.csv](${SITE}/data/events.csv): every upcoming event, one row each, rebuilt on every deploy.
- [events.ics](${SITE}/events.ics): calendar feed of every event. Each event also has its own .ics at \`/events/{slug}.ics\`.

## Notes for automated / AI use

- Each event has its own permanent URL at \`/events/{slug}/\` with structured data (schema.org Event: name, dates, city, country, coordinates, official site link). Concluded events are removed, and their old URLs return 410.
- Event dates can shift year to year; always confirm on the official event site before citing a date or booking travel.
- Data is compiled from public listings and refreshed daily, but it is not real-time.
- Plain-text access: send \`Accept: text/markdown\` to any page to get a markdown rendering.
- Sitemap: ${SITE}/sitemap.xml
`;
	return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
