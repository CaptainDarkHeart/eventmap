export interface IcsEvent {
	uid: string;
	name: string;
	start: string; // YYYY-MM-DD
	end: string; // YYYY-MM-DD, inclusive
	city: string;
	country: string;
	url: string;
	slug: string;
}

function escapeText(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function ymd(dateStr: string): string {
	return dateStr.replace(/-/g, "");
}

function addDay(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00Z");
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}

function dtstamp(): string {
	return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function buildVEvent(ev: IcsEvent): string {
	const detailUrl = `https://techeventsmap.com/events/${ev.slug}`;
	const lines = [
		"BEGIN:VEVENT",
		`UID:${ev.uid}@techeventsmap.com`,
		`DTSTAMP:${dtstamp()}`,
		`DTSTART;VALUE=DATE:${ymd(ev.start)}`,
		`DTEND;VALUE=DATE:${ymd(addDay(ev.end))}`,
		`SUMMARY:${escapeText(ev.name)}`,
		`LOCATION:${escapeText(`${ev.city}, ${ev.country}`)}`,
		`URL:${ev.url || detailUrl}`,
		`DESCRIPTION:${escapeText(`${ev.name}, ${ev.city}, ${ev.country}. Details: ${detailUrl}`)}`,
		"END:VEVENT",
	];
	return lines.join("\r\n");
}

export function buildCalendar(events: IcsEvent[], calname = "Tech Events Map"): string {
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Tech Events Map//techeventsmap.com//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-CALNAME:${escapeText(calname)}`,
		...events.map(buildVEvent),
		"END:VCALENDAR",
	].join("\r\n");
}
