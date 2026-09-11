import type { APIRoute } from "astro";
import events from "../../data/events.json";
import { buildCalendar } from "../../lib/ics";

export function getStaticPaths() {
	return events.map((ev) => ({ params: { slug: ev.slug }, props: { ev } }));
}

export const GET: APIRoute = ({ props }) => {
	const ev = props.ev as (typeof events)[number];
	const body = buildCalendar(
		[
			{
				uid: String(ev.id),
				name: ev.name,
				start: ev.start,
				end: ev.end,
				city: ev.city,
				country: ev.country,
				url: ev.url,
				slug: ev.slug,
			},
		],
		ev.name
	);
	return new Response(body, {
		headers: {
			"Content-Type": "text/calendar; charset=utf-8",
			"Content-Disposition": `attachment; filename="${ev.slug}.ics"`,
		},
	});
};
