#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "src", "data", "events.json");
const events = JSON.parse(readFileSync(dataPath, "utf-8"));

const VALID_TIERS = new Set(["mega", "major", "notable"]);
const VALID_TOPICS = new Set([
	"startup-vc", "fintech", "ai", "dev-eng", "general-tech", "crypto", "gaming", "security",
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function distanceKm(a, b) {
	const rad = (d) => (d * Math.PI) / 180;
	const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
	return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const norm = (s) => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const MAX_CITY_SPREAD_KM = 25;
const firstInCity = new Map();

const errors = [];
const seenIds = new Set();
const seenSlugs = new Set();

for (const [i, ev] of events.entries()) {
	const ctx = `event[${i}] (id=${ev.id}, slug=${ev.slug})`;

	if (typeof ev.id !== "number") errors.push(`${ctx}: id must be a number`);
	else if (seenIds.has(ev.id)) errors.push(`${ctx}: duplicate id`);
	else seenIds.add(ev.id);

	if (typeof ev.slug !== "string" || !SLUG_RE.test(ev.slug)) errors.push(`${ctx}: invalid slug format`);
	else if (seenSlugs.has(ev.slug)) errors.push(`${ctx}: duplicate slug`);
	else seenSlugs.add(ev.slug);

	if (/(\d{4})-\1$/.test(String(ev.slug))) errors.push(`${ctx}: slug repeats the year`);

	// Pins for the same city must sit together, catches a geocoder landing on a county or a namesake town.
	if (typeof ev.lat === "number" && typeof ev.lng === "number" && ev.city && ev.country) {
		const key = `${norm(ev.city)}|${norm(ev.country)}`;
		const first = firstInCity.get(key);
		if (!first) firstInCity.set(key, ev);
		else if (distanceKm(first, ev) > MAX_CITY_SPREAD_KM) errors.push(`${ctx}: pin is ${Math.round(distanceKm(first, ev))} km from ${ev.city} event id ${first.id}`);
	}

	if (!ev.name) errors.push(`${ctx}: missing name`);
	if (!ev.city) errors.push(`${ctx}: missing city`);
	if (!ev.country) errors.push(`${ctx}: missing country`);

	if (typeof ev.lat !== "number" || ev.lat < -90 || ev.lat > 90) errors.push(`${ctx}: lat out of range or not a number`);
	if (typeof ev.lng !== "number" || ev.lng < -180 || ev.lng > 180) errors.push(`${ctx}: lng out of range or not a number`);

	if (!DATE_RE.test(ev.start) || Number.isNaN(Date.parse(ev.start))) errors.push(`${ctx}: invalid start date`);
	if (!DATE_RE.test(ev.end) || Number.isNaN(Date.parse(ev.end))) errors.push(`${ctx}: invalid end date`);
	if (DATE_RE.test(ev.start) && DATE_RE.test(ev.end) && ev.start > ev.end) errors.push(`${ctx}: start date after end date`);

	if (!VALID_TIERS.has(ev.tier)) errors.push(`${ctx}: invalid tier "${ev.tier}"`);

	if (!Array.isArray(ev.topics) || ev.topics.length === 0) errors.push(`${ctx}: topics must be a non-empty array`);
	else for (const t of ev.topics) if (!VALID_TOPICS.has(t)) errors.push(`${ctx}: invalid topic "${t}"`);

	if (ev.url && !/^https?:\/\//.test(ev.url)) errors.push(`${ctx}: url must be empty or start with http(s)://`);

	if (ev.organizer !== undefined && (typeof ev.organizer !== "string" || !ev.organizer)) errors.push(`${ctx}: organizer must be a non-empty string`);
	if (ev.performers !== undefined && (!Array.isArray(ev.performers) || ev.performers.length === 0 || ev.performers.some((p) => typeof p !== "string" || !p))) errors.push(`${ctx}: performers must be a non-empty array of strings`);
	if (ev.offer !== undefined) {
		if (typeof ev.offer.price !== "number" || ev.offer.price < 0) errors.push(`${ctx}: offer.price must be a number >= 0`);
		if (ev.offer.price > 0 && !/^[A-Z]{3}$/.test(ev.offer.currency || "")) errors.push(`${ctx}: offer.currency must be a 3-letter code`);
		if (ev.offer.url && !/^https?:\/\//.test(ev.offer.url)) errors.push(`${ctx}: offer.url must start with http(s)://`);
	}
}

if (errors.length) {
	console.error(`✗ ${errors.length} validation error(s) in events.json:\n`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

console.log(`✓ events.json valid (${events.length} events, ${seenSlugs.size} unique slugs)`);
