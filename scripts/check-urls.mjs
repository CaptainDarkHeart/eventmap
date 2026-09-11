#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "src", "data", "events.json");
const events = JSON.parse(readFileSync(dataPath, "utf-8"));

const CONCURRENCY = 8;
const TIMEOUT_MS = 10000;
// A bot user-agent gets 403'd by the WAFs in front of several event sites, which
// showed up as false "broken link" reports, so present as an ordinary browser.
const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"Accept-Language": "en-GB,en;q=0.9",
};

async function checkUrl(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		let res = await fetch(url, { method: "HEAD", redirect: "follow", headers: HEADERS, signal: controller.signal });
		// Plenty of sites refuse HEAD outright, or serve a bot challenge to it, so
		// always confirm a non-OK result with a real GET before calling it broken.
		if (!res.ok) {
			res = await fetch(url, { method: "GET", redirect: "follow", headers: HEADERS, signal: controller.signal });
		}
		return { ok: res.ok, status: res.status, finalUrl: res.url, blocked: res.status === 403 || res.status === 429 };
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
const blocked = [];
const redirected = [];

for (const r of results) {
	const ctx = `${r.ev.name} (${r.ev.slug})`;
	if (!r.ok && r.blocked) {
		// A bot-protection block says nothing about whether the page still exists
		blocked.push(r);
		console.log(`? ${ctx}: ${r.status} (bot protection, check by hand) — ${r.ev.url}`);
	} else if (!r.ok) {
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

console.log(`\n${withUrls.length - broken.length - blocked.length}/${withUrls.length} URLs OK.`);
if (blocked.length) console.log(`${blocked.length} URL(s) blocked by bot protection, verify manually.`);
if (redirected.length) console.log(`${redirected.length} redirect(s) worth updating in events.json.`);
if (broken.length) {
	console.log(`${broken.length} broken URL(s):`);
	for (const r of broken) console.log(`  - id=${r.ev.id} slug=${r.ev.slug}: ${r.ev.url}`);
	process.exit(1);
}
