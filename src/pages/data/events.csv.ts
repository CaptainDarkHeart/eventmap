import events from "../../data/events.json";
import { TOPICS, TIERS } from "../../lib/topics";

const esc = (v: unknown) => {
	const s = v == null ? "" : String(v);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function GET() {
	const head = ["name", "start", "end", "city", "country", "lat", "lng", "tier", "topics", "url", "page"];
	const rows = [...events]
		.sort((a, b) => a.start.localeCompare(b.start))
		.map((e) =>
			[e.name, e.start, e.end, e.city, e.country, e.lat, e.lng, TIERS[e.tier], e.topics.map((t) => TOPICS[t]?.label ?? t).join("; "), e.url ?? "", `https://techeventsmap.com/events/${e.slug}/`].map(esc).join(","),
		);
	return new Response([head.join(","), ...rows].join("\n") + "\n", { headers: { "content-type": "text/csv; charset=utf-8" } });
}
