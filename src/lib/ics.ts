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

// RFC 5545 caps content lines at 75 octets; longer lines must be folded onto
// continuation lines starting with a single space, or strict parsers reject the file.
function fold(line: string): string {
	const bytes = new TextEncoder().encode(line);
	if (bytes.length <= 75) return line;
	const chunks: string[] = [];
	let start = 0;
	while (start < bytes.length) {
		// first line takes 75 octets, continuations 74 (the leading space counts)
		const limit = start === 0 ? 75 : 74;
		let end = Math.min(start + limit, bytes.length);
		// never split a multi-byte UTF-8 sequence
		while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
		chunks.push(new TextDecoder().decode(bytes.slice(start, end)));
		start = end;
	}
	return chunks.join("\r\n ");
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
	return lines.map(fold).join("\r\n");
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
	]
		.map((line) => (line.startsWith("BEGIN:VEVENT") ? line : fold(line)))
		.join("\r\n");
}
