import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, scoreEvent, normaliseProfile, clusterTrips, pickItinerary, haversineKm } from "../src/lib/planner.js";

const TODAY = "2026-10-07";

const LONDON = { lat: 51.5074, lng: -0.1278 };
const PARIS = { lat: 48.8566, lng: 2.3522 };
const BERLIN = { lat: 52.52, lng: 13.405 };
const SF = { lat: 37.7749, lng: -122.4194 };

let n = 0;
const ev = (over) => ({
	slug: `e${++n}`,
	name: `Event ${n}`,
	city: "Paris",
	country: "France",
	...PARIS,
	start: "2026-11-10",
	end: "2026-11-11",
	tier: "major",
	topics: ["ai"],
	...over,
});

const profile = (over = {}) =>
	normaliseProfile({ homeCity: "London", homeLat: LONDON.lat, homeLng: LONDON.lng, ...over }, TODAY);

test("haversine London to Paris is about 344 km", () => {
	const d = haversineKm(LONDON, PARIS);
	assert.ok(d > 335 && d < 350);
});

test("normaliseProfile fills defaults and clamps", () => {
	const p = normaliseProfile({ goal: "nonsense", maxTrips: 99, maxDays: -3, maxKm: 0 }, TODAY);
	assert.equal(p.goal, "network");
	assert.equal(p.maxTrips, 12);
	assert.equal(p.maxDays, 20);
	assert.equal(p.maxKm, Infinity);
	assert.equal(p.from, TODAY);
	assert.equal(p.homeLat, null);
});

test("past, out-of-window, over-distance and below-floor events are excluded", () => {
	const p = profile({ maxKm: 1500, from: "2026-11-01", to: "2026-12-31", tierFloor: "major" });
	assert.equal(scoreEvent(ev({ start: "2026-10-01", end: "2026-10-02" }), p, TODAY), null);
	assert.equal(scoreEvent(ev({ start: "2027-03-01", end: "2027-03-02" }), p, TODAY), null);
	assert.equal(scoreEvent(ev({ ...SF }), p, TODAY), null);
	assert.equal(scoreEvent(ev({ tier: "notable" }), p, TODAY), null);
	assert.ok(scoreEvent(ev(), p, TODAY));
});

test("topic match ranks higher", () => {
	const p = profile({ topics: ["fintech"] });
	const hit = scoreEvent(ev({ topics: ["fintech"] }), p, TODAY);
	const miss = scoreEvent(ev({ topics: ["gaming"] }), p, TODAY);
	assert.ok(hit.score > miss.score);
	assert.ok(hit.reasons.some((r) => r.includes("fintech")));
});

test("goal changes tier preference", () => {
	const mega = ev({ tier: "mega" });
	const notable = ev({ tier: "notable" });
	const net = profile({ goal: "network" });
	const learn = profile({ goal: "learn" });
	assert.ok(scoreEvent(mega, net, TODAY).score > scoreEvent(notable, net, TODAY).score);
	assert.ok(scoreEvent(notable, learn, TODAY).score > scoreEvent(mega, learn, TODAY).score);
});

test("raise goal rewards startup-vc topic", () => {
	const p = profile({ goal: "raise" });
	const vc = scoreEvent(ev({ tier: "notable", topics: ["startup-vc"] }), p, TODAY);
	const other = scoreEvent(ev({ tier: "notable", topics: ["gaming"] }), p, TODAY);
	assert.ok(vc.score > other.score);
});

test("closer events score higher, short notice is flagged", () => {
	const p = profile({ maxKm: 5000 });
	const near = scoreEvent(ev(), p, TODAY);
	const far = scoreEvent(ev({ ...BERLIN, city: "Berlin" }), p, TODAY);
	assert.ok(near.score >= far.score);
	const soon = scoreEvent(ev({ start: "2026-10-10", end: "2026-10-11" }), p, TODAY);
	assert.ok(soon.reasons.includes("short notice"));
});

test("no home city: distance neutral, no distance filter", () => {
	const p = normaliseProfile({ maxKm: 500 }, TODAY);
	const s = scoreEvent(ev({ ...SF }), p, TODAY);
	assert.ok(s);
	assert.equal(s.distance, null);
});

