import events from "../data/events.json";
import { regionsFor } from "../lib/regions.js";

// Real dataset numbers for the secret Pip-Boy boot screen (public/pipboy.js fetches this on demand).
// Static at build time, so it always matches the shipped events.json.
export function GET() {
	const pct = (n: number) => Math.round((n / events.length) * 100);
	const today = new Date().toISOString().slice(0, 10);
	const horizon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
	const body = {
		events: events.length,
		countries: new Set(events.map((e) => e.country)).size,
		cities: new Set(events.map((e) => `${e.city}|${e.country}`)).size,
		soon: events.filter((e) => e.start >= today && e.start <= horizon).length,
		majorPct: pct(events.filter((e) => e.tier === "mega" || e.tier === "major").length),
		europePct: pct(events.filter((e) => regionsFor(e.country).includes("europe")).length),
	};
	return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}
