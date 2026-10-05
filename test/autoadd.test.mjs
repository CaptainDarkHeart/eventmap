import { test } from "node:test";
import assert from "node:assert/strict";
import { geocode, makeSlug, distanceKm } from "../worker/autoadd.js";

const json = (data, ok = true, status = 200) => ({ ok, status, json: async () => data });

// Fake fetch: Nominatim first, Open-Meteo second.
const fakeFetch = (nom, meteo) => async (url) =>
	String(url).includes("nominatim") ? json(nom) : json(meteo);

const SANTA_CLARA_CITY = { lat: "37.3541", lon: "-121.9552", address: { country_code: "us" } };
const SANTA_CLARA_COUNTY = { lat: "37.2333", lon: "-121.6846", address: { country_code: "us" } };
const METEO_CA = { results: [{ latitude: 37.35411, longitude: -121.95524, country_code: "US" }] };

test("slug does not repeat the year already in the name", () => {
	assert.equal(makeSlug("DeveloperWeek 2027", "2027-02-09"), "developerweek-2027");
	assert.equal(makeSlug("Slush", "2026-11-18"), "slush-2026");
	assert.equal(makeSlug("2026 Summit", "2026-05-01"), "2026-summit");
});

test("geocode accepts a pin both geocoders agree on", async () => {
	const r = await geocode("Santa Clara", "United States", fakeFetch([SANTA_CLARA_CITY], METEO_CA));
	assert.equal(r.ok, true);
	assert.equal(r.lat, 37.3541);
});

test("geocode rejects the county pin that once slipped through (25 km off)", async () => {
	assert.ok(distanceKm({ lat: 37.2333, lng: -121.6846 }, { lat: 37.3541, lng: -121.9552 }) > 25);
	const r = await geocode("Santa Clara", "United States", fakeFetch([SANTA_CLARA_COUNTY], METEO_CA));
	assert.equal(r.ok, false);
	assert.match(r.reason, /disagree/);
});

test("geocode fails safe when the second geocoder has no answer", async () => {
	const r = await geocode("Santa Clara", "United States", fakeFetch([SANTA_CLARA_CITY], { results: [] }));
	assert.equal(r.ok, false);
});

test("geocode fails safe when the second geocoder is down", async () => {
	const down = async (url) => (String(url).includes("nominatim") ? json([SANTA_CLARA_CITY]) : json({}, false, 503));
	const r = await geocode("Santa Clara", "United States", down);
	assert.equal(r.ok, false);
});
