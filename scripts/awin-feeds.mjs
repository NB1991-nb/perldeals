// Awin product feeds for all joined partner shops (runs in GitHub Actions before the build).
// Needs the repository secret AWIN_FEED_KEY (Awin → Toolbox → Create-a-Feed → the key in the download URL).
// 1. Loads the feed list, keeps the German feeds of our joined advertisers (AWIN_MIDS below).
// 2. Streams each gzip CSV feed, never holding a whole feed in memory.
// 3. Keeps our own daily price history per product (src/data/awin-history.json, carried over from the live site),
//    so a "deal" can be checked against prices the shop really charged, not only its strike-through price.
// 4. Writes src/data/awin-candidates.json (published as /data/awin-kandidaten.json):
//    candidates  = in stock, ≥ 20 % below the shop's former price, plus the history verdict
//    existing    = current price / stock of the products we already list (stock check for every round)
import fs from "node:fs";
import zlib from "node:zlib";
import { Readable } from "node:stream";

const KEY = (process.env.AWIN_FEED_KEY || "").trim();
const OUT = "src/data/awin-candidates.json", HIST = "src/data/awin-history.json";
const STATUS = { at: new Date().toISOString(), feeds: [] };
const AWIN_MIDS = { 7824: "tassimo", 10959: "moderne-hausfrau", 11920: "videobuster", 30415: "jackery", 31615: "stoneline", 115280: "wybot", 14336: "otto", 11731: "alternate", 19810: "sharkninja", 10700: "myprotein", 85171: "coolblue", 125816: "imou", 125144: "anthbot", 125332: "autofull", 13991: "100percentpure", 129787: "evercross", 87569: "amazgifts", 127821: "outin", 11348: "notebooksbilliger", 128145: "aosu", 131129: "kikkerland", 58127: "logomatten", 17430: "getgoods", 20202: "wondershare", 22158: "mattenwelt", 23468: "fussmattenwelt", 25962: "blazevideo", 28945: "alldrei", 102989: "netzwerkartikel", 120289: "skled", 127057: "datouboss", 128051: "hollyland", 128645: "sirui", 25102: "pergolux", 69786: "lunzo", 52625: "luxecosy", 57455: "miniminipower", 77278: "solo", 77954: "currysmarter", 30763: "ecovacs", 67914: "allpowers", 100407: "tesmart", 124706: "sovol", 11395: "magix", 13433: "cambuy", 13737: "mactrade", 14098: "kaspersky", 16001: "comspot", 16937: "shifter", 22610: "lusini", 24227: "otterbox", 24666: "egret", 25407: "handyhuellen", 50387: "tip", 80533: "weroll", 84283: "yalehome", 87187: "mrkeyshop", 118359: "nexalia", 120778: "2gosoftware", 121708: "itversand", 123926: "joybuy", 127701: "gsmnet", 22871: "akkunet", 116021: "outdoorqueen", 120411: "deluxehomeart", 11447: "elv", 11684: "aosom", 14693: "gdata", 14698: "hmsat", 24966: "intergard", 26999: "rasendoktor", 29783: "systemtreff", 32419: "creality", 32623: "ankersolix", 34689: "arlo", 37928: "hwt", 44051: "xppen", 46703: "tuerklingel", 65454: "airq", 66850: "magnagrill", 68526: "softwaredealz", 70050: "3dmakerpro", 99977: "retrobad", 115779: "cleva", 116147: "dusbad", 128639: "esr", 23675: "xiaomi", 23063: "ledvance", 7619: "lampenwelt", 29787: "bwareshop", 118735: "lagenio", 131150: "technaxx", 79596: "obsbot", 10092: "medion", 14433: "euronics", 28833: "vevor", 57897: "geekbuying", 112902: "levoit", 14854: "getdigital", 14882: "ideeshop", 19110: "lizensio", 20681: "softwarehunter", 28417: "pflanzenkoelle", 48707: "woodstore24", 72053: "mepal", 78872: "kochblume", 100181: "muji", 13776: "hifiregler", 31772: "ubuy", 121148: "zosi", 29733: "happylamps" };
const NO_SALE_IN_FEED = new Set(["sharkninja", "100percentpure", "imou"]); // feed shows list price, shop sale price only on the site
const MAX_PER_SHOP = 4000;        // tracked discounted products per shop (history size)
const HISTORY_DAYS = 45;
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

if (!KEY) {
  fs.writeFileSync(OUT, JSON.stringify({ fetched: STATUS.at, status: "AWIN_FEED_KEY fehlt (Repository-Secret)", candidates: [], existing: [] }, null, 1));
  console.log("Awin-Feeds: kein AWIN_FEED_KEY, übersprungen."); process.exit(0);
}

