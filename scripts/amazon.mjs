// Fetches product images, current prices, Amazon's own reference price (savingBasis) and availability
// from the Amazon Creators API for every ASIN in src/data/deals.json and writes src/data/amazon-cache.json.
// Also runs a few SearchItems queries (min. 20 % saving) and writes src/data/amazon-candidates.json,
// which the build publishes as /data/amazon-kandidaten.json for the deal editor (no scraping of amazon.de).
// Runs in GitHub Actions before the build. Credentials come only from repository secrets.
// Amazon's terms: images and prices must come from the API, be refreshed at least every 24 h
// and be shown with a timestamp; images are hotlinked, never copied.
import fs from "node:fs";

const env = process.env;
const pick = (...k) => k.map(x => env[x]).find(v => v && v.trim());
const id = pick("AMAZON_CREDENTIAL_ID", "AMAZON_CLIENT_ID", "CREATORS_CREDENTIAL_ID", "CREATORS_API_CREDENTIAL_ID", "AMAZON_ACCESS_KEY");
const secret = pick("AMAZON_CREDENTIAL_SECRET", "AMAZON_CLIENT_SECRET", "CREATORS_CREDENTIAL_SECRET", "CREATORS_API_CREDENTIAL_SECRET", "AMAZON_SECRET_KEY");
const OUTFILE = "src/data/amazon-cache.json";
// Diagnose without secrets: which variable names are set, token/HTTP status codes
const STATUS = { at: new Date().toISOString(), envSet: Object.keys(env).filter(k => /^(AMAZON|CREATORS)_/.test(k) && env[k]).sort(), token: {}, getItems: [] };
const saveStatus = () => fs.writeFileSync("src/data/amazon-status.json", JSON.stringify(STATUS, null, 1));
if (!id || !secret) { STATUS.result = "keine Zugangsdaten"; saveStatus(); console.log("Amazon Creators API nicht eingerichtet, übersprungen."); process.exit(0); }

const deals = JSON.parse(fs.readFileSync("src/data/deals.json", "utf8"));
const asins = [...new Set(deals.deals.map(d => d.asin).filter(Boolean))];

const TOKEN = {
  "2.1": "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token",
  "2.2": "https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token",
  "2.3": "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token",
  "3.1": "https://api.amazon.com/auth/o2/token",
  "3.2": "https://api.amazon.co.uk/auth/o2/token",
  "3.3": "https://api.amazon.co.jp/auth/o2/token"
};
const versions = env.AMAZON_API_VERSION ? [env.AMAZON_API_VERSION] : ["3.2", "2.2", "3.1", "2.1", "2.3"];

async function token(v) {
  const lwa = v.startsWith("3.");
  const body = { grant_type: "client_credentials", client_id: id, client_secret: secret, scope: lwa ? "creatorsapi::default" : "creatorsapi/default" };
  const r = await fetch(TOKEN[v], lwa
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString() });
  STATUS.token[v] = r.status;
  if (!r.ok) { STATUS.tokenError = (await r.text()).slice(0, 200).replace(/[A-Za-z0-9_\-]{30,}/g, "…"); return null; }
  const j = await r.json().catch(() => ({}));
  return j.access_token || null;
}

let version = null, tok = null;
for (const v of versions) {
  if (!TOKEN[v]) { STATUS.token[v] = "unbekannte Version"; continue; }
  try { tok = await token(v); } catch (e) { STATUS.token[v] = "Netzwerkfehler " + e.message; tok = null; }
  if (tok) { version = v; break; }
}
if (!tok) { STATUS.result = "kein Token"; saveStatus(); console.error("Amazon: kein Token erhalten (Zugangsdaten oder Version prüfen)."); process.exit(0); }
console.log(`Amazon: Token mit Version ${version}.`);

const RES = ["images.primary.large", "images.primary.medium", "itemInfo.title", "itemInfo.byLineInfo",
  "offersV2.listings.price", "offersV2.listings.availability", "offersV2.listings.dealDetails", "offersV2.listings.isBuyBoxWinner", "offersV2.listings.merchantInfo"];
