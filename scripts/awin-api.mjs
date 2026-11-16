// Awin Publisher API (OAuth2-Token im Secret AWIN_API_TOKEN):
// 1. Aktionen und Gutscheine aller angenommenen Partner (Region DE) -> src/data/awin-promotions.json (veröffentlicht als /data/awin-aktionen.json)
// 2. Liste der angenommenen Programme -> src/data/awin-programme.json (neue Partner erkennen)
// Der Token wird nie geschrieben oder geloggt.
import fs from "node:fs";

const TOKEN = (process.env.AWIN_API_TOKEN || "").trim();
const PUB = 2721610;
const OUT = new URL("../src/data/", import.meta.url);
const status = { at: new Date().toISOString(), token: !!TOKEN };

async function call(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

const clean = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

if (!TOKEN) {
  status.error = "AWIN_API_TOKEN fehlt";
} else {
  // 1. Programme
  try {
    const progs = await call("GET", `https://api.awin.com/publishers/${PUB}/programmes?relationship=joined`);
    const list = (Array.isArray(progs) ? progs : []).map(p => ({ id: p.id, name: p.name, url: p.displayUrl, sector: p.primarySector && p.primarySector.name || p.primarySector, region: p.primaryRegion && p.primaryRegion.countryCode }));
    fs.writeFileSync(new URL("awin-programme.json", OUT), JSON.stringify({ at: status.at, count: list.length, programmes: list }, null, 1));
    status.programmes = list.length;
  } catch (e) { status.programmesError = String(e.message).slice(0, 200); }

  // 2. Aktionen und Gutscheine
  try {
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const res = await call("POST", `https://api.awin.com/publisher/${PUB}/promotions`, {
        filters: { membership: "joined", regionCodes: ["DE"], status: "active", type: "all" },
        pagination: { page, pageSize: 200 }
      });
      const data = res.data || [];
      all.push(...data);
      const total = res.pagination && res.pagination.total;
      if (!data.length || (total && all.length >= total)) break;
    }
    const promos = all.map(p => ({
      id: p.promotionId,
      type: p.type,
      mid: p.advertiser && p.advertiser.id,
      advertiser: p.advertiser && p.advertiser.name,
      title: clean(p.title),
      description: clean(p.description).slice(0, 400),
      terms: clean(p.terms).slice(0, 400),
      code: p.voucher && p.voucher.code || null,
      exclusive: !!(p.voucher && p.voucher.exclusive),
      start: p.startDate || null,
      end: p.endDate || null,
      url: p.url || null,
      tracking: p.urlTracking || null,
      added: p.dateAdded || null
    })).filter(p => p.mid && p.title);
    fs.writeFileSync(new URL("awin-promotions.json", OUT), JSON.stringify({ at: status.at, count: promos.length, promotions: promos }, null, 1));
    status.promotions = promos.length;
    status.vouchers = promos.filter(p => p.code).length;
  } catch (e) { status.promotionsError = String(e.message).slice(0, 200); }
}
fs.writeFileSync(new URL("awin-api-status.json", OUT), JSON.stringify(status, null, 1));
console.log("Awin API:", JSON.stringify(status));
