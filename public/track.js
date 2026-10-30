// First-party event tracking. No cookies, no IDs, no query text. Posts to /api/e.
(function () {
	if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;
	var searched = false;
	function send(e, target) {
		try {
			var body = JSON.stringify({ e: e, p: location.pathname, t: String(target || "").slice(0, 200) });
			if (!(navigator.sendBeacon && navigator.sendBeacon("/api/e", new Blob([body], { type: "text/plain" })))) {
				fetch("/api/e", { method: "POST", body: body, keepalive: true });
			}
		} catch (_) {}
	}
	document.addEventListener("click", function (ev) {
		var el = ev.target && ev.target.closest ? ev.target.closest("a,button") : null;
		if (!el) return;
		if (el.id === "csv-btn") return send("csv_export");
		var href = el.getAttribute("href") || "";
		if (!href) return;
		if (/\.ics(\?|$)/.test(href)) return send("calendar_ics", href);
		if (href.indexOf("calendar.google.com") > -1) return send("calendar_google", href);
		if (/^mailto:/i.test(href)) return send("contact_click", href.replace(/^mailto:/i, "").split("?")[0]);
		if (/^tel:/i.test(href)) return send("tel_click", href.replace(/^tel:/i, ""));
		var u;
		try { u = new URL(href, location.href); } catch (_) { return; }
		if (u.host !== location.host) return send("outbound", u.host + u.pathname);
		if (/^\/events\/[^/]+\/?$/.test(u.pathname)) return send("event_view", u.pathname);
	}, true);
	document.addEventListener("input", function (ev) {
		if (!searched && ev.target && ev.target.type === "text" && /search/.test(ev.target.id + ev.target.className)) {
			searched = true;
			send("search");
		}
	}, true);
	// Pages can report their own events (e.g. fetch-based forms): window.dispatchEvent(new CustomEvent("track", { detail: { e: "form_sent", t: "contact" } }))
	window.addEventListener("track", function (ev) { if (ev.detail && ev.detail.e) send(ev.detail.e, ev.detail.t); });
	document.addEventListener("focusin", function (ev) {
		var f = ev.target && ev.target.form;
		if (f && f.id && !f._tracked) { f._tracked = true; send("form_start", f.id); }
	}, true);
	document.addEventListener("submit", function (ev) {
		var a = ev.target && ev.target.getAttribute && ev.target.getAttribute("action");
		if (a) send("form_submit", a);
	}, true);
})();
