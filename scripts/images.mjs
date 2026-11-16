// Downloads product images of affiliate partner shops (deals with "imageSrc") to src/assets/products,
// so the site serves them itself: no third-party requests from visitors. Runs in CI before the build.
// Amazon images are NOT handled here (only via the Creators API, hotlinked as required).
import fs from "node:fs";
const DIR = "src/assets/products";
fs.mkdirSync(DIR, { recursive: true });
const deals = JSON.parse(fs.readFileSync("src/data/deals.json", "utf8")).deals.filter(d => d.imageSrc && !d.asin)
  .concat(fs.existsSync("src/data/auto-deals.json") ? JSON.parse(fs.readFileSync("src/data/auto-deals.json", "utf8")).deals || [] : []);
let ok = 0;
for (const d of deals) {
  if (fs.readdirSync(DIR).some(f => f.startsWith(d.id + "."))) { ok++; continue; }
  try {
    let r = await fetch(d.imageSrc, { headers: { "User-Agent": "perldeals-image-fetch/1.0 (+https://perldeals.com)" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) r = await fetch(d.imageSrc, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36", "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8", "Referer": new URL(d.url || ((d.link || "").includes("ued=") ? decodeURIComponent(d.link.split("ued=")[1].split("&")[0]) : d.imageSrc)).origin + "/" }, signal: AbortSignal.timeout(15000) });
    const type = r.headers.get("content-type") || "";
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[type.split(";")[0]];
    if (!r.ok || !ext) { console.error(`Bild ${d.id}: ${r.status} ${type}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3_000_000) { console.error(`Bild ${d.id}: zu groß`); continue; }
    fs.writeFileSync(`${DIR}/${d.id}.${ext}`, buf); ok++;
  } catch (e) { console.error(`Bild ${d.id}: ${e.message}`); }
}
console.log(`Partner-Bilder: ${ok}/${deals.length}`);
