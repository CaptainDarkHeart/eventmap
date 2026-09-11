const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function escapeHtml(str) {
	return str.replace(/[&<>"']/g, (c) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	})[c]);
}

async function verifyTurnstile(token, request, env) {
	const verifyRes = await fetch(TURNSTILE_VERIFY_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			secret: env.TURNSTILE_SECRET_KEY,
			response: token,
			remoteip: request.headers.get("cf-connecting-ip") || undefined,
		}),
	});
	const verify = await verifyRes.json();
	return verify.success === true;
}

async function handleContact(request, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: "Invalid request." }, 400);
	}

	// Honeypot: bots fill this hidden field, humans never see it
	if (String(body.company || "").trim() !== "") {
		return json({ ok: true, message: "Message sent, thanks." });
	}

	const name = String(body.name || "").trim().slice(0, 120);
	const email = String(body.email || "").trim().slice(0, 200);
	const message = String(body.message || "").trim().slice(0, 2000);
	const token = String(body.turnstileToken || "");

	if (!name || !email || !message || !token) {
		return json({ ok: false, error: "Please fill in all fields." }, 400);
	}
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return json({ ok: false, error: "That doesn't look like a valid email." }, 400);
	}

	if (!(await verifyTurnstile(token, request, env))) {
		return json({ ok: false, error: "Verification failed, please try again." }, 400);
	}

	const to = env.DESTINATION_EMAIL || "contact@techeventsmap.com";
	try {
		await env.EMAIL.send({
			to,
			from: "contact@techeventsmap.com",
			reply_to: email,
			subject: `Tech Events Map contact form: ${name}`,
			text: `From: ${name} <${email}>\n\n${message}`,
			html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
		});
	} catch {
		return json({ ok: false, error: "Could not send message, please email hello@techeventsmap.com directly." }, 502);
	}

	return json({ ok: true, message: "Message sent, thanks. I'll get back to you soon." });
}

async function handleSubmitEvent(request, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: "Invalid request." }, 400);
	}

	// Honeypot: bots fill this hidden field, humans never see it
	if (String(body.company || "").trim() !== "") {
		return json({ ok: true, message: "Suggestion sent, thanks." });
	}

	const name = String(body.name || "").trim().slice(0, 150);
	const url = String(body.url || "").trim().slice(0, 300);
	const city = String(body.city || "").trim().slice(0, 100);
	const country = String(body.country || "").trim().slice(0, 100);
	const start = String(body.start || "").trim().slice(0, 40);
	const end = String(body.end || "").trim().slice(0, 40);
	const topics = Array.isArray(body.topics) ? body.topics.map((t) => String(t)).slice(0, 20) : [];
	const notes = String(body.notes || "").trim().slice(0, 500);
	const submitterEmail = String(body.submitterEmail || "").trim().slice(0, 200);
	const token = String(body.turnstileToken || "");

	if (!name || !url || !city || !country || !start || !token) {
		return json({ ok: false, error: "Please fill in the required fields." }, 400);
	}
	if (submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
		return json({ ok: false, error: "That doesn't look like a valid email." }, 400);
	}

	if (!(await verifyTurnstile(token, request, env))) {
		return json({ ok: false, error: "Verification failed, please try again." }, 400);
	}

	const lines = [
		`Event: ${name}`,
		`Website: ${url}`,
		`Location: ${city}, ${country}`,
		`Dates: ${start}${end ? ` to ${end}` : ""}`,
		topics.length ? `Topics: ${topics.join(", ")}` : null,
		notes ? `Notes: ${notes}` : null,
		submitterEmail ? `Submitter email: ${submitterEmail}` : null,
	].filter(Boolean);

	const to = env.DESTINATION_EMAIL || "contact@techeventsmap.com";
	try {
		await env.EMAIL.send({
			to,
			from: "contact@techeventsmap.com",
			reply_to: submitterEmail || undefined,
			subject: `Tech Events Map submission: ${name}`,
			text: lines.join("\n"),
			html: `<p>${lines.map(escapeHtml).join("<br>")}</p>`,
		});
	} catch {
		return json({ ok: false, error: "Could not send suggestion, please email hello@techeventsmap.com directly." }, 502);
	}

	return json({ ok: true, message: "Thanks, I'll review it and add it to the map." });
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === "/api/contact" && request.method === "POST") {
			return handleContact(request, env);
		}
		if (url.pathname === "/api/submit-event" && request.method === "POST") {
			return handleSubmitEvent(request, env);
		}

		return env.ASSETS.fetch(request);
	},
};
