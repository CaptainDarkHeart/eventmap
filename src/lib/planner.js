// Deterministic trip planner. Pure functions, no DOM, no network: the /plan page
// feeds in events.json plus a profile and gets back scored events and an itinerary.
// Network scoring uses event size (tier) only, events.json has no attendee data.

const DAY_MS = 86400000;
const TIER_RANK = { notable: 1, major: 2, mega: 3 };
const CLUSTER_GAP_DAYS = 2;
const CLUSTER_RADIUS_KM = 600;
const SAME_CITY_KM = 50;
const MAX_TRIP_SPAN_DAYS = 7;
const FALLBACK_MAX_KM = 12000;
const TRIP_EVENT_WEIGHTS = [1, 0.6, 0.3];

/** How well each tier serves each goal, 0-1. */
export const GOAL_WEIGHTS = {
	learn: { notable: 0.9, major: 0.8, mega: 0.6 },
	network: { notable: 0.5, major: 0.8, mega: 1 },
	sell: { notable: 0.5, major: 0.85, mega: 1 },
	raise: { notable: 0.5, major: 1, mega: 0.8 },
	press: { notable: 0.4, major: 0.8, mega: 1 },
};

const GOAL_LABELS = {
	learn: "learning",
	network: "networking",
	sell: "selling",
	raise: "fundraising",
	press: "press and PR",
};

function toDay(iso) {
	return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
}

function fromDay(day) {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso, n) {
	return fromDay(toDay(iso) + n);
}

