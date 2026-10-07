// Auto-verify and publish a submitted event. Every function here returns
// { ok: true, ... } or { ok: false, reason } so the caller can email Dan the
// reason and leave events.json untouched. Nothing here throws on bad input.

const GITHUB_REPO = "CaptainDarkHeart/eventmap";
const EVENTS_PATH = "src/data/events.json";
const VALID_TOPICS = new Set([
	"startup-vc", "fintech", "ai", "dev-eng", "general-tech", "crypto", "gaming", "security",
]);
const MONTHS = [
	["january", "jan"], ["february", "feb"], ["march", "mar"], ["april", "apr"],
	["may", "may"], ["june", "jun"], ["july", "jul"], ["august", "aug"],
	["september", "sep"], ["october", "oct"], ["november", "nov"], ["december", "dec"],
];

export function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

export function slugify(str) {
	return str
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

// Name + year, but not "developerweek-2027-2027" when the name already carries the year.
export function makeSlug(name, start) {
	const base = slugify(name);
	const year = start.slice(0, 4);
	return new RegExp(`(^|-)${year}($|-)`).test(base) ? base : `${base}-${year}`;
}

function normalise(str) {
	return str.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isPrivateHost(hostname) {
	return (
		hostname === "localhost" ||
		hostname.endsWith(".local") ||
		hostname.endsWith(".internal") ||
		/^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
		hostname.includes(":")
	);
}

// Does the page text mention the start date in any common format?
export function pageMentionsDate(text, isoDate) {
	const [y, m, d] = isoDate.split("-").map(Number);
	const lower = text.toLowerCase();
	if (!lower.includes(String(y))) return false;
	if (lower.includes(isoDate)) return true;
	const [full, abbr] = MONTHS[m - 1];
	const month = `(?:${full}|${abbr}\\.?)`;
	const day = `0?${d}(?:st|nd|rd|th)?`;
	const range = `(?:\\s*[-–—]\\s*\\d{1,2}(?:st|nd|rd|th)?)?`;
	const patterns = [
		new RegExp(`\\b${day}${range}\\s+(?:of\\s+)?${month}\\b`),
		new RegExp(`\\b${month}\\s+${day}\\b`),
		new RegExp(`\\b0?${d}[/.]0?${m}[/.](?:20)?${String(y).slice(2)}\\b`),
		new RegExp(`\\b0?${m}[/.]0?${d}[/.](?:20)?${String(y).slice(2)}\\b`),
	];
	return patterns.some((p) => p.test(lower));
}

export async function verifyUrlAndDates({ name, url, start }) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, reason: "URL is not parseable." };
	}
	if (!/^https?:$/.test(parsed.protocol) || isPrivateHost(parsed.hostname)) {
		return { ok: false, reason: "URL is not a public http(s) address." };
	}

	let res;
	try {
		res = await fetch(url, {
			redirect: "follow",
			signal: AbortSignal.timeout(10000),
			headers: {
				"user-agent": "Mozilla/5.0 (compatible; TechEventsMapBot/1.0; +https://techeventsmap.com)",
				accept: "text/html,application/xhtml+xml",
			},
		});
	} catch (err) {
		return { ok: false, reason: `URL did not respond (${err.name || "fetch error"}).` };
	}
	if (!res.ok) return { ok: false, reason: `URL returned HTTP ${res.status}.` };

	const html = (await res.text()).slice(0, 1_500_000);
	// Dates often live only in <meta> descriptions and JSON-LD, so keep those.
	const metaText = [...html.matchAll(/<meta\b[^>]*\bcontent\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(" ");
	const ldText = [...html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join(" ");
	const text = (metaText + " " + ldText + " " + html)
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;|&#160;/g, " ")
		.replace(/\s+/g, " ");

	if (!normalise(text + " " + parsed.hostname).includes(normalise(name))) {
		return { ok: false, reason: "Event name not found on the page." };
	}
	if (!pageMentionsDate(text, start)) {
		return { ok: false, reason: `Start date ${start} not found on the page (could be a JS-rendered site).` };
	}
	return { ok: true, finalUrl: res.url };
}

// Great-circle distance in km.
export function distanceKm(a, b) {
	const rad = (d) => (d * Math.PI) / 180;
	const dLat = rad(b.lat - a.lat);
	const dLng = rad(b.lng - a.lng);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Two geocoders must agree before a pin is published. A free-text Nominatim query
// once ranked "Santa Clara County" above the city (25 km off), so: structured query,
// plus an independent second opinion. Disagreement means manual review, never a guess.
export const GEOCODE_AGREE_KM = 25;

async function nominatim(city, country, doFetch) {
	const q = new URLSearchParams({ format: "json", limit: "3", addressdetails: "1", city, country });
	const res = await doFetch(`https://nominatim.openstreetmap.org/search?${q}`, {
		signal: AbortSignal.timeout(8000),
		headers: { "user-agent": "TechEventsMap/1.0 (contact@techeventsmap.com)" },
	});
	if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
	const hit = (await res.json())[0];
	if (!hit) return null;
	return { lat: Number(hit.lat), lng: Number(hit.lon), countryCode: String(hit.address?.country_code || "").toUpperCase() };
}

async function openMeteo(city, countryCode, doFetch) {
	const q = new URLSearchParams({ name: city, count: "10", language: "en", format: "json" });
	const res = await doFetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`, { signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
	const hits = ((await res.json()).results || []).filter((h) => !countryCode || h.country_code === countryCode);
	// Results come back ranked by population: take the largest place of that name.
	return hits[0] ? { lat: Number(hits[0].latitude), lng: Number(hits[0].longitude) } : null;
}

export async function geocode(city, country, doFetch = fetch) {
	try {
		const a = await nominatim(city, country, doFetch);
		if (!a) return { ok: false, reason: `Could not geocode "${city}, ${country}".` };
		const b = await openMeteo(city, a.countryCode, doFetch);
		if (!b) return { ok: false, reason: `Second geocoder could not confirm "${city}, ${country}".` };
		const km = distanceKm(a, b);
		if (km > GEOCODE_AGREE_KM) {
			return { ok: false, reason: `Geocoders disagree on "${city}, ${country}" (${Math.round(km)} km apart), check the pin by hand.` };
		}
		const lat = Math.round(a.lat * 10000) / 10000;
		const lng = Math.round(a.lng * 10000) / 10000;
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, reason: "Geocoder returned bad coordinates." };
		return { ok: true, lat, lng };
	} catch (err) {
		return { ok: false, reason: `Geocoder failed (${err.message || err.name || "error"}).` };
	}
}

function ghHeaders(env) {
	return {
		authorization: `Bearer ${env.GITHUB_TOKEN}`,
		accept: "application/vnd.github+json",
		"user-agent": "techeventsmap-worker",
		"x-github-api-version": "2022-11-28",
	};
}

function b64decode(b64) {
	const bin = atob(b64.replace(/\n/g, ""));
	return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function b64encode(str) {
	const bytes = new TextEncoder().encode(str);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

function hostPath(u) {
	try {
		const p = new URL(u);
		return p.hostname.replace(/^www\./, "") + p.pathname.replace(/\/+$/, "");
	} catch {
		return u;
	}
}

// Appends the event to events.json on main via the GitHub contents API.
// The sha makes the write atomic: a concurrent commit makes the PUT 409, so retry.
export async function appendToRepo(env, candidate) {
	const api = `https://api.github.com/repos/${GITHUB_REPO}/contents/${EVENTS_PATH}`;

	for (let attempt = 0; attempt < 3; attempt++) {
		const getRes = await fetch(`${api}?ref=main`, { headers: ghHeaders(env) });
		if (!getRes.ok) return { ok: false, reason: `GitHub read failed (HTTP ${getRes.status}).` };
		const file = await getRes.json();
		const events = JSON.parse(b64decode(file.content));

		const wantName = normalise(candidate.name);
		// Same year only: series reuse one evergreen URL across editions.
		const dup = events.find(
			(e) =>
				e.start.slice(0, 4) === candidate.start.slice(0, 4) &&
				(hostPath(e.url || "") === hostPath(candidate.url) || normalise(e.name) === wantName),
		);
		if (dup) return { ok: false, reason: `Duplicate of existing event "${dup.name}" (id ${dup.id}).`, duplicate: true };

		const slugs = new Set(events.map((e) => e.slug));
		let slug = makeSlug(candidate.name, candidate.start);
		if (slugs.has(slug)) slug = `${slug}-${slugify(candidate.city)}`;
		if (slugs.has(slug)) return { ok: false, reason: `Slug "${slug}" already exists.` };

		// Same city already on the map? The pin must sit with the others.
		const sameCity = events.find((e) => normalise(e.city) === normalise(candidate.city) && normalise(e.country) === normalise(candidate.country));
		if (sameCity && distanceKm(sameCity, candidate) > GEOCODE_AGREE_KM) {
			return { ok: false, reason: `Pin is ${Math.round(distanceKm(sameCity, candidate))} km from existing ${candidate.city} events (id ${sameCity.id}), check by hand.` };
		}

		const id = Math.max(0, ...events.map((e) => e.id)) + 1;
		const event = { id, slug, ...candidate, v: 1 };
		events.push(event);

		const putRes = await fetch(api, {
			method: "PUT",
			headers: ghHeaders(env),
			body: JSON.stringify({
				message: `Add ${candidate.name} via submission form`,
				content: b64encode(JSON.stringify(events, null, 2) + "\n"),
				sha: file.sha,
				branch: "main",
			}),
		});
		if (putRes.ok) return { ok: true, event };
		if (putRes.status !== 409 && putRes.status !== 422) {
			return { ok: false, reason: `GitHub write failed (HTTP ${putRes.status}).` };
		}
	}
	return { ok: false, reason: "GitHub write conflicted 3 times in a row." };
}

// Full pipeline. `sub` is the already shape-validated submission.
export async function autoAdd(env, sub) {
	if (!env.GITHUB_TOKEN) return { ok: false, reason: "GITHUB_TOKEN is not configured." };

	const end = sub.end || sub.start;
	if (end < todayISO()) return { ok: false, reason: `Event already ended (${end}).` };

	const topics = sub.topics.filter((t) => VALID_TOPICS.has(t));
	if (!topics.length) return { ok: false, reason: "No valid topic selected." };

	const verified = await verifyUrlAndDates(sub);
	if (!verified.ok) return verified;

	const geo = await geocode(sub.city, sub.country);
	if (!geo.ok) return geo;

	return appendToRepo(env, {
		name: sub.name,
		city: sub.city,
		country: sub.country,
		lat: geo.lat,
		lng: geo.lng,
		start: sub.start,
		end,
		tier: "notable",
		topics,
		source: "manual",
		url: sub.url,
	});
}
