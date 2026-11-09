#!/usr/bin/env node
// Read-only Google Search Console report via the official API. No dependencies.
//
//   npm run gsc -- perf [days]     daily clicks/impressions/position + top pages and queries
//   npm run gsc -- check           weekly health check, exits 2 with ALERT lines on problems
//   npm run gsc -- inspect [n]     URL Inspection over the live sitemap (default all, quota ~2000/day)
//
// Auth: service account JSON key, added in Search Console as a Restricted user.
// Key path: GSC_KEY_FILE, default ~/.config/gsc/techeventsmap-key.json (keep it OUTSIDE the repo).
// Property: GSC_SITE, default sc-domain:techeventsmap.com.
import { readFileSync, writeFileSync } from "node:fs";
import { createSign } from "node:crypto";
import os from "node:os";
import path from "node:path";

const SITE = process.env.GSC_SITE || "sc-domain:techeventsmap.com";
const KEY_FILE = process.env.GSC_KEY_FILE || path.join(os.homedir(), ".config/gsc/techeventsmap-key.json");
const SITEMAP = "https://techeventsmap.com/sitemap-0.xml";
const b64 = (b) => Buffer.from(b).toString("base64url");

async function token() {
	let key;
	try {
		key = JSON.parse(readFileSync(KEY_FILE, "utf-8"));
	} catch {
		console.error(`No key at ${KEY_FILE}. Set GSC_KEY_FILE or see the setup notes in this file.`);
		process.exit(1);
	}
	const now = Math.floor(Date.now() / 1000);
	const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const body = b64(
		JSON.stringify({
			iss: key.client_email,
			scope: "https://www.googleapis.com/auth/webmasters.readonly",
			aud: "https://oauth2.googleapis.com/token",
			iat: now,
			exp: now + 3600,
		}),
	);
	const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(key.private_key, "base64url");
	const res = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: `${head}.${body}.${sig}`,
		}),
	});
	const json = await res.json();
	if (!json.access_token) throw new Error(`Token error: ${JSON.stringify(json)}`);
	return json.access_token;
}

async function api(url, tok, payload) {
	const res = await fetch(url, {
		method: "POST",
		headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(30000),
	});
	const json = await res.json();
	if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json.error || json)}`);
	return json;
}

const ymd = (d) => d.toISOString().slice(0, 10);

async function perf(days) {
	const tok = await token();
	const end = new Date(Date.now() - 2 * 864e5); // GSC data lags ~2 days
	const start = new Date(end - (days - 1) * 864e5);
	const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
	const base = { startDate: ymd(start), endDate: ymd(end), type: "web" };

	const daily = await api(url, tok, { ...base, dimensions: ["date"] });
	console.log("date        clicks  impr   pos");
	for (const r of daily.rows || []) {
		console.log(`${r.keys[0]}  ${String(r.clicks).padStart(6)} ${String(r.impressions).padStart(5)}  ${r.position.toFixed(1)}`);
	}
	for (const dim of ["page", "query"]) {
		const out = await api(url, tok, { ...base, dimensions: [dim], rowLimit: 15 });
		console.log(`\nTop ${dim}s (clicks, impressions, position)`);
		for (const r of out.rows || []) console.log(`${r.clicks}\t${r.impressions}\t${r.position.toFixed(1)}\t${r.keys[0]}`);
	}
}

async function inspect(limit) {
	const tok = await token();
	const xml = await (await fetch(SITEMAP)).text();
	let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
	if (limit) urls = urls.slice(0, limit);
	const tally = {};
	const bad = [];
	let i = 0;
	let stop = false;
	const one = async (u) => {
		if (stop) return;
		console.error(`[${++i}/${urls.length}] ${u}`);
		try {
			const out = await api("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", tok, {
				inspectionUrl: u,
				siteUrl: SITE,
			});
			const s = out.inspectionResult?.indexStatusResult || {};
			const verdict = s.coverageState || s.verdict || "unknown";
			tally[verdict] = (tally[verdict] || 0) + 1;
			if (s.verdict !== "PASS") bad.push(`${verdict}\t${u}`);
		} catch (e) {
			tally.error = (tally.error || 0) + 1;
			bad.push(`error ${e.message.slice(0, 80)}\t${u}`);
			if (/429/.test(e.message)) stop = true;
		}
	};
	const queue = [...urls];
	await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await one(queue.shift()); }));
	return { total: urls.length, tally, bad };
}

function printInspect({ total, tally, bad }) {
	console.log(`Inspected ${total} URLs`);
	console.table(tally);
	if (bad.length) console.log("\nNot indexed / errors:\n" + bad.join("\n"));
}

// Weekly health check: compares the last 7 days of search traffic with the 7 before,
// re-inspects the sitemap, and diffs against the previous run (logs/gsc-last.json).
// Prints an ALERT line per problem and exits 2 if there is one, so the cron can notify.
async function check() {
	const tok = await token();
	const day = (n) => ymd(new Date(Date.now() - n * 864e5));
	const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
	const sum = async (a, b) => {
		const r = (await api(url, tok, { startDate: day(a), endDate: day(b), type: "web" })).rows?.[0];
		return { clicks: r?.clicks || 0, impressions: r?.impressions || 0 };
	};
	const cur = await sum(8, 2);
	const prev = await sum(15, 9);
	const res = await inspect(0);
	const indexed = res.tally["Submitted and indexed"] || 0;
	const errors = res.tally.error || 0;
	const lastFile = new URL("../logs/gsc-last.json", import.meta.url);
	let last = null;
	try { last = JSON.parse(readFileSync(lastFile, "utf-8")); } catch {}
	const alerts = [];
	if (prev.impressions >= 100 && cur.impressions < prev.impressions * 0.5) alerts.push(`Impressions fell ${prev.impressions} -> ${cur.impressions} week on week`);
	if (prev.clicks >= 5 && cur.clicks < prev.clicks * 0.5) alerts.push(`Clicks fell ${prev.clicks} -> ${cur.clicks} week on week`);
	if (res.total && indexed / res.total < 0.8) alerts.push(`Only ${indexed}/${res.total} sitemap URLs indexed (${Math.round((indexed / res.total) * 100)}%)`);
	if (last && indexed < last.indexed - 10) alerts.push(`Indexed URLs fell ${last.indexed} -> ${indexed} since ${last.date}`);
	if (errors > res.total * 0.1) alerts.push(`${errors} inspection errors, API may be failing`);
	console.log(`traffic 7d: ${cur.clicks} clicks, ${cur.impressions} impr (prev ${prev.clicks}, ${prev.impressions})`);
	console.log(`indexed: ${indexed}/${res.total}`);
	console.table(res.tally);
	writeFileSync(lastFile, JSON.stringify({ date: ymd(new Date()), indexed, total: res.total, cur, prev }));
	for (const a of alerts) console.log(`ALERT: ${a}`);
	process.exit(alerts.length ? 2 : 0);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "perf") await perf(Number(arg) || 28);
else if (cmd === "inspect") printInspect(await inspect(Number(arg) || 0));
else if (cmd === "check") await check();
else console.log("Usage: npm run gsc -- perf [days] | inspect [n] | check");
