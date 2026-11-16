// Renders Pinterest pins (1000x1500) and social preview images (1200x630) for every
// buying guide and comparison. Our own graphics only (no shop or manufacturer images),
// no prices on the image, so pins stay correct for years.
// Run locally: node scripts/pins.mjs   (needs playwright; writes src/assets/pins and src/assets/og)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(process.env.PW_FROM || import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, "src/data", f), "utf8"));
const DEALS = rd("deals.json").deals, GUIDES = rd("guides.json"), ARTICLES = rd("articles.json");
const ICONS = Object.fromEntries([...fs.readFileSync(path.join(ROOT, "build.mjs"), "utf8").matchAll(/^\s+(\w+):\s*\{icon:'([^']+)'/gm)].map(m => [m[1], m[2]]));
const FONTS = path.join(ROOT, "src/assets/fonts");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const svg = (cat, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#0E1C1B" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${ICONS[cat]}</svg>`;

const font = f => `url(data:font/woff2;base64,${fs.readFileSync(path.join(FONTS, f)).toString("base64")}) format("woff2")`;
const css = `
@font-face{font-family:B;src:${font('bricolage.woff2')};font-weight:200 800}
@font-face{font-family:I;src:${font('instrument-500.woff2')};font-weight:500}
@font-face{font-family:I;src:${font('instrument-700.woff2')};font-weight:700}
@font-face{font-family:M;src:${font('plexmono-600.woff2')};font-weight:600}
*{margin:0;box-sizing:border-box}
body{width:var(--w);height:var(--h);overflow:hidden;font-family:I;color:#0E1C1B;
 background:radial-gradient(110% 70% at 12% 8%,rgba(255,255,255,.9),transparent 55%),linear-gradient(140deg,#E7F1ED,#F2E8EE 52%,#E5ECF7)}
.eyebrow{font:600 var(--eb) M;letter-spacing:.08em;text-transform:uppercase;color:#0B776B}
h1{font:800 var(--h1) / 1.02 B;letter-spacing:-.025em}
.pearl{border-radius:50%;background:radial-gradient(circle at 36% 32%,#fff 0 18%,#E3EEF5 40%,#EADCE6 70%,#9FC4BA);box-shadow:inset -6px -8px 18px rgba(14,28,27,.12)}
.brand{display:flex;align-items:center;gap:14px;font:800 var(--brand) B;letter-spacing:-.02em}
.tile{background:rgba(255,255,255,.72);border:1px solid rgba(14,28,27,.08);border-radius:28px;box-shadow:0 18px 50px -24px rgba(14,28,27,.35)}
.list{list-style:none;display:grid;gap:20px}
.list li{display:flex;gap:14px;font:500 var(--li)/1.3 I}
.list li b{font-weight:700}
.tick{flex:none;width:40px;height:40px;border-radius:50%;background:#0B776B;color:#fff;display:grid;place-items:center;font:700 20px I;margin-top:2px}
.cta{background:#0B776B;color:#fff;border-radius:999px;font:700 var(--cta) I;padding:18px 30px;display:inline-block}
`;

function pinHtml({ eyebrow, title, cats, items, cta }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
:root{--w:1000px;--h:1500px;--eb:24px;--h1:${title.length > 60 ? 76 : title.length > 40 ? 88 : 100}px;--brand:44px;--li:36px;--cta:30px}
.wrap{position:absolute;inset:0;padding:80px 76px;display:flex;flex-direction:column;gap:44px}
.icons{display:flex;gap:30px;justify-content:center;align-items:center;flex:1;min-height:340px}
</style></head><body><div class="wrap">
<div class="brand"><span class="pearl" style="width:52px;height:52px"></span>perldeals</div>
<div><div class="eyebrow">${esc(eyebrow)}</div><h1 style="margin-top:18px">${esc(title)}</h1></div>
<div class="tile icons">${cats.map(c => svg(c, cats.length > 1 ? 190 : 320)).join("")}</div>
<ul class="list">${items.map(x => `<li><span class="tick">✓</span><span>${x}</span></li>`).join("")}</ul>
<div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center">
<span class="cta">${esc(cta)}</span><span style="font:600 26px M;color:#55645F">perldeals.com</span></div>
</div></body></html>`;
}

function ogHtml({ eyebrow, title, cats }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
:root{--w:1200px;--h:630px;--eb:20px;--h1:${title.length > 55 ? 54 : 64}px;--brand:34px}
.wrap{position:absolute;inset:0;padding:56px 64px;display:grid;grid-template-columns:1fr 330px;gap:48px;align-items:center}
</style></head><body><div class="wrap">
<div style="display:flex;flex-direction:column;gap:22px;height:100%">
<div class="brand"><span class="pearl" style="width:40px;height:40px"></span>perldeals</div>
<div style="margin-top:auto"><div class="eyebrow">${esc(eyebrow)}</div><h1 style="margin-top:14px">${esc(title)}</h1></div>
<div style="font:600 20px M;color:#55645F">perldeals.com</div></div>
<div class="tile" style="height:330px;display:grid;place-items:center">${svg(cats[0], 210)}</div>
</div></body></html>`;
}

const jobs = [];
for (const [id, G] of Object.entries(GUIDES)) {
  const d = DEALS.find(x => x.id === id); if (!d) continue;
  const name = d.title.de.split(",")[0].replace(/ (kabelloser|kabellose|Bluetooth-Lautsprecher|True-Wireless-In-Ears|Over-Ear-Kopfhörer|In-Ear-Kopfhörer mit ANC|Noise-Cancelling-Kopfhörer|Soundbar mit Subwoofer|Outdoor-Lautsprecher).*$/, "");
  const SHORT = { "msi-mag-321upx-qd-oled-4k-monitor": "MSI MAG 321UPX QD-OLED", "imou-cruiser-dual-kit": "Imou Cruiser Dual", "otto-samsung-waermepumpentrockner-dv9d5-cw": "Samsung Wärmepumpentrockner DV5000D", "anthbot-m5-maehroboter": "ANTHBOT M5 Mähroboter", "anthbot-m9-maehroboter": "ANTHBOT M9 Mähroboter", "myprotein-mikronisiertes-kreatin": "Myprotein Kreatin", "roborock-saros-10r": "Roborock Saros 10R" };
  const title = `${SHORT[id] || name}: Lohnt sich das?`;
  jobs.push({ id, kind: "guide", eyebrow: G.de.eyebrow, title, cats: [d.cat],
    items: G.de.plus.slice(0, 3).map(esc), cta: "Kaufberatung lesen" });
}
for (const [id, A] of Object.entries(ARTICLES)) {
  const picks = A.picks.map(p => DEALS.find(x => x.id === p)).filter(Boolean);
  const cats = [...new Set(picks.map(p => p.cat))];
  const notes = A.de.pickNotes || {};
  const items = picks.slice(0, 4).map(p => `<b>${esc(notes[p.id]?.label || p.brand)}:</b> ${esc(p.title.de.split(",")[0].replace(/ (Bluetooth-Lautsprecher|True-Wireless-In-Ears|Over-Ear-Kopfhörer|In-Ear-Kopfhörer mit ANC|kabelloser On-Ear-Kopfhörer|Soundbar mit Subwoofer|Outdoor-Lautsprecher|5\.1\.2 Soundbar|mit JBL-Strandtuch).*$/, ""))}`);
  const title = A.de.h1.split(":")[0];
  jobs.push({ id, kind: "article", eyebrow: A.de.eyebrow, title: title.length < 18 ? A.de.h1 : title, cats: cats.length ? [cats[0], cats[0], cats[0]].slice(0, Math.min(3, picks.length)) : ["phone"], items, cta: "Zum Vergleich" });
}

const optional = f => fs.existsSync(path.join(ROOT, "src/data", f)) ? rd(f) : null;
const BEST = optional("best.json") || {}, HUBS = optional("hubs.json");
for (const [id, B] of Object.entries(BEST)) {
  jobs.push({ id, kind: "best", eyebrow: B.de.eyebrow, title: B.de.h1.split(":")[0], cats: [B.cat, B.cat, B.cat],
    items: B.de.items.slice(0, 4).map(it => `<b>${esc(it.label)}:</b> ${esc(it.name)}`), cta: "Zur Bestenliste" });
}
if (HUBS) {
  const bf = HUBS.blackfriday.de;
  jobs.push({ id: "black-friday", kind: "hub", eyebrow: "Black Friday 2026", title: "Black Friday 2026: echte Deals statt Fake-Rabatte", cats: ["tv", "headphones", "toys"],
    items: bf.checklist.slice(0, 4).map(esc), cta: "Zur Black-Friday-Seite" });
  const g = HUBS.gifts;
  jobs.push({ id: "geschenke", kind: "hub", eyebrow: "Geschenkfinder", title: g.hub.de.h1.split(":")[0], cats: ["toys", "headphones", "kitchen"],
    items: Object.values(g.pages).slice(0, 4).map(x => esc(x.de.h1.split(":")[0])), cta: "Geschenk finden" });
  const giftCats = { "geschenke-unter-25-euro": "kitchen", "geschenke-unter-50-euro": "speaker", "geschenke-unter-100-euro": "headphones", "geschenke-fuer-gamer": "computer", "geschenke-fuer-kinder": "toys", "technik-geschenke": "watch" };
  for (const [id, P] of Object.entries(g.pages)) jobs.push({ id, kind: "gift", eyebrow: "Geschenkfinder", title: P.de.h1.split(":")[0], cats: [giftCats[id] || "toys"],
    items: P.de.tips.slice(0, 3).map(t => esc(t[0])), cta: "Ideen ansehen" });
  if (HUBS.seasons) for (const [id, S] of Object.entries(HUBS.seasons)) jobs.push({ id, kind: "season", eyebrow: S.de.eyebrow, title: S.de.h1.split(":")[0], cats: ["tv", "headphones", "kitchen"],
    items: S.de.checklist.slice(0, 4).map(esc), cta: "Zu den Deals" });
}
// coupon pages: one evergreen pin per shop with active codes
const CODES = (optional("codes.json") || []);
const codeList = Array.isArray(CODES) ? CODES : (CODES.codes || []);
const today = new Date().toISOString().slice(0, 10);
const shopsWithCodes = [...new Map(codeList.filter(c => !c.validUntil || c.validUntil >= today).map(c => [c.shop, c.shopName])).entries()];
for (const [shop, name] of shopsWithCodes) {
  const cs = codeList.filter(c => c.shop === shop && (!c.validUntil || c.validUntil >= today));
  const cat = (DEALS.find(d => (d.shop || "amazon") === shop) || { cat: "home" }).cat;
  jobs.push({ id: `gutschein-${shop}`, kind: "coupon", shop, eyebrow: "Gutscheine · geprüft", title: `${name} Gutschein & Rabattcode`, cats: [cat],
    items: cs.slice(0, 3).map(c => esc(c.title.de)), cta: "Codes ansehen" });
}
// topic pins (Nico 29.10.: immer neue Pins): Themenseiten mit Partner-Shops
const TOPICS = optional("topics.json") || [];
const GROUPCAT = { reisen: "travel", energie: "garden", foto: "computer", geschenke: "toys", beauty: "beauty", haushalt: "home", kueche: "kitchen", computer: "computer", smarthome: "smarthome", sport: "sport", garten: "garden", werkzeug: "tools", tv: "tv", audio: "speaker", phone: "phone", spielzeug: "toys", vegan: "vegan" };
for (const T of TOPICS.filter(T => Array.isArray(T.shops) && T.shops.length && T.tips.length >= 4)) {
  const cat = T.cat || GROUPCAT[T.group] || "home";
  const short = s => { const x = s.split(/[:.;]/)[0].trim(); return x.length > 72 ? x.slice(0, 68).replace(/\s+\S*$/, "") + " …" : x; };
  jobs.push({ id: `thema-${T.slug}`, kind: "topic", slug: T.slug, eyebrow: "Angebote · geprüft", title: T.h, cats: [cat], items: T.tips.slice(0, 3).map(s => esc(short(s))), cta: "Angebote ansehen" });
}
// Pokémon-Händler-Leitfaden: ein Pin je Kapitel (Nico 01.11.)
const PH = optional("pokemon-haendler.json");
if (PH) {
  jobs.push({ id: "pokemon-haendler", kind: "page", url: "/reseller/pokemon-haendler/", eyebrow: "Pokémon für Händler", title: "Pokémon-Karten finden & bewerten: der Leitfaden", cats: ["pokemon"], items: PH.chapters.slice(0, 3).map(c => esc(c.short)), cta: "Zum Leitfaden" });
  jobs.push({ id: "karten-ankauf", kind: "page", url: "/reseller/karten-ankauf/", eyebrow: "Ankauf · Pokémon, One Piece, Yu-Gi-Oh", title: "Pokémon-Karten verkaufen: Ankauf per WhatsApp", cats: ["pokemon"], items: ["Einzelkarten, Sammlungen &amp; Bulk", "Gegradete Karten &amp; Displays", "Angebot kostenlos &amp; unverbindlich"], cta: "Karten anbieten" });
  { const AK = optional("ankauf.json"); if (AK) for (const a of AK.pages) jobs.push({ id: `ankauf-${a.slug}`, kind: "page", url: `/reseller/ankauf/${a.slug}/`, eyebrow: "Ankauf · deutschlandweit", title: `${a.what} verkaufen`, cats: [/karten/.test(a.slug) ? "pokemon" : "toys"], items: a.buy.slice(0, 3).map(s => esc(s.length > 64 ? s.slice(0, 60).replace(/\s+\S*$/, "") + " …" : s)), cta: "Jetzt anbieten" }); }
  jobs.push({ id: "ebay-shop", kind: "page", url: "/reseller/ebay-shop/", eyebrow: "perldeals auf eBay", title: "Sammelkarten, Konsolen & Live-Auktionen auf eBay", cats: ["pokemon"], items: ["Pokémon- & One-Piece-Karten", "Retro-Konsolen & Technik", "Live-Auktionen bei eBay Live"], cta: "Jetzt folgen" });
  jobs.push({ id: "reseller-rechner", kind: "page", url: "/reseller/rechner/", eyebrow: "Rechner für Reseller", title: "Verkaufspreis nach eBay- & Amazon-Gebühren berechnen", cats: ["toys"], items: ["Nötiger VK mit Wunschmarge", "Max. Ankaufspreis", "eBay, Amazon, Cardmarket im Vergleich"], cta: "Zum Rechner" });
  { const WI = optional("wissen.json"); if (WI) for (const w of WI.items) jobs.push({ id: `wissen-${w.slug}`, kind: "page", url: `/wissen/${w.slug}/`, eyebrow: "perldeals Wissen", title: w.title.split(":")[0], cats: [/pokemon/.test(w.slug) ? "pokemon" : "home"], items: w.sections.slice(0, 3).map(s => { const x = s[0].replace(/^\d+\.\s*/, ""); return esc(x.length > 64 ? x.slice(0, 60).replace(/\s+\S*$/, "") + " …" : x); }), cta: "Jetzt lesen" }); }
  { for (const f of ["wissen-extra.json", "vegan-guides.json"]) { const X = optional(f); if (X) for (const w of X.items) if (!jobs.some(j => j.id === `wissen-${w.slug}`)) jobs.push({ id: `wissen-${w.slug}`, kind: "page", url: `/wissen/${w.slug}/`, eyebrow: f.startsWith("vegan") ? "Vegan-Ratgeber" : "perldeals Wissen", title: w.title.split(":")[0], cats: [f.startsWith("vegan") ? "vegan" : "toys"], items: (w.sections || []).slice(0, 3).map(x => esc(String(x.h || x[0] || "").slice(0, 60))).filter(Boolean), cta: "Ratgeber lesen" }); } }
  { const VG = optional("vegan-guides.json"); if (VG) jobs.push({ id: "vegan-ratgeber", kind: "page", url: "/vegan-ratgeber/", eyebrow: "Vegan leben", title: "Vegan-Ratgeber: Einstieg, Nährstoffe, Einkauf", cats: ["vegan"], items: ["B12, Protein & Co. laut DGE", "Günstig vegan einkaufen", "Siegel & versteckte Zutaten"], cta: "Ratgeber lesen" }); }
  { const WDJ = optional("wasserdicht.json"); if (WDJ) { jobs.push({ id: "wasserdicht", kind: "page", url: "/wasserdicht/", eyebrow: "Schutzklassen erklärt", title: "Ist mein Handy wasserdicht? IP67 & IP68", cats: ["phone"], items: ["Samsung, iPhone, Pixel & Co.", "Laut Herstellerangabe", "Dusche, Pool, Meer: was geht"], cta: "Modell prüfen" });
    for (const m of WDJ.items) jobs.push({ id: `wd-${m.slug}`, kind: "page", url: `/wasserdicht/${m.slug.replace(/-wasserdicht$/, "")}/`, eyebrow: `Schutzklasse ${m.ip}`, title: `${m.category === "earbuds" ? "Sind die" : m.category === "watch" ? "Ist die" : "Ist das"} ${m.model} wasserdicht?`, cats: [m.category === "watch" ? "watch" : m.category === "earbuds" ? "headphones" : "phone"], items: (m.dos || []).slice(0, 3).map(x => esc(x.slice(0, 60))), cta: "Antwort lesen" }); } }
  { const ADV = optional("adventskalender.json"); if (ADV) for (const c of ADV.cats.filter(c => c.items.length >= 2)) jobs.push({ id: `advent-${c.slug}`, kind: "page", url: `/adventskalender-angebote/${c.slug}/`, eyebrow: "Adventskalender 2026", title: c.h1.split(":")[0], cats: [{lego:"toys", pokemon:"toys", beauty:"beauty", vegan:"vegan", fitness:"sport", technik:"computer", kinder:"toys"}[c.slug] || "toys"], items: c.items.slice(0, 3).map(x => esc(x.name.slice(0, 55))), cta: "Kalender ansehen" }); }
  for (const c of PH.chapters) jobs.push({ id: `pkm-${c.slug}`, kind: "page", url: `/reseller/pokemon-haendler/${c.slug}/`, eyebrow: "Pokémon-Händler-Leitfaden", title: c.title.split(":")[0], cats: ["pokemon"], items: (c.blocks.find(b => b.list) || { list: c.faq.map(f => f[0]) }).list.slice(0, 3).map(s => { const x = s.split(/[:.;(]/)[0].trim(); return esc(x.length > 64 ? x.slice(0, 60).replace(/\s+\S*$/, "") + " …" : x); }), cta: "Kapitel lesen" });
}
// deal pins: strongest new deals (no price on the image, so the pin stays correct)
const age = d => (Date.now() - new Date(d.added).getTime()) / 36e5;
const pctOf = d => Math.round((1 - d.now / d.was) * 100);
for (const d of DEALS.filter(d => age(d) < 72 && pctOf(d) >= 15).sort((a, b) => pctOf(b) - pctOf(a)).slice(0, 40)) {
  const name = d.title.de.split(",")[0].replace(/\s*\([^)]*\)\s*$/, "");
  jobs.push({ id: `deal-${d.id}`, kind: "deal", deal: d.id, noOg: true, eyebrow: `Geprüfter Deal · ${d.shopName || "Amazon.de"}`, title: name, cats: [d.cat],
    items: ["Preis mit Vorpreis verglichen", "Kein Fake-Rabatt", "Preisalarm kostenlos"], cta: "Zum Deal" });
}

const out = { pins: path.join(ROOT, "src/assets/pins"), og: path.join(ROOT, "src/assets/og") };
Object.values(out).forEach(d => fs.mkdirSync(d, { recursive: true }));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
for (const j of jobs) {
  await page.setViewportSize({ width: 1000, height: 1500 });
  await page.setContent(pinHtml(j), { waitUntil: "load" }); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out.pins, `${j.id}.jpg`), type: "jpeg", quality: 90 });
  if (j.noOg) continue;
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml(j), { waitUntil: "load" }); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out.og, `${j.id}.jpg`), type: "jpeg", quality: 85 });
}
// share images for pages without own pin (home, categories, indexes, advisor)
const CATNAMES = Object.fromEntries([...fs.readFileSync(path.join(ROOT, "build.mjs"), "utf8").matchAll(/^\s+(\w+):\s*\{icon:'[^']+', de:\["([^"]+)"/gm)].map(m => [m[1], m[2]]));
const ogOnly = [
  { id: "default", eyebrow: "Geprüfte Deals · Kaufberatung", title: "Nur die Perlen unter den Deals", cats: ["headphones"] },
  { id: "kaufberatung", eyebrow: "Kaufberatung", title: "Lohnt sich das? Ehrliche Kaufberatung", cats: ["watch"] },
  { id: "bestenliste", eyebrow: "Bestenlisten 2026", title: "Welches Gerät ist das beste?", cats: ["smarthome"] },
  { id: "berater", eyebrow: "KI-Kaufberater", title: "Sag uns, was du suchst", cats: ["phone"] },
  ...Object.entries(CATNAMES).map(([k, n]) => ({ id: `cat-${k}`, eyebrow: "Deals des Tages", title: `${n}: aktuelle Angebote`, cats: [k] }))
];
await page.setViewportSize({ width: 1200, height: 630 });
for (const j of ogOnly) {
  await page.setContent(ogHtml(j), { waitUntil: "load" }); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out.og, `${j.id}.jpg`), type: "jpeg", quality: 85 });
}
await browser.close();
fs.writeFileSync(path.join(ROOT, "src/data/pins.json"), JSON.stringify(Object.fromEntries(jobs.map(j => [j.id, { kind: j.kind, title: j.title, ...(j.deal ? { deal: j.deal } : {}), ...(j.shop ? { shop: j.shop } : {}), ...(j.slug ? { slug: j.slug } : {}), ...(j.url ? { url: j.url } : {}) }])), null, 1));
console.log(`${jobs.length} Pins und Vorschaubilder erstellt.`);
