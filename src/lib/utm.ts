export function outboundUrl(url: string, slug: string): string {
	try {
		const u = new URL(url);
		u.searchParams.set("utm_source", "techeventsmap.com");
		u.searchParams.set("utm_medium", "referral");
		u.searchParams.set("utm_campaign", slug);
		return u.toString();
	} catch {
		return url;
	}
}
