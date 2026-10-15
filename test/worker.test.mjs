import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

const run = (path, res, method = "GET") =>
	worker.fetch(new Request(`https://techeventsmap.com${path}`, { method }), { ASSETS: { fetch: async () => res } });

test("307 trailing-slash redirect becomes 301", async () => {
	const out = await run("/events", new Response(null, { status: 307, headers: { location: "/events/" } }));
	assert.equal(out.status, 301);
	assert.equal(out.headers.get("location"), "/events/");
});

test("ics, data and pb-stats responses are noindex", async () => {
	for (const p of ["/events.ics", "/events/slush-2026.ics", "/data/events.csv", "/pb-stats.json"]) {
		const out = await run(p, new Response("x", { status: 200 }));
		assert.match(out.headers.get("x-robots-tag"), /noindex/, p);
	}
});

test("html pages are not noindexed", async () => {
	const out = await run("/events/", new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }));
	assert.equal(out.headers.get("x-robots-tag"), null);
});

test("pruned event ics still 410s", async () => {
	const out = await run("/events/gone-2026.ics", new Response("nf", { status: 404 }));
	assert.equal(out.status, 410);
});
