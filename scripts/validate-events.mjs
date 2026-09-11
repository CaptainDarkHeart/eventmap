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
}

if (errors.length) {
	console.error(`✗ ${errors.length} validation error(s) in events.json:\n`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

console.log(`✓ events.json valid (${events.length} events, ${seenSlugs.size} unique slugs)`);
