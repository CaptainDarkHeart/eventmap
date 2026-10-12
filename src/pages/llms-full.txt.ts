import events from "../data/events.json";
import { SITE, groupsFor, fmtInt, fmtDate, list } from "../lib/areas.mjs";

const TYPES = ["regions", "countries", "cities", "topics"] as const;
const HEAD: Record<string, string> = { regions: "Regions", countries: "Countries", cities: "Cities", topics: "Topics" };

export function GET() {
	const out: string[] = [];
	out.push(`# Tech Events Map: full summary`);
	out.push(`\n> ${fmtInt(events.length)} upcoming tech, startup, AI and fintech events. Summary of every browse page on ${SITE}. Short version: ${SITE}/llms.txt. Always confirm dates on the official event site before citing them.\n`);
	for (const type of TYPES) {
		out.push(`\n## ${HEAD[type]}\n`);
		for (const g of groupsFor(type)) {
			const bits = [`${fmtInt(g.count)} upcoming events`];
			if (type !== "countries" && type !== "cities" && g.countries.length) bits.push(`top countries: ${g.countries.slice(0, 3).map(([n, c]) => `${n} (${c})`).join(", ")}`);
			if (type !== "cities" && g.cities.length) bits.push(`top cities: ${g.cities.slice(0, 3).map(([n, c]) => `${n} (${c})`).join(", ")}`);
			if (type !== "topics" && g.topics.length) bits.push(`top topics: ${g.topics.slice(0, 3).map(([n, c]) => `${n} (${c})`).join(", ")}`);
			bits.push(`next: ${list(g.events.slice(0, 3).map((e) => `${e.name} (${fmtDate(e.start, e.end)})`))}`);
			bits.push(`biggest: ${g.biggest.name} (${fmtDate(g.biggest.start, g.biggest.end)})`);
			out.push(`- [${g.name}${g.cityCountry ? `, ${g.cityCountry}` : ""}](${SITE}/${type}/${g.slug}/): ${bits.join("; ")}.`);
		}
	}
	return new Response(out.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
