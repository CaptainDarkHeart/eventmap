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

const GROUPS = [
	["europe", EUROPE],
	["asia", ASIA],
	["middle east", MIDDLE_EAST],
	["africa", AFRICA],
	["north america", NORTH_AMERICA],
	["south america", SOUTH_AMERICA],
	["latin america latam", LATAM],
	["oceania", OCEANIA],
];

export function regionsFor(country) {
	return GROUPS.filter(([, list]) => list.includes(country)).map(([name]) => name).join(" ");
}