const headers = {
  "Content-Type": "application/json; charset=utf-8", Accept: "application/json",
  "x-marketplace": "www.amazon.de",
  Authorization: version.startsWith("3.") ? `Bearer ${tok}` : `Bearer ${tok}, Version ${version}`
};
const sleep = ms => new Promise(res => setTimeout(res, ms));
const num = m => typeof m?.amount === "number" ? m.amount : null;
// one item -> compact record; prices only as delivered by the API
function parse(it) {
  const img = it.images?.primary?.large || it.images?.primary?.medium;
  const ls = it.offersV2?.listings || [];
  const listing = ls.find(l => l.isBuyBoxWinner) || ls[0];
  const p = listing?.price || {};
  const price = num(p.money) ?? num(p);
  const was = num(p.savingBasis?.money);
  return {
    img: img?.url || null, w: img?.width || null, h: img?.height || null,
    price, was: was && price && was > price ? was : null,
    wasType: p.savingBasis?.savingBasisType || null, wasLabel: p.savingBasis?.savingBasisTypeLabel || null,
    pct: typeof p.savings?.percentage === "number" ? p.savings.percentage : null,
    avail: listing?.availability?.type || null,
    merchant: listing?.merchantInfo?.name || null,
    dealEnd: listing?.dealDetails?.endTime || null
  };
}

const out = { fetched: new Date().toISOString(), items: {} };
for (let i = 0; i < asins.length; i += 10) {
  const batch = asins.slice(i, i + 10);
  const r = await fetch("https://creatorsapi.amazon/catalog/v1/getItems", {
    method: "POST", headers,
    body: JSON.stringify({ partnerTag: deals.amazonTag, itemIds: batch, resources: RES })
  });
  const text = await r.text();
  STATUS.getItems.push(r.ok ? r.status : `${r.status} ${text.slice(0, 200)}`);
  if (!r.ok) { console.error(`Amazon getItems ${r.status}: ${text.slice(0, 300)}`); await sleep(1100); continue; }
  const j = JSON.parse(text);
  const items = j.itemsResult?.items || j.ItemsResult?.Items || [];
  for (const it of items) out.items[it.asin || it.ASIN] = parse(it);
  for (const e of (j.errors || [])) console.error("Amazon:", e.code, e.message);
  await sleep(1100); // 1 request per second
}
STATUS.version = version; STATUS.result = `${Object.keys(out.items).length}/${asins.length}`;
fs.writeFileSync(OUTFILE, JSON.stringify(out, null, 1));
console.log(`Amazon: ${Object.keys(out.items).length}/${asins.length} Produkte geladen.`);

/* Deal candidates via SearchItems: Amazon's own saving data, min. 20 %, new, in stock.
   No food/apparel search indices (vegan rule is checked by the editor anyway). */