test("clustering merges same-week nearby events, splits distant or distinct dates", () => {
	const p = profile();
	const a = scoreEvent(ev({ start: "2026-11-10", end: "2026-11-11" }), p, TODAY);
	const b = scoreEvent(ev({ start: "2026-11-12", end: "2026-11-13", ...BERLIN, city: "Berlin" }), p, TODAY);
	const c = scoreEvent(ev({ start: "2026-11-12", end: "2026-11-13", ...SF, city: "SF" }), p, TODAY);
	const d = scoreEvent(ev({ start: "2026-12-20", end: "2026-12-21" }), p, TODAY);
	const trips = clusterTrips([a, b, c, d].filter(Boolean));
	// Paris and Berlin are ~878 km apart, over the 600 km radius, so no merge there either
	assert.equal(trips.length, 4);
	const same = clusterTrips([
		scoreEvent(ev({ start: "2026-11-10", end: "2026-11-11" }), p, TODAY),
		scoreEvent(ev({ start: "2026-11-12", end: "2026-11-13" }), p, TODAY),
	]);
	assert.equal(same.length, 1);
	assert.equal(same[0].start, "2026-11-10");
	assert.equal(same[0].end, "2026-11-13");
	assert.equal(same[0].days, 4);
});

test("no chaining: every trip member is within 600 km of every other", () => {
	const p = profile();
	// Cardiff-ish (west UK), Paris, Berlin: each neighbour within 600 km, ends are not
	const west = { lat: 51.48, lng: -3.18 };
	const scored = [
		scoreEvent(ev({ ...west, start: "2026-11-10", end: "2026-11-10" }), p, TODAY),
		scoreEvent(ev({ ...PARIS, start: "2026-11-11", end: "2026-11-11" }), p, TODAY),
		scoreEvent(ev({ ...BERLIN, start: "2026-11-12", end: "2026-11-12" }), p, TODAY),
	];
	for (const t of clusterTrips(scored)) {
		for (const a of t.events) for (const b of t.events) assert.ok(haversineKm(a.ev, b.ev) <= 600);
	}
});

test("same-date events in different cities never share a trip, same city can", () => {
	const p = profile();
	const mk = (over) => scoreEvent(ev({ start: "2026-11-10", end: "2026-11-11", ...over }), p, TODAY);
	const split = clusterTrips([mk({ ...PARIS }), mk({ ...BERLIN, city: "Berlin" })]);
	assert.equal(split.length, 2);
	const joined = clusterTrips([mk({}), mk({ name: "Other" })]);
	assert.equal(joined.length, 1);
});

test("a trip holds at most 3 events", () => {
	const p = profile();
	const scored = [10, 11, 12, 13, 14].map((d) =>
		scoreEvent(ev({ start: `2026-11-${d}`, end: `2026-11-${d}` }), p, TODAY),
	);
	const trips = clusterTrips(scored);
	assert.ok(trips.every((t) => t.events.length <= 3));
	assert.equal(trips.flatMap((t) => t.events).length, 5);
});

test("trip span is capped at 7 days", () => {
	const p = profile();
	const scored = [0, 2, 4, 6].map((i) =>
		scoreEvent(ev({ start: `2026-11-${10 + i}`, end: `2026-11-${10 + i}` }), p, TODAY),
	);
	const trips = clusterTrips(scored);
	assert.ok(trips.every((t) => t.days <= 7));
	assert.ok(trips.length >= 2 || trips[0].days <= 7);
});

test("itinerary never returns overlapping trips and respects trip budget", () => {
	const events = [];
	for (let i = 0; i < 10; i++) {
		const day = String(1 + i * 3).padStart(2, "0");
		events.push(ev({ start: `2026-11-${day}`, end: `2026-11-${day}`, ...(i % 2 ? BERLIN : SF), city: String(i) }));
	}
	events.push(ev({ start: "2026-11-02", end: "2026-11-02", ...SF, city: "overlap" }));
	const r = plan(events, { homeLat: LONDON.lat, homeLng: LONDON.lng, maxTrips: 3, maxDays: 30 }, TODAY);
	assert.ok(r.trips.length <= 3);
	for (let i = 1; i < r.trips.length; i++) {
		assert.ok(r.trips[i].start > r.trips[i - 1].end, "trips overlap");
	}
});

test("itinerary respects days budget", () => {
	const events = [
		ev({ start: "2026-11-01", end: "2026-11-05", tier: "mega" }),
		ev({ start: "2026-12-01", end: "2026-12-05", tier: "mega" }),
	];
	const r = plan(events, { maxDays: 6, maxTrips: 5 }, TODAY);
	assert.equal(r.trips.length, 1);
	assert.ok(r.daysUsed <= 6);
});

test("alternates exclude events already in the itinerary", () => {
	const events = [ev({ start: "2026-11-01", end: "2026-11-01" }), ev({ start: "2026-12-01", end: "2026-12-01" })];
	const r = plan(events, { maxTrips: 1 }, TODAY);
	assert.equal(r.trips.length, 1);
	assert.equal(r.alternates.length, 1);
	assert.notEqual(r.alternates[0].ev.slug, r.trips[0].events[0].ev.slug);
});

test("empty input returns empty plan", () => {
	const r = plan([], {}, TODAY);
	assert.deepEqual(r.trips, []);
	assert.deepEqual(r.alternates, []);
	assert.equal(pickItinerary([], r.profile).daysUsed, 0);
});
