// GENERATED copy lives in each project's worker/. Source: ~/Claude/agents/analytics/track-handler.js
// First-party event log to Workers Analytics Engine (binding ANALYTICS). Never fails the request.
// Columns: blob1 event, blob2 path, blob3 target, blob4 country, blob5 hostname.
const TRACKED = new Set(["csv_export", "calendar_ics", "calendar_google", "outbound", "event_view", "search", "form_submit"]);

export async function handleTrack(request, env) {
	try {
		const { e, p, t } = JSON.parse((await request.text()).slice(0, 1000));
		if (TRACKED.has(e) && typeof p === "string" && env.ANALYTICS) {
			env.ANALYTICS.writeDataPoint({
				indexes: [e],
				blobs: [e, p.slice(0, 200), String(t || "").slice(0, 200), request.cf?.country || "", new URL(request.url).hostname],
				doubles: [1],
			});
		}
	} catch {}
	return new Response(null, { status: 204 });
}
