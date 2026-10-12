// Region keywords per country, so searching "Europe" or "Asia" finds events.
// Value is a lowercase, space-joined string matched with includes() against the query.
const EUROPE = ["United Kingdom", "Germany", "France", "Spain", "Netherlands", "Denmark", "Poland", "Switzerland", "Sweden", "Czechia", "Czech Republic", "Slovenia", "Romania", "Portugal", "Italy", "Ireland", "Greece", "Finland", "Estonia", "Austria", "Ukraine", "Serbia", "Norway", "Malta", "Latvia", "Iceland", "Bulgaria", "Russia", "Turkey"];
const ASIA = ["Japan", "Singapore", "India", "China", "South Korea", "Taiwan", "Hong Kong", "Thailand", "Macau"];
const MIDDLE_EAST = ["Israel", "UAE", "United Arab Emirates", "Saudi Arabia", "Qatar", "Turkey", "Egypt"];
const AFRICA = ["Kenya", "South Africa", "Nigeria", "Ghana", "Morocco", "Egypt"];
const NORTH_AMERICA = ["United States", "Canada", "Mexico", "Puerto Rico"];
const LATAM = ["Brazil", "Uruguay", "Peru", "Paraguay", "Colombia", "Chile", "Argentina", "Mexico", "Puerto Rico"];
const SOUTH_AMERICA = ["Brazil", "Uruguay", "Peru", "Paraguay", "Colombia", "Chile", "Argentina"];
const OCEANIA = ["Australia", "New Zealand"];

export const REGION_GROUPS = [
	{ key: "europe", label: "Europe", tokens: "europe", list: EUROPE },
	{ key: "asia", label: "Asia", tokens: "asia", list: ASIA },
	{ key: "middle-east", label: "the Middle East", title: "Middle East", tokens: "middle east", list: MIDDLE_EAST },
	{ key: "africa", label: "Africa", tokens: "africa", list: AFRICA },
	{ key: "north-america", label: "North America", tokens: "north america", list: NORTH_AMERICA },
	{ key: "south-america", label: "South America", tokens: "south america", list: SOUTH_AMERICA },
	{ key: "latin-america", label: "Latin America", tokens: "latin america latam", list: LATAM },
	{ key: "oceania", label: "Oceania", tokens: "oceania", list: OCEANIA },
];

export function regionsFor(country) {
	return REGION_GROUPS.filter((g) => g.list.includes(country)).map((g) => g.tokens).join(" ");
}
