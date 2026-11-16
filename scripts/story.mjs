// Instagram-Story-Bild (1080x1920) für einen Deal. Nico postet es in der App mit Link-Sticker.
// Aufruf: CHROMIUM=... node scripts/story.mjs <dealId> [chip] [outDir]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_FROM || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [id, chip = "💎 Perle des Tages", out = "/tmp/stories"] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(process.env.DEALS_JSON || `${ROOT}/src/data/deals.json`, "utf8")); // DEALS_JSON: z. B. Live-Datei mit auto-Deals
const d = D.deals.find(x => x.id === id);
if (!d) { console.error("Deal nicht gefunden:", id); process.exit(1); }
const SH = { notebooksbilliger: "notebooksbilliger", coolblue: "Coolblue", otto: "OTTO", alternate: "Alternate", myprotein: "Myprotein", comspot: "comspot", amazon: "Amazon", xiaomi: "Xiaomi", ebay: "eBay" };
const shop = SH[d.shop || "amazon"] || d.shop;
const amazon = (d.shop || "amazon") === "amazon";
const pct = d.was ? Math.round(100 - (100 * d.now) / d.was) : null;
const eur = v => v.toLocaleString("de-DE", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const font = f => `url(file://${ROOT}/src/assets/fonts/${f})`;
const img = d.image && /^https?:/.test(d.image) && !/amazon/.test(d.image) ? d.image : (d.image && fs.existsSync(`${ROOT}/src${d.image}`) ? `file://${ROOT}/src${d.image}` : null);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:B;src:${font("bricolage.woff2")};font-weight:200 800}
@font-face{font-family:I;src:${font("instrument-500.woff2")};font-weight:500}
@font-face{font-family:I;src:${font("instrument-700.woff2")};font-weight:700}
*{box-sizing:border-box;margin:0}body{width:1080px;height:1920px;font-family:I;color:#0E1C1B;background:linear-gradient(160deg,#0B776B,#074C45);position:relative;overflow:hidden}
.c1{position:absolute;right:-160px;top:-120px;width:620px;height:620px;border-radius:50%;background:rgba(255,255,255,.07)}
.c2{position:absolute;left:-200px;bottom:120px;width:520px;height:520px;border-radius:50%;background:rgba(255,255,255,.05)}
.top{position:absolute;top:220px;left:90px;right:90px;display:flex;align-items:center;gap:22px;color:#fff;font:750 52px B}
.top img{width:84px;height:84px;border-radius:50%}
.card{position:absolute;left:70px;right:70px;top:420px;background:#fff;border-radius:48px;padding:64px 64px 56px;box-shadow:0 30px 80px rgba(0,0,0,.25)}
.chip{display:inline-block;background:#D6EDE8;color:#0B776B;font:700 40px I;padding:14px 30px;border-radius:40px}
.brand{margin-top:40px;font:700 38px I;color:#55645F;text-transform:uppercase;letter-spacing:.04em}
h1{margin-top:12px;font:750 76px/1.06 B}
.pic{margin:36px auto 0;height:420px;display:flex;align-items:center;justify-content:center}.pic img{max-height:420px;max-width:100%;object-fit:contain}
.price{margin-top:40px;display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap}
.now{font:800 150px/1 B;color:#0B776B}.was{font:500 52px I;color:#55645F;text-decoration:line-through;margin-bottom:18px}
.pct{position:absolute;right:56px;top:56px;background:#D63B23;color:#fff;font:800 64px B;padding:18px 30px;border-radius:30px;transform:rotate(4deg)}
.shop{margin-top:26px;font:700 40px I;color:#0E1C1B}
.sticker{position:absolute;left:90px;right:90px;bottom:300px;border:5px dashed rgba(255,255,255,.7);border-radius:40px;height:190px;display:flex;align-items:center;justify-content:center;color:#fff;font:750 54px B;text-align:center}
.foot{position:absolute;bottom:150px;left:0;right:0;text-align:center;color:#CFEDE7;font:700 40px I}
</style></head><body><div class="c1"></div><div class="c2"></div>
<div class="top"><img src="file://${ROOT}/src/assets/logo.png">perldeals</div>
<div class="card">${pct && !amazon ? `<div class="pct">−${pct} %</div>` : ""}<div class="chip">${esc(chip)}</div>
<div class="brand">${esc(d.brand || "")}</div><h1>${esc(d.title.de.replace(/\s*\(.*?\)\s*$/, ""))}</h1>
${img ? `<div class="pic"><img src="${img}"></div>` : ""}
${amazon ? `<div class="price"><div class="now" style="font-size:96px">${pct ? `−${pct} %` : "Deal"}</div><div class="was" style="text-decoration:none">Preis auf perldeals</div></div>` : `<div class="price"><div class="now">${eur(d.now)}</div>${d.was ? `<div class="was">${eur(d.was)}</div>` : ""}</div>`}
<div class="shop">bei ${esc(shop)} · ${/UVP/.test((d.note && d.note.de) || "") ? "Vergleich mit UVP" : "geprüft am Preisverlauf"}</div></div>
<div class="sticker">👆 Link hier antippen</div>
<div class="foot">perldeals.com · Anzeige</div></body></html>`;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const tmp = `${out}/.story-${id}.html`; fs.writeFileSync(tmp, html);
await p.goto("file://" + tmp, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
const file = `${out}/story-${id}.jpg`;
await p.screenshot({ path: file, type: "jpeg", quality: 90 });
await b.close(); fs.unlinkSync(tmp);
console.log(file);
console.log(`https://perldeals.com/deals/${id}/?utm_source=instagram&utm_medium=story`);
