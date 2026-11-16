// Builds a share image (1200x630 JPEG, no EXIF, small) for every deal with a downloaded product image.
// WhatsApp/Facebook skip og:images that are too big (e.g. 700 KB PNG) or oddly sized; this gives them a clean card.
// Runs in CI after scripts/images.mjs. Needs "sharp" (installed in the workflow with --no-save).
import fs from "node:fs";
let sharp;
try { sharp = (await import("sharp")).default; } catch { console.log("og-deals: sharp fehlt, übersprungen"); process.exit(0); }
const PROD = "src/assets/products", OUT = "src/assets/og/deal";
fs.mkdirSync(OUT, { recursive: true });
const deals = JSON.parse(fs.readFileSync("src/data/deals.json", "utf8")).deals
  .concat(fs.existsSync("src/data/auto-deals.json") ? JSON.parse(fs.readFileSync("src/data/auto-deals.json", "utf8")).deals || [] : []); // 10.11.: auch Auto-Deals (Facebook kann kein AVIF und nahm sonst ein falsches Bild)
const files = fs.existsSync(PROD) ? fs.readdirSync(PROD) : [];
let n = 0;
for (const d of deals) {
  const out = `${OUT}/${d.id}.jpg`;
  if (fs.existsSync(out)) continue;
  const f = files.find(x => x.startsWith(d.id + "."));
  if (!f) continue;
  try {
    const prod = await sharp(`${PROD}/${f}`).flatten({ background: "#ffffff" })
      .resize(1100, 570, { fit: "contain", background: "#ffffff" }).toBuffer();
    await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#ffffff" } })
      .composite([{ input: prod, gravity: "center" }])
      .jpeg({ quality: 82, mozjpeg: true, progressive: false }).toFile(out);
    n++;
  } catch (e) { console.error(`og-deals ${d.id}: ${e.message}`); }
}
console.log(`og-deals: ${n} neu`);
