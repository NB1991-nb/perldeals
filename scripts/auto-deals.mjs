// Wählt automatische Deals aus den Awin-Feed-Kandidaten (src/data/awin-candidates.json) und schreibt src/data/auto-deals.json.
// Läuft in CI VOR scripts/images.mjs, damit die Produktbilder auf unseren Server geladen werden (CSP: nur eigene Bilder).
// Regeln: mind. 7 Vortage eigener Preisverlauf (seit 07.11.; vorher 3 – neue Shops wie GSMnet zeigten nach 3 Tagen überhöhte Listenpreise), Preis ≥ 15 % unter dem Median der tatsächlich verlangten Preise, Shop zeigt selbst einen Vorpreis.
import fs from "node:fs";
const IN = "src/data/awin-candidates.json", OUT = "src/data/auto-deals.json";
if (!fs.existsSync(IN)) { fs.writeFileSync(OUT, JSON.stringify({ deals: [] })); console.log("Auto-Deals: keine Kandidaten"); process.exit(0); }
const F = JSON.parse(fs.readFileSync(IN, "utf8"));
const BAD = /leder|daunen|wolle|pelz|fell|seide|kaschmir|torro|schuh|jacke|hose|kleid|shirt|pullover|socken|wäsche|lebensmittel|wein|bier|fleisch|wurst|käse|tabak|e-zigarette|liquid|waffe|messer|ersatzteil|display mit touchscreen|werbepaket|heißluftgebläse für|reparatur/i;
const EXCL = fs.existsSync("src/data/auto-exclude.json") ? (JSON.parse(fs.readFileSync("src/data/auto-exclude.json", "utf8")).names || []).map(x => x.match.toLowerCase()) : [];
const SKIPSHOP = new Set(["myprotein", "100percentpure", "nexalia", "luxecosy", "telekom"]);
const CATMAP = [[/saugrobot|staubsaug|wischrobot|mähroboter|rasenmäher|garten|grill|pool|pergola|terrasse|bewässer/i, "garden"], [/küche|kaffee|espresso|mikrowelle|backofen|kühlschrank|herd|mixer|airfryer|heißluft|toaster|wasserkocher/i, "kitchen"], [/kopfhörer|headset|earbuds|in-ear/i, "headphones"], [/lautsprecher|soundbar|speaker/i, "speaker"], [/fernseh|\btv\b|beamer|projektor|oled-tv|qled/i, "tv"], [/smartphone|handy|iphone|galaxy s|pixel \d|hülle|ladegerät|powerbank/i, "phone"], [/smartwatch|fitness-tracker/i, "watch"], [/kamera|überwachung|türklingel|smart home|steckdose|thermostat|alarm/i, "smarthome"], [/werkzeug|akkuschrauber|bohr|säge|schleif|kompressor/i, "tools"], [/lego|spielzeug|puzzle|brettspiel|modellbau|playmobil|konsole|playstation|xbox|nintendo/i, "toys"], [/fahrrad|e-bike|scooter|fitness|sport|camping|zelt/i, "sport"], [/notebook|laptop|monitor|\bpc\b|computer|ssd|festplatte|grafikkarte|prozessor|mainboard|drucker|router|switch|tastatur|maus|software|tablet|speicher|netzwerk/i, "computer"]];
const slug = s => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "");
const per = {};
const picked = (F.candidates || []).filter(c => c.inStock !== false && !SKIPSHOP.has(c.shop) && c.historyDays >= 7 && c.histPct >= 15 && c.strikeBasis === "Shop-Vorpreis" && c.price >= 15
    && !BAD.test(`${c.name} ${c.cat}`) && !EXCL.some(m => c.name.toLowerCase().includes(m)) && /^https:\/\//.test(c.url || "") && /^https?:\/\//.test(c.img || ""))
  .sort((a, b) => (b.histMedian - b.price) - (a.histMedian - a.price))
  .filter(c => (per[c.shop] = (per[c.shop] || 0) + 1) <= 60).slice(0, 150); // 07.11.: Limit 20 je Shop schnitt 40 geprüfte nbb-Deals ab (Nico: zu wenige Deals)
const ids = new Set();
const deals = [];
for (const c of picked) {
  const id = `auto-${c.shop}-${slug(c.name)}`.replace(/-+$/, ""); if (ids.has(id)) continue; ids.add(id);
  deals.push({ id, shop: c.shop, url: c.url, brand: c.brand || "", cat: (CATMAP.find(([re]) => re.test(`${c.cat} ${c.name}`)) || [null, "home"])[1],
    now: c.price, was: c.histMedian, days: c.historyDays, pct: c.histPct, title: c.name.slice(0, 120), imageSrc: c.img.replace(/^http:/, "https:") });
}
fs.writeFileSync(OUT, JSON.stringify({ fetched: F.fetched, deals }, null, 1));
console.log(`Auto-Deals ausgewählt: ${deals.length}`);