const SEARCHES = [
  ["Electronics", "Kopfhörer", "headphones"], ["Electronics", "Bluetooth Lautsprecher", "speaker"], ["Electronics", "Soundbar", "speaker"],
  ["Electronics", "Smartphone", "phone"], ["Electronics", "Smartwatch", "watch"], ["Electronics", "Fernseher", "tv"],
  ["Computers", "Monitor", "computer"], ["Computers", "Laptop", "computer"], ["Computers", "SSD", "computer"],
  ["ToysAndGames", "LEGO", "toys"], ["HomeAndKitchen", "Saugroboter", "home"], ["HomeAndKitchen", "Kaffeevollautomat", "kitchen"],
  ["HomeAndKitchen", "Heißluftfritteuse", "kitchen"], ["ToolsAndHomeImprovement", "Akku", "tools"], ["GardenAndOutdoor", "Mähroboter", "garden"],
  ["SportsAndOutdoors", "Fitness", "sport"], ["Electronics", "Smart Home", "smarthome"],
  // 13.11. (Nico: Amazon-Suche ausweiten)
  ["Electronics", "Kamera", "camera"], ["Electronics", "Powerbank", "phone"], ["Electronics", "Tablet", "computer"], ["Electronics", "E-Book Reader", "computer"],
  ["Electronics", "Echo", "smarthome"], ["Electronics", "Fire TV", "tv"], ["Electronics", "Ring Kamera", "smarthome"], ["Electronics", "In-Ear Kopfhörer ANC", "headphones"],
  ["Computers", "Gaming Maus", "computer"], ["Computers", "Tastatur", "computer"], ["Computers", "Router WLAN", "computer"], ["Computers", "microSD", "computer"],
  ["Computers", "Externe Festplatte", "computer"], ["VideoGames", "PlayStation 5", "gaming"], ["VideoGames", "Nintendo Switch", "gaming"], ["VideoGames", "Gaming Headset", "gaming"],
  ["ToysAndGames", "Pokémon Karten", "toys"], ["ToysAndGames", "Playmobil", "toys"], ["ToysAndGames", "Playmobil Adventskalender", "toys"], ["ToysAndGames", "Carrera Bahn", "toys"], ["ToysAndGames", "Carrera RC", "toys"], ["ToysAndGames", "Carrera GO", "toys"], ["ToysAndGames", "Brettspiel", "toys"],
  ["HomeAndKitchen", "Akku-Staubsauger", "home"], ["HomeAndKitchen", "Luftreiniger", "home"], ["HomeAndKitchen", "Kaffeemaschine", "kitchen"], ["HomeAndKitchen", "Küchenmaschine", "kitchen"],
  ["HomeAndKitchen", "Wasserkocher", "kitchen"], ["HomeAndKitchen", "Pfannenset", "kitchen"], ["HomeAndKitchen", "Bettwäsche", "home"],
  ["ToolsAndHomeImprovement", "Akkuschrauber", "tools"], ["ToolsAndHomeImprovement", "Werkzeugset", "tools"], ["ToolsAndHomeImprovement", "LED Leuchtmittel", "home"],
  ["GardenAndOutdoor", "Gartenschlauch", "garden"], ["GardenAndOutdoor", "Hochdruckreiniger", "garden"], ["Automotive", "Dashcam", "car"], ["Automotive", "Starthilfe Powerbank", "car"],
  ["Beauty", "Elektrische Zahnbürste", "beauty"], ["Beauty", "Rasierer", "beauty"], ["Beauty", "Haartrockner", "beauty"],
  ["OfficeProducts", "Drucker", "computer"], ["Baby", "Babyphone", "baby"], ["PetSupplies", "Katzenklo", "home"],
  // 23.11. (Nico: Produktpalette ausweiten, auch Verbrauchsartikel mit starkem Rabatt; Lebensmittel nur vegan)
  ["HealthPersonalCare", "Waschmittel", "home"], ["HealthPersonalCare", "Spülmaschinentabs", "home"], ["HealthPersonalCare", "Weichspüler", "home"],
  ["HealthPersonalCare", "Spülmittel", "home"], ["HealthPersonalCare", "Allzweckreiniger", "home"], ["HealthPersonalCare", "Toilettenpapier", "home"],
  ["HealthPersonalCare", "Küchenrolle", "home"], ["HealthPersonalCare", "Taschentücher", "home"], ["HealthPersonalCare", "Müllbeutel", "home"],
  ["HealthPersonalCare", "Rasierklingen", "beauty"], ["HealthPersonalCare", "Aufsteckbürsten", "beauty"], ["HealthPersonalCare", "Zahnpasta", "beauty"],
  ["Beauty", "Duschgel", "beauty"], ["Beauty", "Shampoo", "beauty"], ["Beauty", "Deo", "beauty"], ["Beauty", "Sonnencreme", "beauty"],
  ["Electronics", "Batterien AA", "home"], ["OfficeProducts", "Druckerpatronen", "computer"], ["OfficeProducts", "Kopierpapier", "computer"],
  ["HomeAndKitchen", "Wasserfilter Kartuschen", "kitchen"], ["HomeAndKitchen", "Gefrierbeutel", "kitchen"], ["HomeAndKitchen", "Backpapier", "kitchen"],
  ["Grocery", "Kaffeebohnen", "kitchen"], ["Grocery", "Kaffeekapseln", "kitchen"], ["Grocery", "Tee", "kitchen"],
  ["Baby", "Windeln", "baby"], ["Baby", "Feuchttücher", "baby"], ["PetSupplies", "Katzenstreu", "pets"],
  ["Automotive", "Scheibenreiniger", "car"], ["HomeAndKitchen", "Kerzen", "home"], ["SportsAndOutdoors", "Trinkflasche", "sport"]
];
const known = new Set(asins);
const cand = new Map();
STATUS.searchItems = [];
for (const [searchIndex, keywords, cat] of SEARCHES) {
  const r = await fetch("https://creatorsapi.amazon/catalog/v1/searchItems", {
    method: "POST", headers,
    body: JSON.stringify({ partnerTag: deals.amazonTag, keywords, searchIndex, minSavingPercent: 20, condition: "New", availability: "Available", itemCount: 10, resources: RES })
  });
  const text = await r.text();
  STATUS.searchItems.push(r.ok ? r.status : `${r.status} ${text.slice(0, 160)}`);
  if (!r.ok) {
    console.error(`Amazon searchItems ${r.status}: ${text.slice(0, 200)}`);
    if (r.status === 403 || r.status === 404) break; // not eligible / endpoint unknown: no point in more requests
    await sleep(1100); continue;
  }
  const j = JSON.parse(text);
  for (const it of (j.searchResult?.items || j.SearchResult?.Items || [])) {
    const asin = it.asin || it.ASIN;
    if (!asin || known.has(asin) || cand.has(asin)) continue;
    const p = parse(it);
    if (!p.price || !p.was || (1 - p.price / p.was) < 0.2 || /OUT_OF_STOCK|UNAVAILABLE/i.test(p.avail || "")) continue;
    cand.set(asin, {
      asin, cat, query: keywords,
      title: it.itemInfo?.title?.displayValue || null,
      brand: it.itemInfo?.byLineInfo?.brand?.displayValue || it.itemInfo?.byLineInfo?.manufacturer?.displayValue || null,
      now: p.price, was: p.was, pct: Math.round((1 - p.price / p.was) * 100),
      wasType: p.wasType, wasLabel: p.wasLabel, merchant: p.merchant, dealEnd: p.dealEnd
    });
  }
  await sleep(1100);
}
/* 13.11.: alte, abgelaufene Amazon-Deals erneut prüfen (src/data/archive.json). Liegt der Preis wieder
   mind. 20 % unter Amazons eigenem Vergleichspreis und ist der Artikel verfügbar, wird er als Kandidat
   "reuse" mit alter Deal-ID gemeldet (Wiederverwendung statt Neuanlage). */
