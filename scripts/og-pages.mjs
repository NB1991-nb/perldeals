// 13.11.: Teilen-Bild (1200x630 JPEG) für jede Seite ohne eigenes Produktbild – Titel + Bereich auf perldeals-Grün.
// Läuft im CI NACH build.mjs, liest dist/og-pages.json und schreibt dist/assets/og/page/<slug>.jpg.
import fs from "node:fs";
const OUT = "dist/assets/og/page", list = JSON.parse(fs.readFileSync("dist/og-pages.json", "utf8"));
fs.mkdirSync(OUT, { recursive: true });
let sharp; try { sharp = (await import("sharp")).default; } catch {}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const area = p => /^\/gutscheine\//.test(p) ? "Gutscheine & Rabattcodes" : /^\/wissen\//.test(p) ? "Ratgeber" : /^\/reseller\//.test(p) ? "Reseller & Sammler" : /^\/angebote\//.test(p) ? "Angebote" : /^\/black-friday\//.test(p) ? "Black Friday" : /^\/en\//.test(p) ? "Deals" : "Geprüfte Deals";
function wrap(t, max){ const w = t.split(/\s+/), lines = []; let cur = ""; for (const x of w){ if ((cur + " " + x).trim().length > max){ if (cur) lines.push(cur); cur = x; } else cur = (cur + " " + x).trim(); } if (cur) lines.push(cur); return lines; }
let n = 0;
for (const {s, t, p} of list) {
  const out = `${OUT}/${s}.jpg`;
  if (!sharp) { fs.copyFileSync("dist/assets/og/default.jpg", out); continue; }
  let size = 64, lines = wrap(t, 30);
  if (lines.length > 3) { size = 52; lines = wrap(t, 38); }
  if (lines.length > 4) { lines = lines.slice(0, 4); lines[3] = lines[3].replace(/\s*\S*$/, "") + " …"; }
  const y0 = 330 - (lines.length - 1) * size * 0.6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f7a6b"/><stop offset="1" stop-color="#07473f"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/><circle cx="1110" cy="40" r="260" fill="#ffffff" opacity=".07"/>
  <circle cx="110" cy="96" r="30" fill="#e9f3f0"/><text x="158" y="110" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" font-weight="700" fill="#ffffff">perldeals</text>
  <text x="80" y="200" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" font-weight="700" fill="#a8e6d6">${esc(area(p))}</text>
  ${lines.map((l, i) => `<text x="80" y="${Math.round(y0 + i * size * 1.2)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="800" fill="#ffffff">${esc(l)}</text>`).join("")}
  <text x="80" y="570" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#cfe7e1">perldeals.com · jeder Preis gegen den Preisverlauf geprüft</text></svg>`;
  try { await sharp(Buffer.from(svg)).jpeg({ quality: 80, mozjpeg: true }).toFile(out); n++; }
  catch (e) { fs.copyFileSync("dist/assets/og/default.jpg", out); }
}
console.log(`og-pages: ${n} Bilder (${list.length} Seiten)`);
