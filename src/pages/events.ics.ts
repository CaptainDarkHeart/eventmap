import type { APIRoute } from "astro";
import events from "../data/events.json";
import { buildCalendar } from "../lib/ics";

export const GET: APIRoute = () => {
	const body = buildCalendar(
		events.map((ev) => ({
			uid: String(ev.id),
			name: ev.name,
			start: ev.start,
			end: ev.end,
			city: ev.city,
			country: ev.country,
			url: ev.url,
			slug: ev.slug,
		}))
	);
	return new Response(body, {
		headers: {
			"Content-Type": "text/calendar; charset=utf-8",
			"Content-Disposition": 'inline; filename="tech-events-map.ics"',
		},
	});
};
