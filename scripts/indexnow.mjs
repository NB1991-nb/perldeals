// Pings IndexNow with all sitemap URLs after a deploy (Bing & co. crawl new/changed pages within minutes).
import fs from "node:fs";
const key = (fs.readFileSync("build.mjs", "utf8").match(/INDEXNOW_KEY = "([a-f0-9]+)"/) || [])[1];
const urls = [...fs.readFileSync("dist/sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (!key || !urls.length) { console.log("IndexNow: nichts zu tun"); process.exit(0); }
const r = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "perldeals.com", key, keyLocation: `https://perldeals.com/${key}.txt`, urlList: urls.slice(0, 10000) })
});
console.log(`IndexNow: ${urls.length} URLs gemeldet, Antwort ${r.status}`);
