import events from "../data/events.json";
import { REGION_GROUPS } from "./regions.js";
import { TOPICS } from "./topics";

export const SITE = "https://techeventsmap.com";

// Programmatic "area" pages (countries, cities, topics, regions). Countries and cities need at least
// MIN_EVENTS upcoming events to get a page, thin pages would just be noise. Topics and regions always get one.
export const MIN_EVENTS = 3;

const COUNTRY_ALIASES = { "United Arab Emirates": "UAE", "Czech Republic": "Czechia" };
export const canonCountry = (c) => COUNTRY_ALIASES[c] || c;

export const slugify = (s) =>
	s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const the = (n) => (n === "Middle East" ? "the Middle East" : n);
const TIER_RANK = { mega: 3, major: 2, notable: 1 };

export const TYPES = {
	countries: {
		label: "Countries",
		single: "country",
		keys: (e) => [canonCountry(e.country)],
		nameOf: (k) => k,
		title: (n) => `Tech events in ${n}`,
		scope: (n) => `in ${n}`,
		min: MIN_EVENTS,
	},
	cities: {
		label: "Cities",
		single: "city",
		keys: (e) => [`${e.city}|${canonCountry(e.country)}`],
		nameOf: (k) => k.split("|")[0],
		title: (n) => `Tech events in ${n}`,
		scope: (n) => `in ${n}`,
		min: MIN_EVENTS,
	},
	topics: {
		label: "Topics",
		single: "topic",
		keys: (e) => e.topics,
		nameOf: (k) => TOPICS[k]?.label ?? k,
		title: (n) => `${n} conferences and events`,
		scope: (n) => `for ${n}`,
		min: 1,
	},
	regions: {
		label: "Regions",
		single: "region",
		keys: (e) => REGION_GROUPS.filter((g) => g.list.includes(e.country)).map((g) => g.key),
		nameOf: (k) => REGION_GROUPS.find((g) => g.key === k)?.title ?? REGION_GROUPS.find((g) => g.key === k)?.label ?? k,
		title: (n) => `Tech events in ${the(n)}`,
		scope: (n) => `in ${the(n)}`,
		min: 1,
	},
};

export const fmtInt = (n) => n.toLocaleString("en-GB");

export function fmtDate(s, e) {
	const sd = new Date(s + "T00:00:00Z");
	const ed = new Date(e + "T00:00:00Z");
	const o = { timeZone: "UTC" };
	if (s === e) return sd.toLocaleDateString("en-GB", { ...o, day: "numeric", month: "short", year: "numeric" });
	const sameYear = sd.getUTCFullYear() === ed.getUTCFullYear();
	const a = sd.toLocaleDateString("en-GB", { ...o, day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
	const b = ed.toLocaleDateString("en-GB", { ...o, day: "numeric", month: "short", year: "numeric" });
	return `${a} – ${b}`;
}

function top(counter, n) {
	return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export const list = (names) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export function groupsFor(type) {
	const t = TYPES[type];
	const map = new Map();
	for (const e of events) {
		for (const k of new Set(t.keys(e))) {
			if (!map.has(k)) map.set(k, []);
			map.get(k).push(e);
		}
	}
	const groups = [...map.entries()]
		.filter(([, es]) => es.length >= t.min)
		.map(([key, es]) => summarise(type, key, es))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	const seen = new Map();
	for (const g of groups) {
		if (seen.has(g.slug)) throw new Error(`Slug collision in ${type}: ${g.slug} (${g.key} vs ${seen.get(g.slug)})`);
		seen.set(g.slug, g.key);
	}
	return groups;
}

function summarise(type, key, es) {
	const t = TYPES[type];
	const upcoming = [...es].sort((a, b) => a.start.localeCompare(b.start));
	const biggest = [...es].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || a.start.localeCompare(b.start))[0];
	const cty = new Map(), cit = new Map(), top_ = new Map();
	const tiers = { mega: 0, major: 0, notable: 0 };
	for (const e of es) {
		cty.set(canonCountry(e.country), (cty.get(canonCountry(e.country)) || 0) + 1);
		cit.set(e.city, (cit.get(e.city) || 0) + 1);
		e.topics.forEach((x) => top_.set(x, (top_.get(x) || 0) + 1));
		tiers[e.tier]++;
	}
	return {
		type,
		key,
		slug: slugify(t.nameOf(key)),
		name: t.nameOf(key),
		count: es.length,
		events: upcoming,
		biggest,
		tiers,
		countries: top(cty, 6),
		cities: top(cit, 6),
		topics: top(top_, 8).map(([k, c]) => [TOPICS[k]?.label ?? k, c, k]),
		cityCountry: type === "cities" ? key.split("|")[1] : null,
	};
}
