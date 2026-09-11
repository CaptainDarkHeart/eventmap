#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "src", "data", "events.json");
const events = JSON.parse(readFileSync(dataPath, "utf-8"));

const CONCURRENCY = 8;
const TIMEOUT_MS = 10000;
const HEADERS = {
	"User-Agent": "Mozilla/5.0 (compatible; TechEventsMapBot/1.0; +https://techeventsmap.com)",
};

async function checkUrl(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		let res = await fetch(url, { method: "HEAD", redirect: "follow", headers: HEADERS, signal: controller.signal });
		if (res.status === 405 || res.status === 403) {
			res = await fetch(url, { method: "GET", redirect: "follow", headers: HEADERS, signal: controller.signal });
		}
		return { ok: res.ok, status: res.status, finalUrl: res.url };
	} catch (err) {
		return { ok: false, status: null, error: err.name === "AbortError" ? "timeout" : err.message };
	} finally {
		clearTimeout(timer);
	}
}

async function runPool(items, worker, concurrency) {
	const results = new Array(items.length);
	let next = 0;
	async function runner() {
		while (next < items.length) {
			const i = next++;
			results[i] = await worker(items[i], i);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
	return results;
}

const withUrls = events.filter((ev) => ev.url);
console.log(`Checking ${withUrls.length} event URLs (${events.length - withUrls.length} events have no url set)...\n`);

const results = await runPool(withUrls, async (ev) => {
	const result = await checkUrl(ev.url);
	return { ev, ...result };
}, CONCURRENCY);

const broken = [];
const redirected = [];

for (const r of results) {
	const ctx = `${r.ev.name} (${r.ev.slug})`;
	if (!r.ok) {
		broken.push(r);
		console.log(`✗ ${ctx}: ${r.status ?? r.error} — ${r.ev.url}`);
	} else if (r.finalUrl && stripTrailingSlash(r.finalUrl) !== stripTrailingSlash(r.ev.url)) {
		redirected.push(r);
		console.log(`→ ${ctx}: redirects to ${r.finalUrl}`);
	}
}

function stripTrailingSlash(u) {
	return u.replace(/\/$/, "");
}

console.log(`\n${withUrls.length - broken.length}/${withUrls.length} URLs OK.`);
if (redirected.length) console.log(`${redirected.length} redirect(s) worth updating in events.json.`);
if (broken.length) {
	console.log(`${broken.length} broken URL(s):`);
	for (const r of broken) console.log(`  - id=${r.ev.id} slug=${r.ev.slug}: ${r.ev.url}`);
	process.exit(1);
}
