// Posts newly added deals to the perldeals Telegram channel.
// Runs in GitHub Actions after a successful deploy. Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
import fs from "node:fs";
import { execSync } from "node:child_process";

// tolerate common copy-paste variants: spaces/line breaks, a leading "bot", or the whole BotFather sentence
const rawToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const token = (rawToken.match(/\d{6,}:[A-Za-z0-9_-]{30,}/) || [rawToken.replace(/^bot/i, "")])[0];
const chat = (process.env.TELEGRAM_CHAT_ID || "").trim();
if (!token || !chat) { console.log("Telegram nicht eingerichtet, übersprungen."); process.exit(0); }

// Tageszusammenfassung: erster geplanter Lauf des Tages (05:17 UTC = 06:17 Uhr Berlin) postet die 5 stärksten Deals
if (process.env.GITHUB_EVENT_NAME === "schedule" && new Date().getUTCHours() === 5 && fs.existsSync("dist/data/deals-live.json")) {
  const L = JSON.parse(fs.readFileSync("dist/data/deals-live.json", "utf8")).deals.filter(d => d.was > d.now);
  const top = L.sort((a, b) => (1 - b.now / b.was) - (1 - a.now / a.was)).slice(0, 5);
  if (top.length) {
    const eur0 = n => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const e0 = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const day = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit" });
    const text = `☀️ <b>Perlen des Tages – ${e0(day)}</b>\n\n` + top.map((d, i) => `${i + 1}. <a href="https://perldeals.com/deals/${d.id}/?utm_source=telegram&amp;utm_medium=digest">${e0(d.title.slice(0, 80))}</a>\n${eur0(d.now)} statt ${eur0(d.was)} (−${Math.round((1 - d.now / d.was) * 100)} %) · ${e0(d.shop)}`).join("\n\n") + `\n\n👉 Alle geprüften Deals: https://perldeals.com/?utm_source=telegram\n(Anzeige: Partnerlinks)`;
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }) });
    console.log("Telegram-Tageszusammenfassung:", r.status);
  }
}
if (process.env.GITHUB_EVENT_NAME === "schedule") process.exit(0); // geplante Läufe: nur die Tageszusammenfassung
const DATA = JSON.parse(fs.readFileSync("src/data/deals.json", "utf8"));
// Amazon prices from the Creators API (same fetch as the website), never older figures
const AMZ = fs.existsSync("src/data/amazon-cache.json") ? JSON.parse(fs.readFileSync("src/data/amazon-cache.json", "utf8")) : { items: {} };
const now = DATA.deals.filter(d => {
  const a = d.asin && AMZ.items?.[d.asin];
  if (d.asin && !d.shop && (!a || typeof a.price !== "number")) return false; // Amazon-Preise nur aus der API
  if (!a || typeof a.price !== "number") return true;
  if (a.avail && /OUT_OF_STOCK|UNAVAILABLE/i.test(a.avail)) return false;
  if (a.price > d.now) d.low = false;
  if (a.was && a.was > a.price) d.was = a.was;
  if (a.price >= d.was) return false;
  d.now = a.price; return true;
});
if (AMZ.fetched && Object.keys(AMZ.items || {}).length) DATA.updated = AMZ.fetched;
const shopLink = d => d.link || `https://www.amazon.de/dp/${d.asin}?tag=boeketvtg-21`; // 22.11.: eigene Tracking-ID für Telegram
let before = [];
try { before = JSON.parse(execSync("git show HEAD~1:src/data/deals.json", { encoding: "utf8" })).deals; } catch { before = []; }
const known = new Set(before.map(d => d.id));
// only the strongest new deals: at least 20 % off, best first, max 3 per update (updates run hourly)
const fresh = now.filter(d => !known.has(d.id) && (1 - d.now / d.was) >= 0.2).sort((a, b) => (1 - b.now / b.was) + (b.low ? .1 : 0) - (1 - a.now / a.was) - (a.low ? .1 : 0)).slice(0, 3);
if (!fresh.length) { console.log("Keine neuen Deals."); process.exit(0); }

const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json()).catch(() => ({}));
if (!me.ok) { console.error("Telegram: Bot-Token ungültig (getMe schlägt fehl). Bitte TELEGRAM_BOT_TOKEN in den GitHub-Secrets prüfen: nur das Token aus BotFather, Format 123456789:ABC…"); process.exit(0); }
console.log("Telegram-Bot:", me.result.username);

const eur = n => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
for (const d of fresh) {
  const pct = Math.round((1 - d.now / d.was) * 100);
  const url = `https://perldeals.com/deals/${d.id}/?utm_source=telegram`;
  const shop = shopLink(d);
  const text = `<b>${esc(d.title.de)}</b>\n${eur(d.now)} statt ${eur(d.was)} (−${pct} %) bei ${esc(d.shopName || "Amazon")}${d.low ? "\n🏆 Bestpreis" : ""}\n\n👉 <a href="${esc(shop)}">Zum Deal bei ${esc(d.shopName || "Amazon")}</a> (Anzeige)\nℹ️ <a href="${url}">Details und Preisalarm auf perldeals</a>\n📲 Gern weiterleiten · Kanal: t.me/perldeals\n\n<i>Anzeige: Kaufst du über den Link, erhalten wir eine Provision. Preis vom ${new Date(d.checked || d.added || DATA.updated).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}, kann sich ändern.</i>`;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    // Link preview from our own German deal page (German title, description and image) instead of the shop page,
    // so Amazon etc. no longer show English or foreign texts in the channel.
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { url, prefer_large_media: true, show_above_text: true } })
  });
  if (!r.ok) console.error("Telegram-Fehler", r.status, await r.text());
  await new Promise(res => setTimeout(res, 1500));
}
console.log(`${fresh.length} Deals an Telegram gesendet.`);