export function haversineKm(a, b) {
	const rad = Math.PI / 180;
	const dLat = (b.lat - a.lat) * rad;
	const dLng = (b.lng - a.lng) * rad;
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Non-positive or non-numeric input falls back to the default, anything else is clamped.
function clampInt(value, min, max, fallback) {
	const n = Math.round(Number(value));
	return n > 0 ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * Fill defaults and clamp a profile coming from the form, localStorage or a URL hash.
 * maxKm of 0 or Infinity both mean "any distance".
 */
export function normaliseProfile(p = {}, today) {
	const goal = GOAL_WEIGHTS[p.goal] ? p.goal : "network";
	const maxKm = Number(p.maxKm) > 0 && Number.isFinite(Number(p.maxKm)) ? Number(p.maxKm) : Infinity;
	const hasHome = Number.isFinite(p.homeLat) && Number.isFinite(p.homeLng);
	return {
		homeCity: typeof p.homeCity === "string" ? p.homeCity : "",
		homeLat: hasHome ? p.homeLat : null,
		homeLng: hasHome ? p.homeLng : null,
		topics: Array.isArray(p.topics) ? p.topics.filter((t) => typeof t === "string") : [],
		goal,
		from: /^\d{4}-\d{2}-\d{2}$/.test(p.from ?? "") ? p.from : today,
		to: /^\d{4}-\d{2}-\d{2}$/.test(p.to ?? "") ? p.to : addDays(today, 183),
		maxTrips: clampInt(p.maxTrips, 1, 12, 4),
		maxDays: clampInt(p.maxDays, 1, 120, 20),
		maxKm,
		tierFloor: TIER_RANK[p.tierFloor] ? p.tierFloor : "notable",
	};
}

/**
 * Score one event 0-100 against a normalised profile, or return null when it is
 * filtered out (outside the window, past, too far, below the tier floor).
 */
export function scoreEvent(ev, profile, today) {
	if (ev.end < today) return null;
	if (ev.end < profile.from || ev.start > profile.to) return null;
	if (TIER_RANK[ev.tier] < TIER_RANK[profile.tierFloor]) return null;

	const hasHome = profile.homeLat !== null;
	const distance = hasHome
		? haversineKm({ lat: profile.homeLat, lng: profile.homeLng }, { lat: ev.lat, lng: ev.lng })
		: null;
	if (distance !== null && distance > profile.maxKm) return null;

	const reasons = [];

	let topic = 0.5;
	if (profile.topics.length > 0) {
		const matched = profile.topics.filter((t) => ev.topics.includes(t));
		topic = matched.length / profile.topics.length;
		if (matched.length > 0) reasons.push(`matches ${matched.join(", ")}`);
	}

	let goalTier = GOAL_WEIGHTS[profile.goal][ev.tier];
	if (profile.goal === "raise" && ev.topics.includes("startup-vc")) {
		goalTier = Math.min(1, goalTier + 0.15);
		reasons.push("startup and VC crowd");
	}
	if (goalTier >= 0.8) reasons.push(`${ev.tier} size suits ${GOAL_LABELS[profile.goal]}`);

	let proximity = 0.5;
	if (distance !== null) {
		const span = Number.isFinite(profile.maxKm) ? profile.maxKm : FALLBACK_MAX_KM;
		proximity = Math.max(0, 1 - distance / span);
		reasons.push(`${Math.round(distance).toLocaleString("en-GB")} km from ${profile.homeCity || "home"}`);
	}

	const leadDays = toDay(ev.start) - toDay(today);
	const timing = leadDays >= 21 ? 1 : leadDays >= 14 ? 0.7 : 0.3;
	if (leadDays < 14) reasons.push("short notice");

	const score = Math.round(100 * (0.45 * topic + 0.3 * goalTier + 0.15 * proximity + 0.1 * timing));
	return { ev, score, reasons, distance };
}

/**
 * Group scored events into trips. Highest-scored events anchor trips first. An event
 * joins a trip only if it is close in time, within the radius of EVERY member (no
 * chaining Cardiff to Berlin through Birmingham), does not clash on dates with a
 * member in another city, and the trip stays short and under the event cap.
 */
export function clusterTrips(scored) {
	const sorted = [...scored].sort((a, b) => b.score - a.score || a.ev.start.localeCompare(b.ev.start));
	const trips = [];
	for (const item of sorted) {
		const start = toDay(item.ev.start);
		const end = toDay(item.ev.end);
		const home = trips.find((t) => {
			if (t.events.length >= TRIP_EVENT_WEIGHTS.length) return false;
			if (start > t.endDay + CLUSTER_GAP_DAYS || end < t.startDay - CLUSTER_GAP_DAYS) return false;
			if (Math.max(end, t.endDay) - Math.min(start, t.startDay) + 1 > MAX_TRIP_SPAN_DAYS) return false;
			return t.events.every((m) => {
				const km = haversineKm(m.ev, item.ev);
				const clash = start <= toDay(m.ev.end) && end >= toDay(m.ev.start);
				return km <= CLUSTER_RADIUS_KM && (!clash || km <= SAME_CITY_KM);
			});
		});
		if (home) {
			home.events.push(item);
			home.startDay = Math.min(home.startDay, start);
			home.endDay = Math.max(home.endDay, end);
		} else {
			trips.push({ events: [item], startDay: start, endDay: end });
		}
	}
	return trips.map((t) => {
		const byScore = [...t.events].sort((a, b) => b.score - a.score);
		const score = byScore.reduce((sum, e, i) => sum + e.score * (TRIP_EVENT_WEIGHTS[i] ?? 0.1), 0);
		return {
			start: fromDay(t.startDay),
			end: fromDay(t.endDay),
			days: t.endDay - t.startDay + 1,
			score: Math.round(score),
			events: byScore,
		};
	});
}

/**
 * Pick the best non-overlapping trips inside the trip and day budgets.
 * Returns trips in date order plus the best leftover events.
 */
export function pickItinerary(scored, profile, alternateCount = 5) {
	const candidates = clusterTrips(scored).sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
	const chosen = [];
	let daysUsed = 0;
	for (const trip of candidates) {
		if (chosen.length >= profile.maxTrips) break;
		if (daysUsed + trip.days > profile.maxDays) continue;
		if (chosen.some((c) => trip.start <= c.end && trip.end >= c.start)) continue;
		chosen.push(trip);
		daysUsed += trip.days;
	}
	chosen.sort((a, b) => a.start.localeCompare(b.start));
	const used = new Set(chosen.flatMap((t) => t.events.map((e) => e.ev.slug)));
	const alternates = scored
		.filter((s) => !used.has(s.ev.slug))
		.sort((a, b) => b.score - a.score)
		.slice(0, alternateCount);
	return { trips: chosen, alternates, daysUsed };
}

/** Score every event and pick the itinerary in one call. */
export function plan(events, rawProfile, today) {
	const profile = normaliseProfile(rawProfile, today);
	const scored = events.map((ev) => scoreEvent(ev, profile, today)).filter(Boolean);
	return { profile, scored, ...pickItinerary(scored, profile) };
}