// URLs of our existing Awin deals → id, to check price and stock
const deals = JSON.parse(fs.readFileSync("src/data/deals.json", "utf8")).deals;
const norm = u => { try { const x = new URL(u); return (x.host.replace(/^www\./, "") + x.pathname).replace(/\/$/, "").toLowerCase(); } catch { return ""; } };
const ourByUrl = new Map();
for (const d of deals) { const m = (d.link || "").match(/[?&]ued=([^&]+)/); if (m) ourByUrl.set(norm(decodeURIComponent(m[1])), d); }

let hist = {};
try { hist = JSON.parse(fs.readFileSync(HIST, "utf8")); } catch {}

/* minimal streaming CSV parser (RFC 4180: quotes, escaped quotes, newlines inside quotes) */
async function* csvRows(stream) {
  let field = "", row = [], q = false, prev = "";
  for await (const chunk of stream) {
    const s = chunk.toString("utf8");
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; continue; }
      if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); field = ""; if (row.length > 1 || row[0] !== "") yield row; row = []; }
      else if (c !== "\r") field += c;
      prev = c;
    }
  }
  if (field || row.length) { row.push(field); yield row; }
}
const num = v => { const n = parseFloat(String(v || "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };

const COLS = "aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,aw_image_url,merchant_category,category_name,search_price,store_price,rrp_price,product_price_old,saving,savings_percent,in_stock,stock_status,brand_name,ean,merchant_deep_link,merchant_id,merchant_name,currency";
const SKIP_CAT = /mode|bekleidung|schuh|wäsche|dessous|socken|jacke|hose|kleid|shirt|pullover|strick|bademode|schmuck|uhrenarmband|lebensmittel|wein|spirituosen|bier|fleisch|wurst|käse/i;

const listRes = await fetch(`https://productdata.awin.com/datafeed/list/apikey/${KEY}`);
if (!listRes.ok) { STATUS.list = listRes.status; fs.writeFileSync(OUT, JSON.stringify({ fetched: STATUS.at, status: `Feed-Liste HTTP ${listRes.status}`, candidates: [], existing: [] }, null, 1)); process.exit(0); }
const list = []; let head = null;
const hk = h => h.trim().toLowerCase().replace(/[^a-z]/g, "");   // "Advertiser ID" / advertiser_id -> advertiserid
for await (const r of csvRows(Readable.from([await listRes.text()]))) { if (!head) { head = r.map(hk); continue; } list.push(Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()]))); }
const g = (f, ...k) => k.map(x => f[x]).find(v => v !== undefined && v !== "") || "";
const feeds = list.filter(f => AWIN_MIDS[g(f, "advertiserid", "merchantid")] && !/not|pending|rejected|suspended/i.test(g(f, "membershipstatus", "status")) && /^(de|german|deutsch)/i.test(g(f, "language") || "de"));
STATUS.listCount = list.length; STATUS.columns = head;
STATUS.ours = list.filter(f => AWIN_MIDS[g(f, "advertiserid", "merchantid")]).map(f => ({ mid: g(f, "advertiserid", "merchantid"), name: g(f, "advertisername"), fid: g(f, "feedid"), status: g(f, "membershipstatus", "status"), lang: g(f, "language"), products: g(f, "noofproducts") }));
STATUS.matched = feeds.map(f => `${g(f, "advertisername")} (${g(f, "feedid")})`);