let ARCH = []; try { const a = JSON.parse(fs.readFileSync("src/data/archive.json", "utf8")); ARCH = (Array.isArray(a) ? a : (a.deals || Object.values(a))).filter(d => d && d.asin); } catch {}
const archAsins = [...new Set(ARCH.map(d => d.asin))].filter(x => !known.has(x));
STATUS.archiveChecked = 0;
for (let i = 0; i < archAsins.length; i += 10) {
  const batch = archAsins.slice(i, i + 10);
  const r = await fetch("https://creatorsapi.amazon/catalog/v1/getItems", { method: "POST", headers, body: JSON.stringify({ partnerTag: deals.amazonTag, itemIds: batch, resources: RES }) });
  if (!r.ok) { await sleep(1100); continue; }
  const j = await r.json();
  for (const it of (j.itemsResult?.items || j.ItemsResult?.Items || [])) {
    const asin = it.asin || it.ASIN, p = parse(it), old = ARCH.find(d => d.asin === asin);
    STATUS.archiveChecked++;
    if (!p.price || !p.was || (1 - p.price / p.was) < 0.2 || /OUT_OF_STOCK|UNAVAILABLE/i.test(p.avail || "") || cand.has(asin)) continue;
    cand.set(asin, { asin, cat: old?.cat || null, query: "archiv", reuse: old?.id || true,
      title: it.itemInfo?.title?.displayValue || old?.title?.de || null,
      brand: it.itemInfo?.byLineInfo?.brand?.displayValue || old?.brand || null,
      now: p.price, was: p.was, pct: Math.round((1 - p.price / p.was) * 100), wasType: p.wasType, wasLabel: p.wasLabel, merchant: p.merchant, dealEnd: p.dealEnd });
  }
  await sleep(1100);
}
const list = [...cand.values()].sort((a, b) => b.pct - a.pct);
fs.writeFileSync("src/data/amazon-candidates.json", JSON.stringify({
  fetched: out.fetched,
  note: "Amazon Creators API (SearchItems). Preise gelten zum Abrufzeitpunkt, max. 1 Stunde verwenden.",
  candidates: list
}, null, 1));
STATUS.candidates = list.length;
saveStatus();
console.log(`Amazon: ${list.length} neue Deal-Kandidaten.`);
