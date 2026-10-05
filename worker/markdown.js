// Minimal HTML to Markdown converter for content negotiation (Accept: text/markdown).
// Regex based, tuned for this site's simple Astro output. Not a general HTML parser.

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function decode(s) {
	return s
		.replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m])
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function strip(s) {
	return s.replace(/<[^>]+>/g, "");
}

export function htmlToMarkdown(html) {
	const title = decode(strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "")).trim();
	const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
	let s = mainMatch ? mainMatch[0] : (html.match(/<body[\s\S]*<\/body>/i) || [html])[0];

	s = s
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<(script|style|svg|noscript|form|button|select|textarea|nav|header|footer|iframe|template)\b[\s\S]*?<\/\1>/gi, "")
		.replace(/<input\b[^>]*>/gi, "");

	// Code and inline
	s = s
		.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => `\n\n\`\`\`\n${decode(strip(c))}\n\`\`\`\n\n`)
		.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${strip(c)}\``)
		.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
		.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "_$2_")
		.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
			const t = strip(text).replace(/\s+/g, " ").trim();
			return t ? `[${t}](${href})` : "";
		})
		.replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, (_, alt) => (alt ? `![${alt}]` : ""));

	// Headings
	s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(Number(n))} ${strip(t).replace(/\s+/g, " ").trim()}\n\n`);

	// Tables
	s = s.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
		const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) =>
			[...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => strip(c[1]).replace(/\s+/g, " ").replace(/\|/g, "\\|").trim()),
		).filter((r) => r.length);
		if (!rows.length) return "";
		const line = (r) => `| ${r.join(" | ")} |`;
		return `\n\n${line(rows[0])}\n${line(rows[0].map(() => "---"))}\n${rows.slice(1).map(line).join("\n")}\n\n`;
	});

	// Lists, paragraphs, breaks
	s = s
		.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${strip(t).replace(/\s+/g, " ").trim()}`)
		.replace(/<\/(ul|ol)>/gi, "\n\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|section|article|blockquote|dl|dd|dt|figure|figcaption)>/gi, "\n\n");

	s = decode(strip(s))
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	const hasH1 = /^# /m.test(s);
	return `${!hasH1 && title ? `# ${title}\n\n` : ""}${s}\n`;
}

export function wantsMarkdown(request) {
	if (request.method !== "GET" && request.method !== "HEAD") return false;
	const accept = request.headers.get("accept") || "";
	// Honour q-values: markdown must be listed and rank at least as high as text/html.
	const q = (type) => {
		for (const part of accept.split(",")) {
			const [t, ...params] = part.trim().split(";");
			if (t.trim().toLowerCase() === type) {
				const qp = params.find((p) => p.trim().startsWith("q="));
				return qp ? Number(qp.trim().slice(2)) : 1;
			}
		}
		return -1;
	};
	const md = q("text/markdown");
	return md > 0 && md >= q("text/html");
}

// Rough estimate (~4 chars per token), header is advisory.
export function estimateTokens(text) {
	return Math.ceil(text.length / 4);
}
