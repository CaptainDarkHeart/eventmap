#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "src", "data", "events.json");
const events = JSON.parse(readFileSync(dataPath, "utf-8"));

const today = new Date().toISOString().slice(0, 10);
const kept = events.filter((ev) => ev.end >= today);
const removed = events.filter((ev) => ev.end < today);

if (removed.length === 0) {
	console.log("No past events to remove.");
	process.exit(0);
}

writeFileSync(dataPath, JSON.stringify(kept, null, 2) + "\n");

console.log(`Removed ${removed.length} past event(s):`);
for (const ev of removed) console.log(`  - ${ev.name} (${ev.start} to ${ev.end})`);
console.log(`${kept.length} events remain.`);
