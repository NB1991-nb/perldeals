// 14.11.: Alle deutschen Pokémon-Karten mit Cardmarket-Preisen (über TCGdex, api.tcgdex.net) laden.
// Läuft täglich im Workflow karten-preise.yml (nicht im Container: Host dort nicht freigegeben).
// Ergebnis: src/data/pokemon-karten.json (kompakt) – Grundlage für /reseller/pokemon-preisindex/.
import fs from "node:fs";
const API = "https://api.tcgdex.net/v2/de", CONC = 20, sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(path, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(API + path, { signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.json(); if (r.status === 404) return null; } catch {}
    await sleep(800 * (i + 1));
  }
  return null;
}
async function pool(items, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: CONC }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }
const r2 = v => typeof v === "number" && v > 0 ? Math.round(v * 100) / 100 : null;

const sets = (await get("/sets")) || [];
const details = await pool(sets, s => get("/sets/" + encodeURIComponent(s.id)));
const out = { updated: new Date().toISOString(), source: "Cardmarket-Preisdaten über TCGdex (tcgdex.net)", sets: [], cards: [] };
const cardIds = [];
details.forEach((d, i) => {
  if (!d || !d.serie || d.serie.id === "tcgp") return; // TCG Pocket ist digital
  out.sets.push({ id: d.id, n: d.name, s: d.serie.name, sid: d.serie.id, r: d.releaseDate || null, c: d.cardCount?.total || (d.cards || []).length, o: d.cardCount?.official || null });
  for (const c of (d.cards || [])) cardIds.push([c.id, d.id]);
});
let done = 0;
const cards = await pool(cardIds, async ([id, set]) => {
  const c = await get("/cards/" + encodeURIComponent(id));
  if (++done % 2000 === 0) console.log(`${done}/${cardIds.length}`);
  if (!c) return null;
  // Hauptvariante (normal/holo) mit Cardmarket-Preis, Reverse-Holo separat aus den *-holo-Feldern
  const vs = (c.variants_detailed || []).filter(v => v.pricing && v.pricing.cardmarket);
  const v = vs.find(x => !/reverse/i.test(x.type)) || vs[0];
  const cm = v ? v.pricing.cardmarket : (c.pricing && c.pricing.cardmarket) || null;
  return [c.id, set, c.localId, c.name, c.rarity || "",
    cm ? r2(cm.trend) : null, cm ? r2(cm.avg30) : null, cm ? r2(cm.avg7) : null, cm ? r2(cm.low) : null,
    cm ? r2(cm["trend-holo"]) : null, cm ? r2(cm["avg30-holo"]) : null, cm && cm.updated ? cm.updated.slice(0, 10) : null];
});
out.cards = cards.filter(Boolean);
out.fields = ["id", "set", "nr", "name", "rarity", "trend", "avg30", "avg7", "low", "trendReverse", "avg30Reverse", "priceDate"];
console.log(`Sets ${out.sets.length}, Karten ${out.cards.length}/${cardIds.length}, mit Preis ${out.cards.filter(c => c[5] || c[6]).length}`);
if (out.cards.length < 1000) { console.error("Zu wenige Karten – nichts geschrieben."); process.exit(1); }
fs.writeFileSync("src/data/pokemon-karten.json", JSON.stringify(out));
