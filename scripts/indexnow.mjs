// Tell IndexNow (Bing, Yandex, Seznam, Naver) about new URLs after a deploy.
//   node scripts/indexnow.mjs prepare   before deploy: save URLs in dist but not on the live site
//   node scripts/indexnow.mjs submit    after deploy: send the saved URLs
//   node scripts/indexnow.mjs all       send every URL in dist (one-off)
// The key is public by design: it is also served at /<key>.txt so engines can verify ownership.
// Failures only warn, they never fail a deploy.
import fs from "node:fs";

const HOST = "techeventsmap.com";
const KEY = "826a82bbaa187692c0ce90a9ba39884e";
const SAVED = "indexnow-new-urls.json";
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const built = () => locs(fs.readFileSync("dist/sitemap-0.xml", "utf8"));

async function send(urls) {
	if (!urls.length) return console.log("IndexNow: nothing new to submit");
	const res = await fetch("https://api.indexnow.org/indexnow", {
		method: "POST",
		headers: { "content-type": "application/json; charset=utf-8" },
		body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
	});
	console.log(`IndexNow: submitted ${urls.length} URLs, HTTP ${res.status}`);
}

try {
	const mode = process.argv[2];
	if (mode === "prepare") {
		const live = new Set(locs(await (await fetch(`https://${HOST}/sitemap-0.xml`)).text()));
		fs.writeFileSync(SAVED, JSON.stringify(built().filter((u) => !live.has(u))));
	} else if (mode === "submit") {
		await send(JSON.parse(fs.readFileSync(SAVED, "utf8")));
	} else if (mode === "all") {
		await send(built());
	} else {
		console.log("usage: indexnow.mjs prepare|submit|all");
	}
} catch (err) {
	console.warn("IndexNow skipped:", err.message);
}