const candidates = [], existing = new Map();
for (const f of feeds) {
  const shop = AWIN_MIDS[g(f, "advertiserid", "merchantid")], fid = g(f, "feedid");
  const url = `https://productdata.awin.com/datafeed/download/apikey/${KEY}/language/de/fid/${fid}/columns/${COLS}/format/csv/delimiter/%2C/compression/gzip/adultcontent/1/`;
  const t0 = Date.now(); let rows = 0, kept = 0;
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) { STATUS.feeds.push({ shop, fid, http: res.status }); continue; }
    const gunzip = Readable.fromWeb(res.body).pipe(zlib.createGunzip());
    let h = null; const disc = [], plain = [];
    for await (const r of csvRows(gunzip)) {
      if (!h) { h = r.map(x => x.trim()); continue; }
      rows++;
      const p = Object.fromEntries(h.map((k, i) => [k, r[i]]));
      const price = num(p.search_price) || num(p.store_price); if (!price) continue;
      const inStock = !/^(0|false|no|out)/i.test(String(p.in_stock || p.stock_status || "1"));
      const ours = ourByUrl.get(norm(p.merchant_deep_link));
      if (ours && !NO_SALE_IN_FEED.has(shop)) { const e = existing.get(ours.id); if (!e) existing.set(ours.id, { id: ours.id, shop, price: inStock ? price : null, ourPrice: ours.now, inStock }); else if (inStock && (e.price == null || price < e.price)) { e.price = price; e.inStock = true; } }
      const old = num(p.product_price_old), rrp = num(p.rrp_price);
      const ref = old || rrp;
      if (!ref || price >= ref * 0.85) {                                          // not shown as reduced by the shop:
        if (rows <= 60000 && inStock && !SKIP_CAT.test(`${p.merchant_category} ${p.category_name}`)) plain.push({ key: `${shop}:${p.aw_product_id}`, price }); // small feeds: track anyway for our own history
        continue;
      }
      if (SKIP_CAT.test(`${p.merchant_category} ${p.category_name}`)) continue;
      if (shop === "myprotein" && !/vegan|pflanz|erbsen|soja|vegetar/i.test(p.product_name)) continue;
      if (shop === "100percentpure" && !/vegan/i.test(p.product_name)) continue;
      disc.push({ key: `${shop}:${p.aw_product_id}`, shop, name: p.product_name, brand: p.brand_name, price, old, rrp, inStock, cat: p.merchant_category || p.category_name, img: p.merchant_image_url || p.aw_image_url, url: p.merchant_deep_link, ean: p.ean });
    }
    // > 70 % off a strike price is almost always an inflated "Mondpreis" (marketplace sellers): skip.
    // Rank by saving in euros (real-world relevance), not by percentage, so cheap junk doesn't crowd out real deals.
    for (let i = disc.length - 1; i >= 0; i--) if (disc[i].price < (disc[i].old || disc[i].rrp) * 0.3 || disc[i].price < 15) disc.splice(i, 1);
    disc.sort((a, b) => ((b.old || b.rrp) - b.price) - ((a.old || a.rrp) - a.price));
    for (const x of plain.slice(0, 20000)) { const h0 = (hist[x.key] ||= []); const last = h0[h0.length - 1]; if (last && last[0] === today) last[1] = Math.min(last[1], x.price); else h0.push([today, x.price]); if (h0.length > HISTORY_DAYS) h0.splice(0, h0.length - HISTORY_DAYS); }
    for (const d of disc.slice(0, MAX_PER_SHOP)) {
      kept++;
      const h0 = (hist[d.key] ||= []);
      const last = h0[h0.length - 1];
      if (last && last[0] === today) last[1] = Math.min(last[1], d.price); else h0.push([today, d.price]);
      if (h0.length > HISTORY_DAYS) h0.splice(0, h0.length - HISTORY_DAYS);
      if (!d.inStock) continue;
      const prev = h0.slice(0, -1).map(x => x[1]);
      const days = prev.length;
      const median = days ? [...prev].sort((a, b) => a - b)[Math.floor(days / 2)] : null;
      const strikePct = Math.round((1 - d.price / (d.old || d.rrp)) * 100);
      const histPct = median ? Math.round((1 - d.price / median) * 100) : null;
      if (strikePct < 20) continue;
      candidates.push({ ...d, strikeBasis: d.old ? "Shop-Vorpreis" : "UVP", strikePct, historyDays: days, histMedian: median, histPct,
        verdict: days >= 14 ? (histPct >= 20 ? "echt (Verlauf)" : "nur Streichpreis") : d.old ? "Shop-Vorpreis, Verlauf zu kurz" : "nur UVP, Verlauf zu kurz" });
    }
  } catch (e) { STATUS.feeds.push({ shop, fid, error: String(e).slice(0, 120) }); continue; }
  STATUS.feeds.push({ shop, fid, rows, kept, sec: Math.round((Date.now() - t0) / 1000) });
}
// drop history of products not seen for HISTORY_DAYS
const cutoff = new Date(Date.now() - HISTORY_DAYS * 864e5).toISOString().slice(0, 10);
for (const k of Object.keys(hist)) if (!hist[k].length || hist[k][hist[k].length - 1][0] < cutoff) delete hist[k];
candidates.sort((a, b) => (b.verdict.startsWith("echt") - a.verdict.startsWith("echt")) || (b.strikeBasis === "Shop-Vorpreis") - (a.strikeBasis === "Shop-Vorpreis") || ((b.old || b.rrp) - b.price) - ((a.old || a.rrp) - a.price));
fs.writeFileSync(HIST, JSON.stringify(hist));
const perShop = {}; const picked = candidates.filter(c => (perShop[c.shop] = (perShop[c.shop] || 0) + 1) <= 150);
const ex = [...existing.values()].map(e => ({ ...e, changed: !e.inStock || Math.abs(e.price - e.ourPrice) > 0.009 }));
fs.writeFileSync(OUT, JSON.stringify({ fetched: STATUS.at, status: STATUS, existing: ex.filter(x => x.changed), checkedExisting: ex.length, candidates: picked }, null, 1));
console.log(`Awin-Feeds: ${STATUS.feeds.map(f => `${f.shop}:${f.rows ?? f.http ?? "err"}`).join(", ")}; ${candidates.length} Kandidaten, ${existing.size} eigene Deals geprüft.`);
