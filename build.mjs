// perldeals static site builder. Run: node build.mjs  -> writes ./dist
import fs from "node:fs";
import path from "node:path";

const SRC = "src", OUT = "dist";
const DATA = JSON.parse(fs.readFileSync(`${SRC}/data/deals.json`, "utf8"));
const SITE = JSON.parse(fs.readFileSync(`${SRC}/data/site.json`, "utf8"));
const GUIDES = JSON.parse(fs.readFileSync(`${SRC}/data/guides.json`, "utf8"));
const BEST = fs.existsSync(`${SRC}/data/best.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/best.json`, "utf8")) : {};
const HUBS = fs.existsSync(`${SRC}/data/hubs.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/hubs.json`, "utf8")) : null;
const WD_ITEMS = fs.existsSync(`${SRC}/data/wasserdicht.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/wasserdicht.json`, "utf8")).items : [];
const wdLinkFor = d => { const t = `${d.title.de} ${d.brand||""}`.toLowerCase(); const m = WD_ITEMS.slice().sort((a, b) => (b.query||b.model).length - (a.query||a.model).length).find(x => (x.query || x.model).toLowerCase().split(/\s+/).every(w => t.includes(w))); return m ? `<p class="prose"><a class="more" href="/wasserdicht/${m.slug.replace(/-wasserdicht$/, "")}/">${wdQ(m)} ${esc(m.model)} wasserdicht? ${esc(m.ip)} erklärt</a></p>` : ""; };
const ARTICLES = fs.existsSync(`${SRC}/data/articles.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/articles.json`, "utf8")) : {};
const BASE = SITE.url;

/* Product images of partner shops, downloaded at build time to our own server (scripts/images.mjs) */
for (const d of DATA.deals) {
  if (!d.imageSrc) continue;
  const f = fs.existsSync(`${SRC}/assets/products`) ? fs.readdirSync(`${SRC}/assets/products`).find(x => x.startsWith(d.id + ".")) : null;
  if (f) d.img = {src:`/assets/products/${f}`};
}

/* "updated" = newest of the file stamp and any deal's added/checked time (rounds don't always bump the file stamp) */
{ const ts = [DATA.updated, ...DATA.deals.map(d => d.checked || d.added)].filter(Boolean).map(x => new Date(x)).filter(x => !isNaN(x) && x <= new Date());
  if (ts.length) DATA.updated = new Date(Math.max(...ts)).toISOString(); }

/* Nico 08.11.: Deals, deren Preis wieder gestiegen ist, bleiben als Seite online (abgelaufen) und zeigen den aktuellen Preis */
const PRICEUP = {};
/* Amazon Creators API data (images, live prices), written by scripts/amazon.mjs in CI */
const AMZ = fs.existsSync(`${SRC}/data/amazon-cache.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/amazon-cache.json`, "utf8")) : {items:{}};
if (AMZ.fetched && Object.keys(AMZ.items).length) {
  DATA.updated = AMZ.fetched; // prices shown are from this fetch
  DATA.deals = DATA.deals.filter(d => {
    const a = d.asin && AMZ.items[d.asin];
    if (!a) return true;
    if (a.img) d.img = {src:a.img, w:a.w, h:a.h};
    const out = a.avail && /OUT_OF_STOCK|UNAVAILABLE/i.test(a.avail);
    if (typeof a.price === "number" && a.price < d.now * 0.4) { console.log(`Amazon-Preis unplausibel, ignoriert: ${d.id} (${a.price} € statt zuletzt ${d.now} €)`); return true; } // 10.11.: API lieferte 0,98 € für LEGO 77256
    if (typeof a.price === "number") {
      if (a.price > d.now) d.low = false; // a best-price claim no longer holds once the price went up
      if (a.was && a.was > a.price) { if (!d.idealoMedian && /idealo/i.test((d.note && d.note.de) || "")) d.idealoMedian = d.was; d.was = a.was; } // Amazon's own reference price (savingBasis) wins; idealo-Mittel bleibt zusätzlich sichtbar (11.11.)
      if (a.price < d.was && !out) { d.now = a.price; d.priceTs = AMZ.fetched; }
      else if (!GUIDES[d.id]) { if (!out) PRICEUP[d.id] = {price:a.price, ts:AMZ.fetched, shop:"Amazon"}; console.log(`Deal beendet (Preis wieder gestiegen/ausverkauft), als abgelaufen markiert: ${d.id} (${a.price} €)`); return false; }
      else { d.now = a.price; d.was = Math.max(d.was, a.price); d.low = false; }
    }
    return true;
  });
}
const AWIN_MID = {"tassimo":7824, "moderne-hausfrau":10959, "videobuster":11920, "jackery":30415, "stoneline":31615, "wybot":115280, otto:14336, alternate:11731, sharkninja:19810, myprotein:10700, coolblue:85171, imou:125816, anthbot:125144, autofull:125332, "100percentpure":13991, evercross:129787, amazgifts:87569, outin:127821, notebooksbilliger:11348, aosu:128145, telekom:11430, kikkerland:131129, logomatten:58127, lidlreisen:11773, meinschiff:9127, ehoi:9145, turbopass:11624, pergolux:25102, lunzo:69786, luxecosy:52625, miniminipower:57455, solo:77278, currysmarter:77954, ecovacs:30763, allpowers:67914, tesmart:100407, sovol:124706, magix:11395, cambuy:13433, mactrade:13737, kaspersky:14098, comspot:16001, shifter:16937, lusini:22610, otterbox:24227, egret:24666, handyhuellen:25407, tip:50387, weroll:80533, yalehome:84283, mrkeyshop:87187, nexalia:118359, "2gosoftware":120778, itversand:121708, joybuy:123926, gsmnet:127701, akkunet:22871, xiaomi:23675, ledvance:23063, elv:11447, aosom:11684, gdata:14693, hmsat:14698, intergard:24966, rasendoktor:26999, systemtreff:29783, creality:32419, ankersolix:32623, arlo:34689, hwt:37928, xppen:44051, tuerklingel:46703, airq:65454, magnagrill:66850, softwaredealz:68526, "3dmakerpro":70050, retrobad:99977, cleva:115779, dusbad:116147, esr:128639, outdoorqueen:116021, deluxehomeart:120411, getgoods:17430, wondershare:20202, mattenwelt:22158, fussmattenwelt:23468, blazevideo:25962, alldrei:28945, netzwerkartikel:102989, skled:120289, datouboss:127057, hollyland:128051, sirui:128645, lampenwelt:7619, bwareshop:29787, lagenio:118735, technaxx:131150, obsbot:79596, medion:10092, euronics:14433, vevor:28833, geekbuying:57897, levoit:112902, getdigital:14854, ideeshop:14882, lizensio:19110, softwarehunter:20681, pflanzenkoelle:28417, woodstore24:48707, mepal:72053, kochblume:78872, muji:100181, asgoodasnew:14829, check24:9364};
/* Automatische Deals aus den Awin-Feeds (seit 04.11.): nur echte Preissenkungen gegenüber unserem eigenen Preisverlauf
   (mind. 3 Vortage, mind. 15 % unter dem Median der tatsächlich verlangten Preise) und vom Shop als reduziert ausgewiesen.
   Sie verschwinden automatisch, sobald sie nicht mehr im Feed reduziert/verfügbar sind. Bestehende Awin-Deals: Preis/Bestand aus dem Feed. */
{
  const F = fs.existsSync(`${SRC}/data/awin-candidates.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/awin-candidates.json`, "utf8")) : null;
  if (F && Array.isArray(F.candidates)) {
    // 1. bestehende Deals: ausverkauft -> ausblenden, Preis geändert -> übernehmen (wenn noch reduziert)
    const ex = new Map((F.existing || []).map(e => [e.id, e]));
    DATA.deals = DATA.deals.filter(d => { const e0 = ex.get(d.id); if (!e0 || GUIDES[d.id]) return true;
      // 14.11.: Deals mit Gutscheincode (codePct) – Feed liefert den Preis ohne Code, darum Code-Rabatt abziehen
      const e = (d.codePct && e0.price != null) ? {...e0, price: Math.round(e0.price * (100 - d.codePct)) / 100} : e0;
      if (!e.inStock || e.price == null) { console.log(`Feed: ausverkauft, ausgeblendet: ${d.id}`); return false; }
      if (e.price >= d.was && d.shop !== "myprotein") { PRICEUP[d.id] = {price:e.price, ts:F.fetched}; console.log(`Feed: nicht mehr reduziert, als abgelaufen markiert: ${d.id}`); return false; }
      if (d.shop === "myprotein") return true; // 08.11.: Myprotein-Feedpreise gehören oft zu einer anderen Packungsgröße – nie automatisch übernehmen
      d.now = e.price; d.priceTs = F.fetched; return true; });
    // 2. neue automatische Deals (Auswahl in scripts/auto-deals.mjs, Bilder per scripts/images.mjs geladen)
    const AD = fs.existsSync(`${SRC}/data/auto-deals.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/auto-deals.json`, "utf8")).deals || [] : [];
    const ids = new Set(DATA.deals.map(d => d.id)), links = DATA.deals.map(d => d.link || "").join(" ");
    const pf = fs.existsSync(`${SRC}/assets/products`) ? fs.readdirSync(`${SRC}/assets/products`) : [];
    let n = 0;
    for (const c of AD) {
      if (!AWIN_MID[c.shop] || ids.has(c.id) || links.includes(encodeURIComponent(c.url))) continue; ids.add(c.id);
      const f = pf.find(x => x.startsWith(c.id + "."));
      const d = {id:c.id, shop:c.shop, link:`https://www.awin1.com/cread.php?awinmid=${AWIN_MID[c.shop]}&awinaffid=2721610&clickref=perldeals-auto&ued=${encodeURIComponent(c.url)}&platform=pl`, brand:c.brand, cat:c.cat, now:c.now, was:c.was, auto:true, added:F.fetched, checked:F.fetched,
        title:{de:c.title, en:c.title}, imageSrc:c.imageSrc, ...(f ? {img:{src:`/assets/products/${f}`}} : {}),
        note:{de:`Automatisch erkannt: ${c.days} Tage lang meist ${c.was.toFixed(2).replace(".",",")} € (eigene Preisaufzeichnung aus dem Shop-Feed), jetzt ${c.pct} % günstiger.`, en:`Detected automatically: mostly €${c.was.toFixed(2)} for ${c.days} days (our own tracking of the shop feed), now ${c.pct}% cheaper.`}};
      Object.defineProperty(d, "shopName", {get(){ try { return (SHOPS[d.shop] && SHOPS[d.shop].name) || d.shop; } catch (e) { return d.shop; } }, enumerable:true});
      DATA.deals.push(d); n++;
    }
    console.log(`Auto-Deals aus Awin-Feeds: ${n}`);
  }
}
const LANGS = ["de", "en"];

/* ---------------- helpers ---------------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const loc = {de:"de-DE", en:"en-IE"};
const eur = (n, l) => n.toLocaleString(loc[l], {style:"currency", currency:"EUR"});
const pct = d => Math.round((1 - d.now / d.was) * 100);
/* Amazon-Richtlinie: Preise nur aus der Creators API (oder von Amazon ausgelieferten Links) anzeigen.
   Solange die API nicht freigeschaltet ist, zeigen wir bei Amazon-Deals keinen Preis und keinen Rabatt. */
const NP = d => !!(d && d.asin && !d.shop && !d.priceTs);
const NPTXT = l => l === "de" ? "Aktueller Preis bei Amazon" : "Current price on Amazon";
const npDay = (d, l) => new Date(d.checked || d.added).toLocaleDateString(l === "de" ? "de-DE" : "en-IE", {timeZone:"Europe/Berlin", day:"2-digit", month:"2-digit"});
const npPrice = (d, l) => `<div class="price"><span class="now np">${l === "de" ? `Zuletzt gemeldet: −${pct(d)} % (${npDay(d, l)})` : `Last reported: −${pct(d)}% (${npDay(d, l)})`}</span><span class="save np-note">${l === "de" ? "Aktueller Preis nur bei Amazon" : "Current price on Amazon only"}</span></div>`;
/* Bei Amazon-Deals ohne API-Preis: Sätze mit Euro-Beträgen aus Hinweisen, Kaufberatungen und Vergleichstexten entfernen */
const stripPrices = t => typeof t !== "string" || !/\d\s*€|€\s*\d|Euro\b/.test(t) ? t : (t.match(/[^.!?]+[.!?]*\s*/g) || [t]).filter(x => !/\d[\d.,]*\s*(€|Euro\b)|€\s*\d/.test(x)).join("").trim();
const deepStrip = o => typeof o === "string" ? stripPrices(o) : Array.isArray(o) ? o.map(deepStrip) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deepStrip(v)])) : o;
for (const d of DATA.deals) if (NP(d) && d.note) d.note = deepStrip(d.note);
for (const id of Object.keys(GUIDES)) { const d = DATA.deals.find(x => x.id === id); if (d && NP(d)) { const g = GUIDES[id]; for (const l of ["de","en"]) if (g[l]) g[l] = deepStrip(g[l]); } }
for (const k of Object.keys(ARTICLES)) { const A = ARTICLES[k]; for (const l of ["de","en"]) if (A[l] && A[l].pickNotes) for (const pid of Object.keys(A[l].pickNotes)) { const d = DATA.deals.find(x => x.id === pid); if (d && NP(d)) A[l].pickNotes[pid] = deepStrip(A[l].pickNotes[pid]); } }
for (const k of Object.keys(BEST)) for (const l of ["de","en"]) for (const it of (BEST[k][l] && BEST[k][l].items) || []) { const d = it.dealId && DATA.deals.find(x => x.id === it.dealId); if (d && NP(d)) Object.assign(it, deepStrip(Object.fromEntries(Object.entries(it).filter(([kk]) => kk !== "dealId")))); }
const discBadge = d => NP(d) ? `<span class="disc" title="zuletzt gemeldet">−${pct(d)}%*</span>` : `<span class="disc">−${pct(d)}%</span>`;
const amz = asin => `https://www.amazon.de/dp/${asin}?tag=${DATA.amazonTag}`;
const EPN_CAMPID = "5339227826";
const EBAY_SHOP = "https://www.ebay.de/usr/boekenkroeger_handelgesellschaft";
const SOCIAL = { wa: "https://whatsapp.com/channel/0029VbDtsloHgZWfmyoCPe2q", tg: "https://t.me/perldeals", fb: "https://www.facebook.com/groups/1669386688151424" };

/* sign-up boxes (double opt-in via /api/subscribe.php) */
const subBox = (lang, source) => {
  const de = lang==="de";
  return `<form class="sub" data-sub data-kind="bf" data-source="${source}" novalidate>
  <div class="sub-head"><strong>${de?"🔔 Black-Friday-Deal-Alarm":"🔔 Black Friday deal alarm"}</strong><span>${de?"Die besten Black-Friday-Deals und jeden Morgen die Perlen des Tages per E-Mail. Kostenlos, jederzeit abbestellbar.":"The best Black Friday deals and the pearls of the day every morning by email. Free, unsubscribe anytime."}</span></div>
  <div class="sub-row"><input type="email" name="email" required autocomplete="email" placeholder="${de?"Deine E-Mail-Adresse":"Your email address"}" aria-label="${de?"E-Mail-Adresse":"Email address"}"><input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><button class="btn btn-primary" type="submit">${de?"Alarm aktivieren":"Activate alarm"}</button></div>
  <p class="sub-legal">${de?`Mit Klick erhältst du eine Bestätigungs-E-Mail (Double-Opt-in). Erst nach Bestätigung schicken wir dir unseren Newsletter mit Deals und Partnerlinks. Abmeldung jederzeit über den Link in jeder E-Mail. <a href="${R.privacy.de}">Datenschutz</a>`:`You will get a confirmation email (double opt-in). Only after confirming will we send our newsletter with deals and affiliate links. Unsubscribe anytime via the link in every email. <a href="${R.privacy.en}">Privacy</a>`}</p>
  <p class="sub-msg" role="status" aria-live="polite"></p></form>`;
};
const alertBox = (lang, d) => {
  const de = lang==="de";
  const kw = (d.brand+" "+d.title[lang].replace(d.brand,"").split(",")[0].replace(/\([^)]*\)/g,"").trim().split(" ").slice(0,3).join(" ")).trim();
  const max = NP(d) ? "" : Math.floor(d.now*0.97*100)/100;
  return `<form class="sub sub-alert" data-sub data-kind="alert" data-source="deal" data-keyword="${esc(kw)}" data-cat="${d.cat}" data-max="${max}" novalidate>
  <div class="sub-head"><strong>${de?"Sag mir, wenn’s billiger wird":"Tell me when it gets cheaper"}</strong><span>${max === "" ? (de?`Wir mailen dir, sobald es einen neuen Deal zu „${esc(kw)}“ gibt.`:`We email you as soon as there is a new deal on “${esc(kw)}”.`) : de?`Wir mailen dir, sobald „${esc(kw)}“ unter ${eur(max,"de")} auftaucht.`:`We email you as soon as “${esc(kw)}” appears below ${eur(max,"en")}.`}</span></div>
  <div class="sub-row"><input type="email" name="email" required autocomplete="email" placeholder="${de?"E-Mail-Adresse":"Email address"}" aria-label="${de?"E-Mail-Adresse":"Email address"}"><input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><button class="btn btn-ghost" type="submit">${de?"Preisalarm":"Price alert"}</button></div>
  ${de?`<label class="sub-nl"><input type="checkbox" name="newsletter" value="1"> Zusätzlich den perldeals-Newsletter mit den besten Deals und Aktionen erhalten (freiwillig, jederzeit abbestellbar)</label>`:`<label class="sub-nl"><input type="checkbox" name="newsletter" value="1"> Also get the perldeals newsletter with the best deals and promotions (optional, unsubscribe anytime)</label>`}
  <p class="sub-legal">${de?`Mit Bestätigungs-E-Mail (Double-Opt-in), jederzeit abbestellbar. <a href="${R.privacy.de}">Datenschutz</a>`:`With confirmation email (double opt-in), unsubscribe anytime. <a href="${R.privacy.en}">Privacy</a>`}</p>
  <p class="sub-msg" role="status" aria-live="polite"></p></form>`;
};
const catAlertBox = (lang, k) => {
  const de = lang==="de", name = CATS[k][lang][0];
  return `<div class="wrap"><form class="sub sub-alert" data-sub data-kind="alert" data-source="cat-${k}" data-cat="${k}" novalidate>
  <div class="sub-head"><strong>${de?`🔔 Kategorie ${esc(name)} abonnieren`:`🔔 Follow ${esc(name)} deals`}</strong><span>${de?`Wir mailen dir, sobald ein neuer ${esc(name)}-Deal erscheint (sofort oder einmal täglich, einstellbar im Konto).`:`We email you as soon as a new ${esc(name)} deal appears (instantly or once a day, set in your account).`}</span></div>
  <div class="sub-row"><input type="email" name="email" required autocomplete="email" placeholder="${de?"E-Mail-Adresse":"Email address"}" aria-label="${de?"E-Mail-Adresse":"Email address"}"><input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><button class="btn btn-primary" type="submit">${de?"Abonnieren":"Subscribe"}</button></div>
  ${de?`<label class="sub-nl"><input type="checkbox" name="newsletter" value="1"> Zusätzlich den perldeals-Newsletter mit den besten Deals und Aktionen erhalten (freiwillig, jederzeit abbestellbar)</label>`:`<label class="sub-nl"><input type="checkbox" name="newsletter" value="1"> Also get the perldeals newsletter with the best deals and promotions (optional, unsubscribe anytime)</label>`}
  <p class="sub-legal">${de?`Mit Bestätigungs-E-Mail (Double-Opt-in), jederzeit abbestellbar. <a href="${R.privacy.de}">Datenschutz</a>`:`With confirmation email (double opt-in), unsubscribe anytime. <a href="${R.privacy.en}">Privacy</a>`}</p>
  <p class="sub-msg" role="status" aria-live="polite"></p></form></div>`;
};
const BF_SEASON = new Date() <= new Date("2026-11-30T23:00:00Z");
const bfTopBox = lang => {
  const de = lang==="de";
  return `<div class="wrap"><form class="sub sub-bftop" data-sub data-kind="bf" data-source="bf-top" novalidate>
  <div class="sub-head"><strong>${de?"🔔 Erinnere mich zum Black Friday (27.11.)":"🔔 Remind me on Black Friday (27 Nov)"}</strong><span>${de?"Am Black Friday und Cyber Monday schicken wir dir die geprüften Top-Deals – nur echte Rabatte, gemessen am Preisverlauf. Kostenlos, jederzeit abbestellbar.":"On Black Friday and Cyber Monday we send you the checked top deals – only real discounts, measured against the price history. Free, unsubscribe anytime."}</span></div>
  <div class="sub-row"><input type="email" name="email" required autocomplete="email" placeholder="${de?"Deine E-Mail-Adresse":"Your email address"}" aria-label="${de?"E-Mail-Adresse":"Email address"}"><input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><button class="btn btn-primary" type="submit">${de?"Erinnerung aktivieren":"Activate reminder"}</button></div>
  <p class="sub-legal">${de?`Mit Bestätigungs-E-Mail (Double-Opt-in). Danach erhältst du unseren Newsletter mit Deals und Partnerlinks, Abmeldung jederzeit. <a href="${R.privacy.de}">Datenschutz</a>`:`With confirmation email (double opt-in). You will then get our newsletter with deals and affiliate links, unsubscribe anytime. <a href="${R.privacy.en}">Privacy</a>`}</p>
  <p class="sub-msg" role="status" aria-live="polite"></p></form></div>`;
};
const followBox = (lang, noBf) => (BF_SEASON && !noBf ? subBox(lang, "follow-bf") : "") + `<aside class="follow" aria-label="${lang==="de"?"Deals aufs Handy":"Deals on your phone"}">
  <div><strong>${lang==="de"?"Keine Perle mehr verpassen":"Never miss a pearl"}</strong><span>${lang==="de"?"Die besten Deals kostenlos aufs Handy, ohne Spam.":"The best deals on your phone for free, no spam."}</span></div>
  <div class="follow-btns"><a class="btn follow-wa" href="${SOCIAL.wa}" target="_blank" rel="noopener">WhatsApp-Kanal</a><a class="btn follow-tg" href="${SOCIAL.tg}" target="_blank" rel="noopener">Telegram</a><a class="btn follow-fb" href="${SOCIAL.fb}" target="_blank" rel="noopener">${lang==="de"?"Facebook-Gruppe":"Facebook group"}</a></div>
</aside>`;
const epn = (url, ref = "perldeals") => `${url}${url.includes("?") ? "&" : "?"}mkcid=1&mkrid=707-53477-19255-0&siteid=77&campid=${EPN_CAMPID}&customid=${encodeURIComponent(ref)}&toolid=10001&mkevt=1`;
const ebaySearch = q => epn(`https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(q)}`, "perldeals-best");
const absUrl = u => /^https?:/.test(u) ? u : BASE + u;
/* Sicherheit: Partner-Links und IDs aus Daten/Feeds prüfen, bevor sie in href/Pfade gelangen */
for (const d of DATA.deals) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id)) throw new Error(`Ungültige Deal-ID: ${d.id}`);
  for (const u of [d.link, d.ebayUrl, d.imageSrc].filter(Boolean)) if (!/^https:\/\/[^"'<>\s`]+$/i.test(u)) throw new Error(`Unsichere URL bei ${d.id}: ${u}`);
}
const dealLink = d => d.link || (d.ebayUrl ? epn(d.ebayUrl, "perldeals-" + d.id) : amz(d.asin));
const shopName = d => d.shopName || "Amazon.de";
const fmtDate = (iso, l) => new Date(iso).toLocaleString(loc[l], {timeZone:"Europe/Berlin", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"});
const fmtDay = (iso, l) => new Date(iso).toLocaleDateString(loc[l], {timeZone:"Europe/Berlin", day:"numeric", month:"long", year:"numeric"});
const STAMP = l => fmtDate(DATA.updated, l);
/* 11.11.: zusätzlich zum Shop-/UVP-Vergleichspreis den üblichen Marktpreis laut idealo zeigen, wenn wir ihn geprüft haben und er abweicht */
const idealoLine = (d, l, short) => {
  const m = d.idealoMedian; if (!m || !(m > d.now) || Math.abs(m - d.was) < 1) return "";
  const p = Math.round((1 - d.now / m) * 100);
  return l === "de" ? `<div class="stamp idealo">${short ? "" : "Üblicher Marktpreis "}laut idealo (Mittel 30 Tage): ${eur(m, l)} · ${p} % günstiger</div>`
                    : `<div class="stamp idealo">${short ? "" : "Usual market price "}per idealo (30-day median): ${eur(m, l)} · ${p}% less</div>`;
};
const DSTAMP = (d, l) => fmtDate(d.priceTs || d.checked || d.added, l);
const pic = (d, size) => d.img ? `<img src="${esc(d.img.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${d.img.w?` width="${d.img.w}" height="${d.img.h}"`:""}>` : icon(d.cat, size);
const AFF = `target="_blank" rel="sponsored nofollow noopener"`;
const ldjson = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;


/* Price history (fake-discount check). CI downloads the live file to src/data/price-history.json first. */
const HIST_FILE = `${SRC}/data/price-history.json`;
const HIST = (() => { try { return JSON.parse(fs.readFileSync(HIST_FILE, "utf8")); } catch { return {}; } })();
{
  const day = new Date(DATA.updated).toLocaleDateString("sv-SE", {timeZone:"Europe/Berlin"});
  const cutoff = new Date(Date.now() - 180*86400000).toISOString().slice(0,10);
  for (const d of DATA.deals) {
    const h = (HIST[d.id] || []).filter(e => e[0] >= cutoff && e[0] !== day);
    h.push([day, d.now]); h.sort((a,b)=>a[0].localeCompare(b[0]));
    HIST[d.id] = h;
  }
}
function priceFacts(d){
  const h = HIST[d.id] || [];
  if (h.length < 2) return {days: h.length};
  const first = h[0][0], min = Math.min(...h.map(e=>e[1]));
  const since30 = new Date(new Date(h[h.length-1][0]).getTime() - 30*86400000).toISOString().slice(0,10);
  const last30 = h.filter(e => e[0] >= since30 && e !== h[h.length-1]);
  const min30 = last30.length ? Math.min(...last30.map(e=>e[1])) : null, max30 = last30.length ? Math.max(...last30.map(e=>e[1])) : null;
  return {days: h.length, first, min, min30, max30, h};
}
function spark(h){
  const W=280, H=56, xs=h.map((_,i)=>i/(h.length-1||1)*W), vals=h.map(e=>e[1]), lo=Math.min(...vals), hi=Math.max(...vals), sp=(hi-lo)||1;
  const pts=h.map((e,i)=>`${xs[i].toFixed(1)},${(H-4-(e[1]-lo)/sp*(H-8)).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function historyBox(d, lang){
  const f = priceFacts(d), de = lang==="de";
  const fd = x => new Date(x+"T12:00:00").toLocaleDateString(loc[lang], {day:"numeric", month:"long"});
  if (f.days < 2) return `<div class="history"><h2>${de?"Preisverlauf":"Price history"}</h2><p>${de?`Wir zeichnen den Preis dieses Angebots seit ${fd(Object.values(HIST[d.id]||[[DATA.updated.slice(0,10)]])[0][0])} selbst auf. Ab morgen siehst du hier, wie sich der Preis entwickelt.`:`We have been recording this deal's price ourselves since ${fd((HIST[d.id]||[[DATA.updated.slice(0,10)]])[0][0])}. From tomorrow you will see how it develops here.`}</p></div>`;
  const real = f.max30 ? Math.round((1 - d.now / f.max30) * 100) : null;
  const inflated = f.days >= 7 && f.max30 && d.was > f.max30 * 1.15;
  return `<div class="history"><h2>${de?"Preisverlauf":"Price history"}</h2>${spark(f.h)}
    <ul class="hist-facts">
      <li><span>${de?"Tiefster Preis seit":"Lowest since"} ${fd(f.first)}</span><strong>${eur(f.min, lang)}</strong></li>
      ${f.min30!=null?`<li><span>${de?"Tiefster Preis der letzten 30 Tage":"Lowest in the last 30 days"}</span><strong>${eur(f.min30, lang)}</strong></li>`:""}
      ${real!=null && real>0?`<li><span>${de?"Echter Rabatt ggü. dem höchsten Preis der letzten 30 Tage":"Real discount vs. highest price in the last 30 days"}</span><strong>−${real}%</strong></li>`:""}
    </ul>
    ${inflated?`<p class="warn">${de?"Fake-Rabatt-Check: Den Streichpreis von "+eur(d.was,lang)+" haben wir in den letzten 30 Tagen nie gesehen. Der echte Rabatt ist kleiner, als die Prozentangabe vermuten lässt.":"Fake discount check: we never saw the strike-through price of "+eur(d.was,lang)+" in the last 30 days. The real discount is smaller than the percentage suggests."}</p>`:""}
    <p class="stamp">${de?"Eigene Aufzeichnung von perldeals, ein Wert pro Tag.":"Recorded by perldeals, one value per day."}</p></div>`;
}

/* ---------------- routes ---------------- */
const CATS = {
  phone:     {icon:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>', de:["Smartphones","smartphones"], en:["Smartphones","smartphones"]},
  watch:     {icon:'<rect x="6.5" y="6.5" width="11" height="11" rx="3"/><path d="M9 6.5 9.6 2.5h4.8L15 6.5M9 17.5l.6 4h4.8l.6-4M12 9.5V12l1.5 1.5"/>', de:["Smartwatches","smartwatches"], en:["Smartwatches","smartwatches"]},
  headphones:{icon:'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.8"/>', de:["Kopfhörer","kopfhoerer"], en:["Headphones","headphones"]},
  speaker:   {icon:'<rect x="5" y="3" width="14" height="18" rx="3"/><circle cx="12" cy="14" r="3.5"/><circle cx="12" cy="7.2" r="1.2"/>', de:["Lautsprecher","lautsprecher"], en:["Speakers","speakers"]},
  tv:        {icon:'<rect x="2.5" y="11" width="19" height="6" rx="3"/><circle cx="7" cy="14" r="1.1"/><circle cx="12" cy="14" r="1.1"/><circle cx="17" cy="14" r="1.1"/><path d="M5 20h14"/>', de:["TV & Soundbars","tv-soundbars"], en:["TV & soundbars","tv-soundbars"]},
  computer:  {icon:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>', de:["PC & Gaming","pc-gaming"], en:["PC & gaming","pc-gaming"]},
  smarthome: {icon:'<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><circle cx="12" cy="14.5" r="2.2"/>', de:["Smart Home","smart-home"], en:["Smart home","smart-home"]},
  kitchen:   {icon:'<path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M3 10h18M9 6.5c0-1 1-1.5 1-2.5M13 6.5c0-1 1-1.5 1-2.5"/>', de:["Küche","kueche"], en:["Kitchen","kitchen"]},
  home:      {icon:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="4.2"/><path d="M8 6.5h2"/>', de:["Haushalt","haushalt"], en:["Household","household"]},
  tools:     {icon:'<path d="M14.5 4.5a4 4 0 0 0 4.9 5L10 19a2.1 2.1 0 0 1-3-3l9.5-9.4a4 4 0 0 0-2-2.1z"/>', de:["Werkzeug","werkzeug"], en:["Tools","tools"]},
  garden:    {icon:'<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7zM12 15c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z"/><path d="M6 21h12"/>', de:["Garten","garten"], en:["Garden","garden"]},
  sport:     {icon:'<path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/>', de:["Sport & Fitness","sport-fitness"], en:["Sport & fitness","sport-fitness"]},
  pokemon:   {icon:'<circle cx="12" cy="12" r="9"/><path d="M3 12h6M15 12h6"/><circle cx="12" cy="12" r="3"/>', de:["Pokémon","pokemon"], en:["Pokémon","pokemon"]},
  vegan:     {icon:'<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19c3-4 6-7 10-10"/>', de:["Vegan","vegan"], en:["Vegan","vegan"]},
  toys:      {icon:'<rect x="4" y="9" width="16" height="11" rx="1.5"/><rect x="6.5" y="5.5" width="4" height="3.5" rx="1"/><rect x="13.5" y="5.5" width="4" height="3.5" rx="1"/>', de:["Spielzeug","spielzeug"], en:["Toys","toys"]},
  travel:    {icon:'<path d="M3 13l8-2 4-7h2l-1.5 7 4.5-1 1.5 1.5-5 2.5-3 5h-2l1-5-6 1.5z"/><path d="M4 21h16"/>', de:["Reisen","reisen"], en:["Travel","travel"]},
  beauty:    {icon:'<path d="M9 3h6v5H9z"/><path d="M8 8h8l1 13H7z"/><path d="M10 13h4"/>', de:["Beauty & Pflege","beauty-pflege"], en:["Beauty & care","beauty-care"]},
  pets:      {icon:'<circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="10" cy="5.5" r="1.6"/><circle cx="14" cy="5.5" r="1.6"/><path d="M12 11.5c-3 0-5.5 3.5-5.5 6 0 1.6 1.4 2.5 3 2.2l2.5-.5 2.5.5c1.6.3 3-.6 3-2.2 0-2.5-2.5-6-5.5-6z"/>', de:["Haustier","haustier"], en:["Pets","pets"]}
};
const catHas = (d, k) => d.cat === k || (k === "vegan" && d.vegan) || (k === "pokemon" && /pok[eé]mon/i.test(d.title.de));

const GIFT_EN = {"geschenke-unter-25-euro":"gifts-under-25-euro","geschenke-unter-50-euro":"gifts-under-50-euro","geschenke-unter-100-euro":"gifts-under-100-euro","geschenke-fuer-gamer":"gifts-for-gamers","geschenke-fuer-kinder":"gifts-for-kids","technik-geschenke":"tech-gifts"};
const R = {
  home:   {de:"/", en:"/en/"},
  deal:   {de:id=>`/deals/${id}/`, en:id=>`/en/deals/${id}/`},
  guide:  {de:id=>`/kaufberatung/${id}/`, en:id=>`/en/buying-guide/${id}/`},
  guides: {de:"/kaufberatung/", en:"/en/buying-guide/"},
  article:{de:id=>`/ratgeber/${id}/`, en:id=>`/en/compare/${id}/`},
  best:   {de:id=>`/bestenliste/${id}/`, en:id=>`/en/best/${id}/`},
  bestIndex:{de:"/bestenliste/", en:"/en/best/"},
  bf:     {de:"/black-friday/", en:"/en/black-friday/"},
  advisor:{de:"/berater/", en:"/en/advisor/"},
  gifts:  {de:"/geschenke/", en:"/en/gifts/"},
  codes:  {de:"/rabatte/", en:"/en/discounts/"},
  coupon: {de:k=>`/gutscheine/${k}/`, en:k=>`/en/coupons/${k}/`},
  gift:   {de:id=>`/geschenke/${id}/`, en:id=>`/en/gifts/${GIFT_EN[id]||id}/`},
  account:{de:"/konto/", en:"/en/account/"},
  shop:   {de:k=>`/shop/${k}/`, en:k=>`/en/shop/${k}/`},
  cat:    {de:k=>`/kategorie/${CATS[k].de[1]}/`, en:k=>`/en/category/${CATS[k].en[1]}/`},
  imprint:{de:"/impressum/", en:"/en/imprint/"},
  privacy:{de:"/datenschutz/", en:"/en/privacy/"},
  money:  {de:"/so-finanzieren-wir-uns/", en:"/en/how-we-make-money/"}
};
const icon = (cat, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CATS[cat].icon}</svg>`;

/* ---------------- UI strings ---------------- */
const UI = {
  de:{
    search:"Suchen …", searchLabel:"Deals durchsuchen", theme:"Hell- oder Dunkelmodus umschalten",
    langSwitch:"EN", langSwitchLabel:"English version", skip:"Zum Inhalt springen",
    ad:"Anzeige", toDeal:"Zum Deal", atShop:n=>`Bei ${n.replace(".de","")} ansehen`, saved:"gespart", insteadOf:"statt", best:"Bestpreis",
    all:"Alle", sortTop:"Top", sortNew:"Neueste", sortDisc:"Rabatt", sortPrice:"Preis", sortLabel:"Sortierung", cats:"Kategorien",
    current:"Aktuelle Deals", empty:"Kein Deal passt zu deiner Suche. Probier einen anderen Begriff.",
    guideLink:"Kaufberatung lesen →", details:"Details", priceAt:"Preis im Shop am", priceNote:"Preise können sich ändern. Für einen Kauf über diesen Link erhalten wir eine Provision.", more:"mehr dazu",
    footerDeals:"Deals", footerGuides:"Kaufberatung", footerMoney:"So finanzieren wir uns", footerImprint:"Impressum", footerPrivacy:"Datenschutz",
    disclosure:"<b>Werbehinweis:</b> Mit „Anzeige“ markierte Links führen zu Shops, von denen wir bei einem Kauf eine Provision erhalten. Der Preis für dich ändert sich dadurch nicht. Als Amazon-Partner verdienen wir an qualifizierten Verkäufen. Außerdem nehmen wir am eBay Partner Network und am Partnernetzwerk Awin teil. Preise können sich nach dem angegebenen Zeitpunkt geändert haben; maßgeblich ist der Preis im Shop zum Zeitpunkt des Kaufs.",
    home:"Start", related:"Ähnliche Deals", minutes:"Uhr", account:"Preisalarme und Konto", setAlert:"Preisalarm stellen"
  },
  en:{
    search:"Search …", searchLabel:"Search deals", theme:"Toggle light or dark mode",
    langSwitch:"DE", langSwitchLabel:"Deutsche Version", skip:"Skip to content",
    ad:"Ad", toDeal:"Get deal", atShop:n=>`View at ${n.replace(".de","")}`, saved:"saved", insteadOf:"was", best:"Best price",
    all:"All", sortTop:"Top", sortNew:"Newest", sortDisc:"Discount", sortPrice:"Price", sortLabel:"Sort order", cats:"Categories",
    current:"Latest deals", empty:"No deal matches your search. Try another term.",
    guideLink:"Read the buying guide →", details:"Details", priceAt:"Shop price as of", priceNote:"Prices may change. We earn a commission if you buy through this link.", more:"learn more",
    footerDeals:"Deals", footerGuides:"Buying guides", footerMoney:"How we make money", footerImprint:"Legal notice", footerPrivacy:"Privacy",
    disclosure:"<b>Advertising notice:</b> Links marked “Ad” lead to shops that pay us a commission when you buy. Your price stays the same. As an Amazon Associate we earn from qualifying purchases. We also participate in the eBay Partner Network and the Awin affiliate network. Prices may have changed since the time shown; the price in the shop at the time of purchase applies.",
    home:"Home", related:"Similar deals", minutes:"", account:"Price alerts and account", setAlert:"Set a price alert"
  }
};

/* ---------------- layout ---------------- */
/* Ankauf-Werbung: Banner (Footer/Pokémon-Seiten) und schmale Leiste unter dem Menü */
const AK_WORDS = ["Pokémon-Karten!","Retro-Konsolen!","Yu-Gi-Oh-Karten!","LEGO-Sets!","Pokémon-Karten!"];
function akBanner(){ return `<div class="wrap"><a class="ak-banner" href="/reseller/karten-ankauf/" aria-label="Wir kaufen deine Karten, Konsolen und LEGO – jetzt Ankauf anfragen">
  <div class="ak-fan" aria-hidden="true">${[0,1,2,3,4].map(i => `<span class="ak-card c${i}"><i></i></span>`).join("")}</div>
  <div class="ak-copy"><span class="ak-kicker">Ankauf · kostenlos &amp; unverbindlich</span>
    <strong class="ak-head">Wir kaufen deine <span class="ak-rot" aria-hidden="true">${AK_WORDS.map(w => `<b>${w}</b>`).join("")}</span><span class="sr">Sammlerstücke!</span></strong>
    <span class="ak-sub">Pokémon, Yu-Gi-Oh, One Piece, Retro-Konsolen, Videospiele und LEGO: Fotos per WhatsApp schicken, Angebot bekommen.</span>
    <span class="ak-btn">📲 Jetzt anfragen <span aria-hidden="true">→</span></span></div></a></div>`; }
function akStrip(){ return `<a class="ak-strip" href="/reseller/karten-ankauf/" aria-label="Ankauf: Wir kaufen deine Karten, Konsolen und LEGO"><span class="wrap"><span class="ak-mini" aria-hidden="true"><i></i><i></i><i></i></span><span class="ak-st"><span class="ak-x">💰 </span>Wir kaufen <span class="ak-x">deine </span><span class="ak-rot" aria-hidden="true">${AK_WORDS.map(w => `<b>${w}</b>`).join("")}</span><span class="sr">Sammlerstücke!</span></span><span class="ak-sbtn">Jetzt anfragen →</span></span></a>`; }
const OG_PAGES = new Map();
function layout({lang, pathFor, title, description, body, ld = [], bodyClass = "", type = "website", noindex = false, scripts = [], image = "", single = false}){
  // 13.11.: Seiten ohne eigenes Bild bekommen eine Text-Teilen-Karte (scripts/og-pages.mjs rendert sie nach dem Build)
  let img = image;
  if (!img && !noindex) { try { const pth = pathFor(lang) || "/"; const slug = (pth.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-") || "start").slice(0, 120); img = `/assets/og/page/${slug}.jpg`; OG_PAGES.set(slug, {t: title.replace(/ · perldeals$/, ""), p: pth}); } catch (e) {} }
  img = img || "/assets/og/default.jpg";
  let AKSHOW = false; try { AKSHOW = lang === "de" && !/^\/reseller\/(karten-ankauf|ankauf)\//.test(pathFor("de") || "") && !noindex; } catch (e) {}
  // SEO lengths: titles ≤ 65 visible chars, descriptions 70–158
  if (title.length > 65) title = title.replace(/ · perldeals$/, "");
  if (title.length > 70) title = title.slice(0, 68).replace(/[\s,;:–-]+\S*$/, "") + " …";
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, "") + " …";
  if (description.length < 70) description = `${description} ${lang==="de"?"perldeals: geprüfte Deals und ehrliche Kaufberatung.":"perldeals: checked deals and honest buying guides."}`.trim();
  const u = UI[lang], other = lang === "de" ? "en" : "de";
  const self = pathFor(lang), alt = pathFor(other);
  // Black-Friday-Erinnerung oben auf allen BF-/Black-Week-/Cyber-Monday-Seiten (Nico 06.11.: Adressen sammeln, am 27.11. zurückholen)
  if (BF_SEASON && /\/(black-friday|black-week|cyber-monday)/.test(self || "") && !body.includes('data-source="bf-top"')) {
    const box = bfTopBox(lang);
    const i = body.indexOf("<section");
    body = i > 0 ? body.slice(0, i) + box + body.slice(i) : box + body;
  }
  if (!noindex) pages.push({path:self, alt: single ? {[lang]:self} : {[lang]:self, [other]:alt}});
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="p:domain_verify" content="2d1a9a5cf918dd5b2e18eed646ac164e">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">${noindex?'\n<meta name="robots" content="noindex">':""}
<link rel="canonical" href="${BASE}${self}">
<link rel="alternate" type="application/rss+xml" title="perldeals – neue Deals" href="${BASE}/feed.xml">
${single ? "" : `<link rel="alternate" hreflang="de" href="${BASE}${lang==="de"?self:alt}">
<link rel="alternate" hreflang="en" href="${BASE}${lang==="en"?self:alt}">
<link rel="alternate" hreflang="x-default" href="${BASE}${lang==="de"?self:alt}">`}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="perldeals">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${BASE}${self}">
<meta property="og:locale" content="${lang==="de"?"de_DE":"en_GB"}">
<meta property="og:locale:alternate" content="${lang==="de"?"en_GB":"de_DE"}">
<meta name="p:domain_verify" content="2d1a9a5cf918dd5b2e18eed646ac164e">
<meta property="og:image" content="${/^https?:/.test(img) ? img : BASE + img}">${img.startsWith("/assets/og/")?`
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">`:""}
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${/^https?:/.test(img) ? img : BASE + img}">
<meta name="theme-color" content="#0B776B">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/bricolage.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/style.css?v=${VERSION}">
<script src="/assets/theme.js?v=${VERSION}"></script>
${ld.map(ldjson).join("\n")}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">${u.skip}</a>
<header class="top">
  <div class="wrap">
    <a class="logo" href="${R.home[lang]}" aria-label="perldeals"><span class="pearl" aria-hidden="true"></span><span class="word">perldeals</span></a>
    <form class="search" id="search-form" role="search" action="${R.home[lang]}" method="get">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" name="q" type="search" placeholder="${esc(u.search)}" aria-label="${esc(u.searchLabel)}" autocomplete="off" maxlength="80">
    </form>
    <a class="icon-btn" href="${single ? R.home[other] : alt}" hreflang="${other}" lang="${other}" aria-label="${esc(u.langSwitchLabel)}">${u.langSwitch}</a>
    <a class="icon-btn" href="${R.account[lang]}" aria-label="${esc(u.account)}" title="${esc(u.account)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></a>
    <button class="icon-btn" id="theme-toggle" type="button" aria-label="${esc(u.theme)}">
      <svg class="i-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>
      <svg class="i-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </button>
  </div>
  <nav class="subnav" aria-label="${lang==="de"?"Bereiche":"Sections"}"><div class="wrap">${lang==="de"?`
    <span class="mode-switch" role="group" aria-label="Ansicht wählen"><button type="button" data-mode-set="privat" title="Ansicht für Privatkäufer">👤 Privat</button><button type="button" data-mode-set="reseller" title="Ansicht für Sammler und Reseller">🃏 Reseller</button></span>`:""}
    <a href="${R.home[lang]}">Deals</a>
    <a href="${R.advisor[lang]}">✨ ${lang==="de"?"KI-Berater":"AI advisor"}</a>
    <a href="${R.bf[lang]}" class="hot">Black Friday</a>
    <a href="${SOCIAL.wa}" target="_blank" rel="noopener" class="wa-nav">📲 ${lang==="de"?"WhatsApp-Kanal":"WhatsApp channel"}</a>
    <a href="${R.cat[lang]("vegan")}">🌱 Vegan</a>
    <a href="${R.cat[lang]("travel")}">✈️ ${lang==="de"?"Reisen":"Travel"}</a>${lang==="de"?`
    <a href="/reseller/pokemon-haendler/">⚡ Pokémon</a>`:""}${lang==="de"?`
    <a href="/reseller/">🃏 Reseller</a>
    <a href="/reseller/karten-ankauf/">💰 Ankauf</a>
    <a class="nav-rs" href="/reseller/release-kalender/">📅 Termine</a>
    <a class="nav-rs" href="/reseller/lego-eol/">🧱 LEGO-EOL</a>
    <a class="nav-rs" href="/reseller/rechner/">🧮 Rechner</a>
    <a class="nav-rs" href="/reseller/ebay-shop/">🛒 eBay-Shop</a>`:""}
    <a href="${R.codes[lang]}">🏷️ ${lang==="de"?"Rabatte":"Discounts"}</a>
    <a href="${R.bestIndex[lang]}">${lang==="de"?"Bestenlisten":"Best lists"}</a>
    <a href="${R.gifts[lang]}">${lang==="de"?"Geschenke":"Gifts"}</a>
    <a href="${R.guides[lang]}">${lang==="de"?"Kaufberatung":"Guides"}</a>
  </div></nav>
</header>
${AKSHOW ? akStrip() : ""}
<main id="main">
${body}
${AKSHOW && !body.includes("ak-banner") ? `<div class="ak-foot">${akBanner()}</div>` : ""}
</main>
<footer>
  <div class="wrap">
    <nav aria-label="Footer">
      <a href="${R.home[lang]}">${u.footerDeals}</a><a href="${R.guides[lang]}">${u.footerGuides}</a><a href="${R.bestIndex[lang]}">${lang==="de"?"Bestenlisten":"Best lists"}</a><a href="${R.gifts[lang]}">${lang==="de"?"Geschenke":"Gifts"}</a><a href="${R.codes[lang]}">${lang==="de"?"Rabatte":"Discounts"}</a><a href="${R.bf[lang]}">Black Friday</a><a href="${lang==="de"?"/abgelaufene-deals/":"/en/expired-deals/"}">${lang==="de"?"Verpasste Deals":"Expired deals"}</a>${lang==="de"?`<a href="/vegan-ratgeber/">Vegan-Ratgeber</a><a href="/wasserdicht/">Ist das wasserdicht?</a>`:""}<a href="${SOCIAL.wa}" target="_blank" rel="noopener">WhatsApp</a><a href="${SOCIAL.tg}" target="_blank" rel="noopener">Telegram</a><a href="${SOCIAL.fb}" target="_blank" rel="noopener">Facebook</a><a href="${R.account[lang]}">${u.account}</a><a href="${R.money[lang]}">${u.footerMoney}</a>${lang==="de"?`<a href="/karriere/">Jobs</a>`:""}<a href="${R.imprint[lang]}">${u.footerImprint}</a><a href="${R.privacy[lang]}">${u.footerPrivacy}</a>
    </nav>
    ${HUBS && HUBS.seasons ? `<nav aria-label="${lang==="de"?"Aktionstage":"Shopping events"}" class="foot-shops"><a href="${R.bf[lang]}">Black Friday</a>${Object.keys(HUBS.seasons).map(k=>`<a href="${HUBS.seasons[k].path[lang]}">${esc(HUBS.seasons[k][lang].eyebrow)}</a>`).join("")}</nav>` : ""}
    <nav aria-label="${lang==="de"?"Folge uns":"Follow us"}" class="foot-social"><strong>${lang==="de"?"Deals aufs Handy:":"Deals on your phone:"}</strong><a href="${SOCIAL.wa}" target="_blank" rel="noopener">WhatsApp-Kanal</a><a href="${SOCIAL.tg}" target="_blank" rel="noopener">Telegram</a><a href="${SOCIAL.fb}" target="_blank" rel="noopener">${lang==="de"?"Facebook-Gruppe":"Facebook group"}</a>${lang==="de"?`<a href="/reseller/ebay-shop/">eBay-Shop & Live-Auktionen</a>`:""}</nav>
    ${lang==="en" && TOPICS.length ? `<nav aria-label="Popular deals" class="foot-shops">${TOPICS.filter(T => !T.price && topicIndexed(T) && TOPICS_EN[T.slug]).sort((a,b)=>TOPIC_LIVE[b.slug].length-TOPIC_LIVE[a.slug].length).slice(0,14).map(T => `<a href="${TOPIC_EN_PATH(T)}">${esc(TOPICS_EN[T.slug].h)}</a>`).join("")}<a href="/en/offers/">All topics and brands</a><a href="/en/knowledge/">Knowledge</a></nav>` : ""}
    ${lang==="de" && TOPICS.length ? `<nav aria-label="Beliebte Angebote" class="foot-shops">${TOPICS.filter(T => !T.price && topicIndexed(T)).sort((a,b)=>TOPIC_LIVE[b.slug].length-TOPIC_LIVE[a.slug].length).slice(0,14).map(T => `<a href="${TOPIC_PATH(T.slug)}">${esc(T.h.replace(/ im Angebot.*$/,""))}</a>`).join("")}<a href="/angebote/">Alle Themen und Marken</a><a href="/wissen/">Wissen</a><a href="/reseller/">Reseller &amp; Sammler</a><a href="/reseller/lego-eol/">LEGO EOL 2026</a><a href="/reseller/pokemon/">Pokémon Neuerscheinungen</a></nav>` : ""}
    <nav aria-label="${lang==="de"?"Kategorien":"Categories"}" class="foot-shops"><strong>${lang==="de"?"Kategorien:":"Categories:"}</strong>${Object.keys(CATS).filter(k => k==='vegan' || k==='travel' || DATA.deals.some(d => catHas(d, k))).map(k=>`<a href="${R.cat[lang](k)}">${esc(CATS[k][lang][0])}</a>`).join("")}</nav>
    <nav aria-label="Shops" class="foot-shops">${Object.keys(SHOPS).map(k=>`<a href="${R.shop[lang](k)}">${SHOPS[k].name} ${lang==="de"?"Angebote":"deals"}</a>`).join("")}</nav>
    <p class="disclosure">${u.disclosure}</p>
    <p class="disclosure">© 2026 perldeals</p>
  </div>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/assets/search.js?v=${VERSION}" defer></script>
<script src="/assets/app.js?v=${VERSION}" defer></script>${scripts.map(f=>`\n<script src="/assets/${f}?v=${VERSION}" defer></script>`).join("")}
</body>
</html>`;
  write(self, html);
}

function write(urlPath, html){
  const file = urlPath.endsWith("/") ? path.join(OUT, urlPath, "index.html") : path.join(OUT, urlPath);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, html);
}

/* ---------------- components ---------------- */
const isVegan = d => !!d.vegan || d.cat === "vegan";
const veganTag = (d, lang) => isVegan(d) ? ` <span class="vegan-tag" title="${lang==="de"?"Laut Hersteller/Shop vegan":"Vegan according to maker/shop"}">🌱 Vegan</span>` : "";
const SHARE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/></svg>';
const shareBtn = (d, lang, big) => { const de = lang === "de", t = NP(d) ? `${d.title[lang]} bei Amazon, zuletzt gemeldet −${pct(d)} %` : `${d.title[lang]} für ${eur(d.now, lang)} statt ${eur(d.was, lang)} (−${pct(d)} %)`; const te = NP(d) ? `${d.title[lang]} at Amazon, last reported −${pct(d)}%` : `${d.title[lang]} for ${eur(d.now, lang)} instead of ${eur(d.was, lang)} (−${pct(d)}%)`;
  return `<button class="share-btn${big?" btn btn-ghost":""}" type="button" data-share="https://perldeals.com${R.deal[lang](d.id)}" data-share-text="${esc(de ? t : te)}" aria-label="${de?"Deal teilen":"Share deal"}" title="${de?"Teilen":"Share"}">${SHARE_SVG}${big?`<span>${de?"Teilen":"Share"}</span>`:""}</button>`; };
function card(d, lang){
  const u = UI[lang], t = d.title[lang];
  const text = `${t} ${d.brand} ${CATS[d.cat][lang][0]}`.toLowerCase();
  const rsHit = /pok[eé]mon|one piece|\blego\b|playstation|\bps5\b|nintendo switch|xbox|steam deck|spielkonsole|sammelkarte|booster|\btcg\b|top-trainer/i.test(`${d.title.de} ${d.brand||""}`);
  return `<li class="card" data-id="${d.id}"${rsHit?' data-rs="1"':""} data-added="${d.added}" data-disc="${pct(d)}" data-low="${d.low?1:0}" data-price="${d.now}" data-text="${esc(text)}">
    <a class="visual" href="${R.deal[lang](d.id)}" tabindex="-1" aria-hidden="true">${pic(d,64)}<span class="brand">${esc(d.brand)}</span>${discBadge(d)}${d.low?`<span class="low">${u.best}</span>`:""}</a>
    <div class="card-body">
      <div class="meta"><span>${esc(CATS[d.cat][lang][0])}</span><span>·</span><span>${esc(shopName(d))}</span><span>·</span><time datetime="${d.added}">${fmtDate(d.added, lang)}</time></div>
      <h3><a href="${R.deal[lang](d.id)}">${esc(t)}</a>${veganTag(d, lang)}</h3>
      ${NP(d) ? npPrice(d, lang) : `<div class="price"><span class="now">${eur(d.now, lang)}</span><span class="was" aria-label="${u.insteadOf} ${eur(d.was, lang)}">${eur(d.was, lang)}</span><span class="save">${eur(d.was-d.now, lang)} ${u.saved}</span></div>${idealoLine(d, lang, true)}`}
      ${GUIDES[d.id] ? `<a class="more" href="${R.guide[lang](d.id)}">${u.guideLink}</a>` : ""}
      <div class="card-foot"><a class="btn btn-primary" href="${dealLink(d)}" ${AFF}>${u.toDeal} <span class="ad-tag">${u.ad}</span></a>${shareBtn(d, lang)}</div>
    </div>
  </li>`;
}

function rail(lang, activeCat){
  const u = UI[lang];
  const counts = Object.fromEntries(Object.keys(CATS).map(k => [k, DATA.deals.filter(d => catHas(d, k)).length]));
  return `<div class="rail"><div class="wrap">
    <nav class="chips" aria-label="${u.cats}">
      <a class="chip" href="${R.home[lang]}"${!activeCat?' aria-current="page"':""}>${u.all} <span class="n">${DATA.deals.length}</span></a>
      ${Object.keys(CATS).filter(k => counts[k] || k==='travel' || activeCat===k).map(k => `<a class="chip" href="${R.cat[lang](k)}"${activeCat===k?' aria-current="page"':""}>${esc(CATS[k][lang][0])} <span class="n">${counts[k]}</span></a>`).join("")}
    </nav>
    <label class="cat-select"><span class="sr-only">${u.cats}</span><select aria-label="${u.cats}">
      <option value="${R.home[lang]}"${!activeCat?" selected":""}>${u.all} (${DATA.deals.length})</option>
      ${Object.keys(CATS).filter(k => counts[k] || k==='travel' || activeCat===k).map(k => `<option value="${R.cat[lang](k)}"${activeCat===k?" selected":""}>${esc(CATS[k][lang][0])} (${counts[k]})</option>`).join("")}
    </select></label>
    <div class="sort" role="group" aria-label="${u.sortLabel}" data-label="${u.sortLabel}">
      <button type="button" data-sort="top" aria-pressed="true">${u.sortTop}</button>
      <button type="button" data-sort="new" aria-pressed="false">${u.sortNew}</button>
      <button type="button" data-sort="disc" aria-pressed="false">${u.sortDisc}</button>
      <button type="button" data-sort="price" aria-pressed="false">${u.sortPrice}</button>
    </div>
  </div></div>`;
}

function grid(list, lang, headingTag, heading){
  const u = UI[lang];
  return `<section class="wrap" aria-labelledby="feed-title">
    <div class="feed-head"><${headingTag} id="feed-title">${esc(heading)}</${headingTag}><span class="count" id="count">${list.length} ${list.length===1?"Deal":(lang==="de"?"Deals":"deals")}</span></div>
    <ul class="grid" id="grid">${list.map(d => card(d, lang)).join("")}<li class="empty" id="empty" hidden>${u.empty}</li></ul>
  </section>`;
}

function crumbs(lang, items){
  const ld = {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":items.map((it,i)=>({"@type":"ListItem","position":i+1,"name":it[0],...(it[1]?{"item":BASE+it[1]}:{})}))};
  return {html:`<ol class="crumbs">${items.map(it => `<li>${it[1]?`<a href="${it[1]}">${esc(it[0])}</a>`:`<span aria-current="page">${esc(it[0])}</span>`}</li>`).join("")}</ol>`, ld};
}

/* "Top" order: discount + best-price bonus + freshness bonus that fades over ~2 days,
   so new strong deals rise to the top and older ones slowly move down (same formula in app.js) */
const NOW_MS = Date.now();
// Spontankauf-Bonus (Nico 05.11.): günstige Deals konvertieren besser als Großgeräte -> unter 50 € +8, unter 100 € +4
const impulse = d => NP(d) ? 0 : d.now <= 50 ? 8 : d.now <= 100 ? 4 : 0;
const topScore = d => pct(d) + (d.low ? 10 : 0) + impulse(d) + 40 * Math.exp(-Math.max(0, NOW_MS - new Date(d.added).getTime()) / 36e5 / 36);
const sorted = DATA.deals.slice().sort((a,b) => topScore(b) - topScore(a));
const ORG_SAMEAS = [SOCIAL.wa, SOCIAL.tg, SOCIAL.fb, EBAY_SHOP, "https://www.instagram.com/perldeals/", "https://www.tiktok.com/@perldeals", "https://de.pinterest.com/perldeals/", "https://www.linkedin.com/company/perldeals/"];
const ORG = {"@type":"Organization","@id":`${BASE}/#org`,"name":"perldeals","alternateName":"perldeals.com","url":`${BASE}/`,"logo":{"@type":"ImageObject","url":`${BASE}/assets/logo.png`,"width":720,"height":720},"image":`${BASE}/assets/logo.png`,"description":"perldeals ist ein unabhängiges Deal-Portal aus Hagen a.T.W.: täglich geprüfte Angebote von Amazon, eBay, OTTO, Alternate und weiteren Shops, mit Preisverlauf, Preisalarm und ohne Fake-Rabatte.","email":SITE.email,"telephone":SITE.phone,"foundingDate":"2026-10","address":{"@type":"PostalAddress","streetAddress":SITE.street,"postalCode":SITE.zip,"addressLocality":SITE.city,"addressCountry":"DE"},"vatID":SITE.vatId,"areaServed":"DE","knowsLanguage":["de","en"],"sameAs":ORG_SAMEAS};
const VERSION = (await import("node:crypto")).createHash("md5").update(fs.readdirSync(`${SRC}/assets`).filter(f => /\.(css|js)$/.test(f)).sort().map(f => fs.readFileSync(`${SRC}/assets/${f}`, "utf8")).join("")).digest("hex").slice(0, 8);
const pages = [];

/* ---------------- pages ---------------- */
function buildHome(lang){
  // "Perle des Tages": the highest-ranked deal (discount + best price + freshness, see topScore), preferably with a photo
  const u = UI[lang], top = sorted.slice(0, 12).find(d => d.img) || sorted[0];
  const C = {
    de:{eyebrow:`${fmtDay(DATA.updated, "de")} · ${DATA.deals.length} Deals geprüft`, h1:"Nur die <em>Perlen</em> unter den Deals.",
        lead:"Wir prüfen jeden Rabatt gegen den Preisverlauf und andere Händler, bevor er hier landet. Zu beliebten Produkten schreiben wir Kaufberatungen, die die wichtigste Frage zuerst beantworten: Lohnt sich das?",
        facts:["Preisverlauf geprüft","Keine Fake-Rabatte","Täglich neue Deals"], tag:"Perle des Tages",
        bandEyebrow:"Kaufberatung", bandH:"Bevor du kaufst: Lohnt sich das wirklich?", bandP:"Zu Produkten, die viele kaufen, fassen wir Fakten, Stärken und Schwächen zusammen. Bald kommen die Erfahrungen unserer Community dazu: Wer gekauft hat, berichtet.",
        bandCta:"Alle Kaufberatungen", steps:[["Fakten prüfen","Technische Daten und Preisverlauf aus verlässlichen Quellen."],["Stärken und Schwächen","Klar benannt, ohne Werbesprech."],["Regelmäßig aktualisieren","Mit Datum, damit du siehst, wie aktuell es ist."]],
        title:"perldeals: Deals & Schnäppchen heute – geprüft, ohne Fake-Rabatte", desc:"Die besten Deals und Schnäppchen des Tages bei Amazon, eBay, OTTO und Co., gegen den Preisverlauf geprüft. Mit Kaufberatung zu beliebten Produkten. Täglich aktualisiert."},
    en:{eyebrow:`${fmtDay(DATA.updated, "en")} · ${DATA.deals.length} deals checked`, h1:"Only the <em>pearls</em> among the deals.",
        lead:"We check every discount against price history and other retailers before it lands here. For popular products we write buying guides that answer the key question first: is it worth it?",
        facts:["Price history checked","No fake discounts","New deals daily"], tag:"Pearl of the day",
        bandEyebrow:"Buying guides", bandH:"Before you buy: is it really worth it?", bandP:"For products many people buy, we sum up the facts, strengths and weaknesses. Soon our community's experiences will be added: people who bought it report back.",
        bandCta:"All buying guides", steps:[["Check the facts","Specs and price history from reliable sources."],["Strengths and weaknesses","Named clearly, without marketing speak."],["Updated regularly","Dated, so you can see how current it is."]],
        title:"perldeals – checked deals and honest buying guides", desc:"Today's best deals from Amazon.de, OTTO and more, checked against price history. Plus buying guides for popular products. Updated daily."}
  }[lang];
  const ld = [
    {"@context":"https://schema.org","@graph":[ORG,{"@type":"WebSite","@id":`${BASE}/#website`,"url":BASE+R.home[lang],"name":"perldeals","inLanguage":lang,"publisher":{"@id":`${BASE}/#org`},"potentialAction":{"@type":"SearchAction","target":`${BASE}${R.home[lang]}?q={search_term_string}`,"query-input":"required name=search_term_string"}}]},
    {"@context":"https://schema.org","@type":"ItemList","name":u.current,"itemListElement":sorted.map((d,i)=>({"@type":"ListItem","position":i+1,"url":BASE+R.deal[lang](d.id),"name":d.title[lang]}))}
  ];
  const bfDays = Math.ceil((new Date("2026-11-27T00:00:00+01:00") - new Date(DATA.updated)) / 864e5);
  const bfStrip = bfDays >= 0 ? `<div class="wrap"><div class="bf-strip"><strong>${lang==="de"?`🖤 Black Friday in <span class="bf-days" data-bf-days>${bfDays}</span> Tagen`:`🖤 Black Friday in <span class="bf-days" data-bf-days>${bfDays}</span> days`}</strong><span>${lang==="de"?"Die echten Deals per E-Mail, WhatsApp oder Telegram":"The real deals by email, WhatsApp or Telegram"}</span><a class="btn btn-primary" href="#deal-alarm">${lang==="de"?"Deal-Alarm aktivieren":"Activate deal alarm"}</a></div></div>` : "";
  const body = `${bfStrip}
  <section class="hero"><div class="wrap hero-grid">
    <div>
      <div class="eyebrow">${C.eyebrow}</div>
      <h1>${C.h1}</h1>
      <p class="lead">${C.lead}</p>
      <div class="facts">${C.facts.map(f=>`<span><i></i>${f}</span>`).join("")}</div>
      <form class="adv-mini" action="${R.advisor[lang]}" method="get" role="search">
        <label for="adv-mini-q">✨ ${lang==="de"?"Frag den KI-Berater":"Ask the AI advisor"}</label>
        <div><input id="adv-mini-q" name="q" type="text" maxlength="300" placeholder="${lang==="de"?"z. B. Mähroboter für 600 m² unter 700 €":"e.g. noise cancelling headphones under €100"}"><button class="btn btn-primary" type="submit">${lang==="de"?"Fragen":"Ask"}</button></div>
      </form>
    </div>
    <article class="feature">
      <a class="visual" href="${R.deal[lang](top.id)}" tabindex="-1" aria-hidden="true">${pic(top,96)}<span class="tag-dark">${C.tag}</span>${discBadge(top)}</a>
      <div class="feature-body">
        <h2><a href="${R.deal[lang](top.id)}">${esc(top.title[lang])}</a>${veganTag(top, lang)}</h2>
        ${NP(top) ? npPrice(top, lang) : `<div class="price"><span class="now">${eur(top.now, lang)}</span><span class="was">${eur(top.was, lang)}</span><span class="save">${eur(top.was-top.now, lang)} ${u.saved}</span></div>`}
        ${top.note?`<p class="note">${esc(top.note[lang])}</p>`:""}
        <a class="btn btn-primary" href="${dealLink(top)}" ${AFF}>${u.atShop(shopName(top))} <span class="ad-tag">${u.ad}</span></a>
      </div>
    </article>
  </div></section>
  <div class="wrap" id="deal-alarm">${subBox(lang, "home")}${followBox(lang, true)}</div>
  ${rail(lang, null)}
  ${grid(sorted, lang, "h2", u.current)}
  <section class="band"><div class="wrap">
    <div>
      <div class="eyebrow">${C.bandEyebrow}</div>
      <h2>${C.bandH}</h2>
      <p>${C.bandP}</p>
      <a class="btn btn-primary" href="${R.guides[lang]}">${C.bandCta}</a>
    </div>
    <ol class="steps">${C.steps.map(s=>`<li><div><b>${s[0]}</b><span>${s[1]}</span></div></li>`).join("")}</ol>
  </div></section>`;
  layout({lang, pathFor:l=>R.home[l], title:C.title, description:C.desc, body, ld});
}


/* ---------------- shop pages (evergreen SEO pages per partner shop) ---------------- */
const SHOPS = {
  amazon:    {name:"Amazon.de", de:"Amazon.de ist der größte Onlineshop in Deutschland. Hier sammeln wir Amazon-Angebote, die wir gegen den Preisverlauf prüfen: Blitzangebote, Tagesangebote und Preissenkungen bei Technik, Haushalt und Spielzeug.", en:"Amazon.de is Germany's largest online shop. Here we collect Amazon deals that we check against price history: lightning deals, deals of the day and price drops on tech, household and toys."},
  otto:      {name:"OTTO", home:"https://www.otto.de/", de:"OTTO ist einer der großen deutschen Onlineshops für Haushaltsgeräte, Möbel, Technik und Mode, mit eigenem Sortiment und Marktplatz-Händlern. Hier findest du die aktuellen OTTO-Deals, die wir gegen den Preisverlauf geprüft haben.", en:"OTTO is one of Germany's big online shops for appliances, furniture, tech and fashion, with its own range and marketplace sellers. Here are the current OTTO deals we checked against price history."},
  alternate: {name:"Alternate", home:"https://www.alternate.de/", de:"Alternate ist ein deutscher Onlineshop für IT, Unterhaltungselektronik, Haushalt, Garten und Spielzeug. Besonders bekannt sind die täglich wechselnden Tagesdeals. Hier zeigen wir die stärksten Alternate-Angebote.", en:"Alternate is a German online shop for IT, consumer electronics, household, garden and toys, known for its daily changing deals of the day. Here are the strongest Alternate offers."},
  sharkninja:{name:"SharkNinja", home:"https://www.sharkninja.de/", de:"Im offiziellen SharkNinja-Shop gibt es Ninja-Küchengeräte wie Heißluftfritteusen, Mixer und Kaffeemaschinen sowie Shark-Staubsauger und Saugroboter. Hier findest du die aktuell reduzierten Modelle.", en:"The official SharkNinja shop sells Ninja kitchen appliances such as air fryers, blenders and coffee machines, plus Shark vacuums and robot vacuums. Here are the currently discounted models."},
  ebay:      {name:"eBay", de:"Bei eBay gibt es neben Privatverkäufen viele Händlerangebote zum Festpreis, darunter generalüberholte Markenware. Wir zeigen nur Festpreis-Angebote von Händlern mit Vergleichspreis, keine Auktionen.", en:"Besides private sales, eBay has many fixed-price offers from retailers, including refurbished branded products. We only show fixed-price retailer offers with a comparison price, no auctions."},
  myprotein: {name:"Myprotein", home:"https://de.myprotein.com/", de:"Myprotein ist eine Marke für Sporternährung. Wir zeigen dort nur vegane Produkte, etwa pflanzliches Protein und vegane Snacks. Rabatte gibt es oft über zeitlich begrenzte Aktionen.", en:"Myprotein is a sports nutrition brand. We only list its vegan products, such as plant protein and vegan snacks. Discounts often come through limited-time promotions."},
  coolblue:  {name:"Coolblue", home:"https://www.coolblue.de/", de:"Coolblue ist ein Onlineshop aus den Niederlanden für Technik und Haushaltsgeräte, von Laptops und Fernsehern bis zu Waschmaschinen, mit eigener Lieferung und Installationsservice. Hier findest du die aktuellen Coolblue-Angebote mit Preisverlauf.", en:"Coolblue is a Dutch online shop for tech and home appliances, from laptops and TVs to washing machines, with its own delivery and installation service. Here are the current Coolblue deals with price history."},
  notebooksbilliger: {name:"notebooksbilliger.de", home:"https://www.notebooksbilliger.de/", de:"notebooksbilliger.de (NBB) ist ein deutscher Technik-Onlineshop mit Notebooks, PCs, Monitoren, Grafikkarten, Smartphones und Haushaltsgeräten. Regelmäßig gibt es Aktionen wie die Black Weeks. Hier zeigen wir NBB-Angebote, deren Rabatt wir gegen den Preisverlauf geprüft haben.", en:"notebooksbilliger.de (NBB) is a German tech shop for laptops, PCs, monitors, graphics cards, smartphones and home appliances, with regular sales such as Black Weeks. Here are NBB deals checked against price history."},
  evercross: {name:"EVERCROSS", home:"https://evercross.eu/", de:"EVERCROSS verkauft E-Scooter, E-Bikes, Fahrräder und Kinderfahrzeuge mit Versand aus Lagern in Europa. Im Shop gibt es häufig Aktionspreise und Gutscheincodes. Hier findest du reduzierte EVERCROSS-Modelle mit geprüftem Vorpreis.", en:"EVERCROSS sells e-scooters, e-bikes, bicycles and kids’ vehicles shipped from European warehouses, often with sale prices and codes. Here are discounted EVERCROSS models with a checked previous price."},
  aosu: {name:"AOSU", home:"https://de.aosulife.com/", de:"AOSU stellt smarte Überwachungskameras und Video-Türklingeln her, viele davon mit Akku oder Solarpanel und ohne Abo nutzbar. Hier zeigen wir reduzierte AOSU-Kameras aus dem offiziellen Shop.", en:"AOSU makes smart security cameras and video doorbells, many battery or solar powered and usable without a subscription. Here are discounted AOSU cameras from the official shop."},
  anthbot: {name:"ANTHBOT", home:"https://de.anthbot.com/", de:"ANTHBOT baut Mähroboter ohne Begrenzungsdraht, die per Kamera und RTK-Satellitennavigation mähen. Hier findest du ANTHBOT-Angebote aus dem offiziellen deutschen Shop.", en:"ANTHBOT builds wire-free robot lawn mowers using camera and RTK satellite navigation. Here are ANTHBOT deals from the official German shop."},
  autofull: {name:"AutoFull", home:"https://www.autofull.eu/", de:"AutoFull ist eine Marke für Gaming-Stühle und Gaming-Tische mit Versand in Europa. Viele Stühle gibt es mit veganem Kunstleder oder Stoffbezug. Hier zeigen wir reduzierte AutoFull-Modelle.", en:"AutoFull is a brand of gaming chairs and desks shipping across Europe, many chairs with faux leather or fabric covers. Here are discounted AutoFull models."},
  "100percentpure": {name:"100% Pure", home:"https://www.100percentpure.de/", de:"100% Pure ist eine Naturkosmetik-Marke aus Kalifornien mit Pflege, Make-up und Düften auf Basis von Frucht- und Pflanzenpigmenten. Wir zeigen Angebote und Codes aus dem deutschen Shop, vegane Produkte sind gekennzeichnet.", en:"100% Pure is a natural cosmetics brand from California with skincare, make-up and fragrance based on fruit and plant pigments. We show deals and codes from the German shop, vegan products are marked."},
  imou: {name:"Imou", home:"https://store.imou.com/de-de/", de:"Imou bietet WLAN-Überwachungskameras, Video-Türklingeln und Smart-Home-Sicherheit für innen und außen. Hier findest du Angebote und Codes aus dem offiziellen Imou-Store.", en:"Imou offers Wi-Fi security cameras, video doorbells and smart home security for indoors and outdoors. Here are deals and codes from the official Imou store."},
  outin: {name:"OutIn", home:"https://de.outin.com/", de:"OutIn stellt tragbare, akkubetriebene Espressomaschinen für unterwegs her, etwa für Camping, Auto und Büro. Hier zeigen wir reduzierte OutIn-Modelle aus dem offiziellen Shop.", en:"OutIn makes portable battery-powered espresso machines for camping, car and office. Here are discounted OutIn models from the official shop."},
  amazgifts: {name:"Amazgifts", home:"https://amazgifts.de/", de:"Amazgifts verkauft personalisierte Geschenke wie Foto-Projektionsketten und gravierten Schmuck. Laut Shop gibt es kostenlosen Versand ab 60 € und 99 Tage Rückgaberecht. Hier findest du Aktionen und Codes.", en:"Amazgifts sells personalised gifts such as photo projection necklaces and engraved jewellery, with free shipping from €60 and a 99-day return policy per the shop. Here are offers and codes."},
  kikkerland: {name:"Kikkerland", home:"https://kikkerlandeu.com/", de:"Kikkerland Design entwirft seit 1992 originelle Gadgets, Geschenkideen und Alltagshelfer mit Design-Anspruch. Hier zeigen wir Angebote aus dem europäischen Kikkerland-Shop.", en:"Kikkerland Design has created quirky gadgets, gift ideas and everyday helpers since 1992. Here are deals from the European Kikkerland shop."},
  logomatten: {name:"logo-matten.com", home:"https://logo-matten.com/", de:"logo-matten.com fertigt Fußmatten mit eigenem Logo oder Motiv in Wunschgröße, für Firmen, Praxen und Zuhause. Hier findest du Aktionen des Shops.", en:"logo-matten.com makes doormats with your own logo or design in custom sizes for businesses and homes. Here are the shop’s offers."},
  mattenwelt: {name:"Matten Welt", home:"https://matten-welt.com/", de:"Matten Welt verkauft moderne Fußmatten, Sauberlaufmatten und Läufer in Wunschgröße. Hier findest du reduzierte Matten und Aktionen des Shops.", en:"Matten Welt sells modern doormats, entrance mats and runners in custom sizes. Here are discounted mats and shop offers."},
  fussmattenwelt: {name:"Fußmatten-Welt", home:"https://fussmatten-welt.de/", de:"Fußmatten-Welt bietet Fußmatten, Schmutzfangmatten und Teppichläufer für innen und außen, viele in Wunschgröße. Hier zeigen wir Angebote des Shops.", en:"Fußmatten-Welt offers doormats, dirt-trapping mats and carpet runners for indoors and outdoors, many in custom sizes. Here are the shop’s deals."},
  getgoods: {name:"getgoods", home:"https://www.getgoods.com/", de:"getgoods ist ein Onlineshop für Computer, Technik, Elektronik, Elektroinstallation, Werkzeug und Sicherheitstechnik. Hier sammeln wir getgoods-Angebote, deren Rabatt wir geprüft haben.", en:"getgoods is an online shop for computers, tech, electronics, electrical installation, tools and security tech. Here are getgoods deals with a checked discount."},
  netzwerkartikel: {name:"Netzwerkartikel.de", home:"https://www.netzwerkartikel.de/", de:"Netzwerkartikel.de ist seit über 30 Jahren Spezialist für Kabel, Netzwerktechnik und Elektronik-Zubehör, von Patchkabeln über Switches bis zu HDMI-Adaptern. Hier findest du Angebote des Shops.", en:"Netzwerkartikel.de has specialised in cables, networking and electronics accessories for over 30 years, from patch cables and switches to HDMI adapters. Here are the shop’s deals."},
  datouboss: {name:"DATOUBOSS", home:"https://datouboss.com/", de:"DATOUBOSS ist eine Energie-Marke für LiFePO4-Akkus, Wechselrichter und Speichersysteme, etwa für Balkonkraftwerke, Camping und Notstrom. Hier zeigen wir reduzierte DATOUBOSS-Produkte.", en:"DATOUBOSS is an energy brand for LiFePO4 batteries, inverters and storage systems for balcony solar, camping and backup power. Here are discounted DATOUBOSS products."},
  alldrei: {name:"ALLDREI", home:"https://www.alldrei.de/", de:"ALLDREI aus Reutlingen verkauft Solarprodukte wie Balkonkraftwerke, Solarmodule und Speicher mit eigenem Lager in Deutschland. Hier findest du ALLDREI-Angebote mit geprüftem Rabatt.", en:"ALLDREI from Reutlingen sells solar products such as balcony power plants, solar panels and storage from its own German warehouse. Here are ALLDREI deals with a checked discount."},
  blazevideo: {name:"BlazeVideo", home:"https://www.blazevideos.de/", de:"BlazeVideo stellt Wildkameras und Überwachungskameras für Garten, Jagd und Naturbeobachtung her, auch mit Solar und Mobilfunk. Hier zeigen wir reduzierte BlazeVideo-Modelle.", en:"BlazeVideo makes trail and security cameras for garden, hunting and wildlife watching, including solar and cellular models. Here are discounted BlazeVideo models."},
  hollyland: {name:"Hollyland", home:"https://eu.hollyland.com/", de:"Hollyland entwickelt kabellose Mikrofone und Video-Übertragungssysteme für Creator und Filmteams, etwa die Lark-Mikrofone. Hier findest du Angebote aus dem EU-Shop.", en:"Hollyland develops wireless microphones and video transmission systems for creators and film crews, such as the Lark mics. Here are deals from the EU shop."},
  sirui: {name:"SIRUI", home:"https://siruishop.de/", de:"SIRUI ist eine Marke für Foto- und Videoausrüstung wie anamorphotische Objektive, Stative und LED-Licht. Hier zeigen wir Angebote aus dem deutschen SIRUI-Shop.", en:"SIRUI is a photo and video gear brand for anamorphic lenses, tripods and LED lights. Here are deals from the German SIRUI shop."},
  lampenwelt: {name:"Lampenwelt", home:"https://www.lampenwelt.de/", de:"Lampenwelt ist einer der großen Onlineshops für Lampen und Leuchten: Decken- und Wandleuchten, Außenleuchten, LED-Leuchtmittel und Smart-Home-Licht. Hier findest du Lampenwelt-Angebote und Gutscheine.", en:"Lampenwelt is a large online shop for lamps and lighting: ceiling and wall lights, outdoor lights, LED bulbs and smart lighting. Here are Lampenwelt deals and vouchers."},
  bwareshop: {name:"Bwareshop", home:"https://www.bwareshop.de/", de:"Der Bwareshop verkauft B-Ware, Retouren und Restposten günstiger, vor allem Haushaltsgeräte, Garten- und Heimwerkerartikel. B-Ware ist meist voll funktionsfähig, kann aber Gebrauchsspuren oder eine beschädigte Verpackung haben – Zustand und Gewährleistung im Angebot prüfen.", en:"Bwareshop sells open-box items, returns and remaining stock at lower prices, mainly household, garden and DIY products. Check condition and warranty in each listing."},
  lagenio: {name:"Lagenio", home:"https://watch.lagenio.com/", de:"Lagenio ist ein Onlineshop für Smartwatches und Fitnessuhren. Hier findest du Lagenio-Angebote.", en:"Lagenio is an online shop for smartwatches and fitness watches. Here are Lagenio deals."},
  "tassimo": {name:"Tassimo", home:"https://www.tassimo.com/de", de:"Tassimo ist das Kapselsystem von Bosch und JDE für Kaffee, Tee und Kakao. Hier findest du Angebote für Tassimo-Maschinen direkt vom Hersteller-Shop.", en:"Tassimo is the pod coffee system by Bosch and JDE. Here you find deals on Tassimo machines from the official shop."},
  "moderne-hausfrau": {name:"Die Moderne Hausfrau", home:"https://www.moderne-hausfrau.de", de:"Die Moderne Hausfrau verkauft Haushaltshelfer, Küchenzubehör, Aufbewahrung und Deko, auch von Wenko. Hier findest du reduzierte Haushaltsartikel.", en:"Die Moderne Hausfrau sells household helpers, kitchen tools, storage and decor, including Wenko. Here you find discounted household items."},
  "videobuster": {name:"VIDEOBUSTER", home:"https://www.videobuster.de", de:"VIDEOBUSTER ist Verleih und Shop für DVDs, Blu-rays und Video on Demand. Hier findest du Aktionen und günstige Filme.", en:"VIDEOBUSTER rents and sells DVDs, Blu-rays and video on demand. Here you find offers and cheap films."},
  "jackery": {name:"Jackery", home:"https://de.jackery.com/", de:"Jackery stellt tragbare Powerstationen, Solargeneratoren und Balkonspeicher her. Hier findest du Jackery-Angebote aus dem offiziellen Shop.", en:"Jackery makes portable power stations, solar generators and balcony storage. Here you find Jackery deals from the official shop."},
  "stoneline": {name:"STONELINE", home:"https://www.stoneline.de/", de:"STONELINE verkauft beschichtete Pfannen, Töpfe und Küchenhelfer. Hier findest du reduzierte Pfannen- und Topfsets.", en:"STONELINE sells coated pans, pots and kitchen tools. Here you find discounted pan and pot sets."},
  "wybot": {name:"WYBOT", home:"https://www.eu.wybotpool.com/", de:"WYBOT baut Poolroboter für Boden, Wände und Wasserlinie, auch akkubetrieben. Hier findest du WYBOT-Angebote aus dem offiziellen EU-Shop.", en:"WYBOT makes pool robots for floor, walls and waterline, including cordless models. Here you find WYBOT deals from the official EU shop."},
  euronics: {name:"EURONICS", home:"https://www.euronics.de/", de:"EURONICS ist ein Verbund selbstständiger Elektronik-Fachhändler mit Online-Shop: Fernseher, Haushaltsgeräte, Smartphones, Computer und Unterhaltungselektronik. Hier findest du geprüfte EURONICS-Angebote mit Preisverlauf.", en:"EURONICS is a group of independent electronics retailers with an online store: TVs, appliances, smartphones, computers and consumer electronics. Here are checked EURONICS deals with price history."},
  vevor: {name:"VEVOR", home:"https://www.vevor.de/", de:"VEVOR verkauft Werkzeug, Maschinen und Ausrüstung für Heimwerker, Garten, Gastronomie und Werkstatt im eigenen Online-Shop. Hier findest du geprüfte VEVOR-Angebote mit Preisverlauf.", en:"VEVOR sells tools, machines and equipment for DIY, garden, catering and workshop in its own online store. Here are checked VEVOR deals with price history."},
  geekbuying: {name:"Geekbuying", home:"https://www.geekbuying.com/", de:"Geekbuying ist ein Online-Händler für Technik und Gadgets, etwa E-Scooter, 3D-Drucker, Saugroboter und Smart-Home-Geräte, häufig mit Versand aus EU-Lagern. Hier findest du geprüfte Geekbuying-Angebote mit Preisverlauf.", en:"Geekbuying is an online retailer for tech and gadgets such as e-scooters, 3D printers, robot vacuums and smart home devices, often shipped from EU warehouses. Here are checked Geekbuying deals with price history."},
  levoit: {name:"Levoit", home:"https://levoit.de/", de:"Levoit stellt Luftreiniger, Luftbefeuchter und weitere Geräte für das Raumklima her und verkauft sie im eigenen Online-Shop. Hier findest du geprüfte Levoit-Angebote mit Preisverlauf.", en:"Levoit makes air purifiers, humidifiers and other indoor climate devices and sells them in its own online store. Here are checked Levoit deals with price history."},
  getdigital: {name:"getDigital", home:"https://www.getdigital.de", de:"getDigital ist ein Shop für Nerd- und Geek-Geschenke: Gadgets, Fanartikel und ausgefallene Geschenkideen. Hier findest du geprüfte getDigital-Angebote mit Preisverlauf.", en:"getDigital is a store for nerd and geek gifts: gadgets, fan merchandise and unusual gift ideas. Here are checked getDigital deals with price history."},
  ideeshop: {name:"idee. Creativmarkt", home:"https://www.idee-shop.com/", de:"idee. Creativmarkt führt Bastelmaterial und Zubehör für kreative Hobbys, von Farben und Papier bis zu saisonaler Deko. Hier findest du geprüfte idee-Angebote mit Preisverlauf.", en:"idee. Creativmarkt stocks craft materials and supplies for creative hobbies, from paints and paper to seasonal decoration. Here are checked idee deals with price history."},
  lizensio: {name:"Lizensio", home:"https://www.lizensio.de/", de:"Lizensio ist ein Online-Händler für Software-Lizenzen, vor allem Windows, Office und Sicherheitssoftware. Hier findest du geprüfte Lizensio-Angebote.", en:"Lizensio is an online retailer for software licences, mainly Windows, Office and security software. Here are checked Lizensio deals."},
  softwarehunter: {name:"Softwarehunter", home:"https://www.softwarehunter.de/", de:"Softwarehunter ist ein Online-Händler für Software-Lizenzen mit Schwerpunkt Microsoft, für Privat- und Geschäftskunden. Hier findest du geprüfte Softwarehunter-Angebote.", en:"Softwarehunter is an online retailer for software licences with a focus on Microsoft, for private and business customers. Here are checked Softwarehunter deals."},
  pflanzenkoelle: {name:"Pflanzen-Kölle", home:"https://www.pflanzen-koelle.de/", de:"Pflanzen-Kölle betreibt Gartencenter und einen Online-Shop für Pflanzen, Gartenbedarf, Deko und Tierbedarf. Hier findest du geprüfte Pflanzen-Kölle-Angebote mit Preisverlauf.", en:"Pflanzen-Kölle runs garden centres and an online store for plants, garden supplies, decoration and pet supplies. Here are checked Pflanzen-Kölle deals with price history."},
  woodstore24: {name:"Woodstore24", home:"https://woodstore24.de/", de:"Woodstore24 verkauft Holz und holzähnliche Produkte für den Garten, von Terrassendielen bis zu Sichtschutzzäunen. Hier findest du geprüfte Woodstore24-Angebote mit Preisverlauf.", en:"Woodstore24 sells wood and wood-like products for the garden, from decking to privacy fences. Here are checked Woodstore24 deals with price history."},
  mepal: {name:"Mepal", home:"https://www.mepal.com/de", de:"Mepal stellt Brotdosen, Trinkflaschen, Vorratsdosen und Geschirr aus Kunststoff her und verkauft sie im eigenen Online-Shop. Hier findest du geprüfte Mepal-Angebote mit Preisverlauf.", en:"Mepal makes lunch boxes, water bottles, storage boxes and tableware and sells them in its own online store. Here are checked Mepal deals with price history."},
  kochblume: {name:"Kochblume", home:"https://www.kochblume.de/", de:"Kochblume bietet bunte Küchenhelfer zum Kochen und Backen im eigenen Online-Shop. Hier findest du geprüfte Kochblume-Angebote mit Preisverlauf.", en:"Kochblume offers colourful kitchen helpers for cooking and baking in its own online store. Here are checked Kochblume deals with price history."},
  muji: {name:"MUJI", home:"https://germany.muji.eu/", de:"MUJI ist die japanische Marke für schlichte Alltagsprodukte: Haushalt, Schreibwaren, Aufbewahrung und Möbel. Hier findest du geprüfte MUJI-Angebote mit Preisverlauf.", en:"MUJI is the Japanese brand for simple everyday products: household goods, stationery, storage and furniture. Here are checked MUJI deals with price history."},
  asgoodasnew: {name:"asgoodasnew", home:"https://asgoodasnew.de/", de:"asgoodasnew verkauft generalüberholte Elektronik wie Smartphones, Tablets, Kameras und Konsolen. Auf perldeals listen wir als Deals nur Neuware; der Shop ist hier als Partner für Refurbished-Geräte verlinkt.", en:"asgoodasnew sells refurbished electronics such as smartphones, tablets, cameras and consoles. On perldeals we only list new goods as deals; the store is linked here as a partner for refurbished devices."},
  check24: {name:"CHECK24", home:"https://www.check24.net", de:"CHECK24 ist ein Vergleichsportal; über das Partnerprogramm verlinken wir den Vergleich für Strom-, Gas- und DSL-Tarife.", en:"CHECK24 is a comparison portal; through the partner programme we link its comparison for electricity, gas and broadband tariffs."},
  medion: {name:"MEDION", home:"https://www.medion.com/de/shop", de:"MEDION ist der deutsche Elektronik-Hersteller aus Essen: Notebooks, PCs, Fernseher, Smart-Home- und Haushaltsgeräte im eigenen Online-Shop. Hier findest du geprüfte MEDION-Angebote mit Preisverlauf.", en:"MEDION is the German electronics maker from Essen: laptops, PCs, TVs, smart home and household appliances in its own online store. Here are checked MEDION deals with price history."},
  obsbot: {name:"OBSBOT", home:"https://www.obsbot.com/de", de:"OBSBOT baut KI-gesteuerte Webcams, PTZ- und Streaming-Kameras (z. B. Tiny, Meet, Tail) mit automatischer Personenverfolgung. Hier findest du geprüfte OBSBOT-Angebote aus dem offiziellen Shop.", en:"OBSBOT makes AI-powered webcams, PTZ and streaming cameras (e.g. Tiny, Meet, Tail) with automatic subject tracking. Here are checked OBSBOT deals from the official store."},
  technaxx: {name:"Technaxx", home:"https://shop-technaxx.de/", de:"Technaxx ist ein deutscher Elektronikhersteller mit eigenem Onlineshop: Wildkameras, Überwachungskameras, Powerbanks, Solartechnik und Senioren-Technik. Hier findest du Technaxx-Angebote.", en:"Technaxx is a German electronics brand with its own shop: trail cameras, security cameras, power banks, solar gear and senior-friendly tech. Here are Technaxx deals."},
  skled: {name:"SK-LED", home:"https://sk-led.com/", de:"SK-LED ist ein Onlineshop für LED-Technik und Lichtlösungen, vor allem für Gewerbe, Planer und Installateure, aber auch für Privatkunden. Hier findest du Angebote des Shops.", en:"SK-LED is an online shop for LED technology and lighting, mainly for businesses and installers but also for consumers. Here are the shop’s deals."},
  wondershare: {name:"Wondershare", home:"https://www.wondershare.de/", de:"Wondershare entwickelt Software wie den Videoeditor Filmora, PDFelement, Recoverit zur Datenrettung und EdrawMax. Hier findest du Software-Aktionen und Rabatte.", en:"Wondershare makes software such as the Filmora video editor, PDFelement, Recoverit data recovery and EdrawMax. Here are software sales and discounts."},
  lidlreisen: {name:"Lidl Reisen", home:"https://www.lidl-reisen.de/", de:"Lidl Reisen vermittelt Pauschalreisen, Rundreisen, Kreuzfahrten und Kurztrips, dazu „Experiences“ mit Hotel und Eintritt, etwa für Thermen, Freizeitparks und Musicals. Hier zeigen wir Reise-Angebote mit konkretem Preis.", en:"Lidl Reisen offers package holidays, tours, cruises and short breaks plus “Experiences” with hotel and admission for spas, theme parks and musicals. Here are travel deals with a concrete price."},
  meinschiff: {name:"Mein Schiff", home:"https://www.meinschiff.com/", de:"Mein Schiff ist die Flotte von TUI Cruises mit Premium-Alles-Inklusive-Kreuzfahrten, etwa ins Mittelmeer, nach Nordeuropa und in die Karibik. Hier findest du aktuelle Mein-Schiff-Aktionen.", en:"Mein Schiff is the TUI Cruises fleet offering premium all-inclusive cruises to the Mediterranean, Northern Europe and the Caribbean. Here are current Mein Schiff offers."},
  ehoi: {name:"e-hoi", home:"https://www.e-hoi.de/", de:"e-hoi ist ein Kreuzfahrt-Portal mit über 23.000 Kreuzfahrten vieler Reedereien, von AIDA über MSC bis zu Flusskreuzfahrten. Hier zeigen wir e-hoi-Angebote und Aktionen.", en:"e-hoi is a cruise portal with over 23,000 cruises from many lines, from AIDA and MSC to river cruises. Here are e-hoi deals and offers."},
  turbopass: {name:"Turbopass", home:"https://www.turbopass.com/de", de:"Turbopass verkauft City-Pässe mit freiem Eintritt in Museen und Attraktionen und Nahverkehr, etwa für München, Hamburg, London, Paris, Rom und Barcelona. Hier findest du Turbopass-Aktionen.", en:"Turbopass sells city passes with free entry to museums and attractions plus public transport for Munich, Hamburg, London, Paris, Rome, Barcelona and more. Here are Turbopass offers."},
  pergolux: {name:"Pergolux", home:"https://pergolux.de/", de:"Pergolux ist eine Marke aus Norwegen für Aluminium-Pergolen mit verstellbarem Lamellendach, die man ohne Handwerker selbst aufbauen kann. Die Pergola-Serie wurde mit dem Red Dot Award ausgezeichnet. Hier findest du Pergolux-Aktionen und geprüfte Angebote.", en:"Pergolux is a Norwegian brand of aluminium pergolas with adjustable louvred roofs designed for DIY assembly; the series won a Red Dot award. Here are Pergolux offers and checked deals."},
  lunzo: {name:"Lunzo", home:"https://www.lunzo.de/", de:"Lunzo ist ein Onlineshop für Haus und Garten mit Möbeln, Gartenausstattung und Wohnaccessoires. Hier findest du Lunzo-Angebote, deren Rabatt wir geprüft haben.", en:"Lunzo is an online shop for home and garden with furniture, garden equipment and home accessories. Here are Lunzo deals with a checked discount."},
  luxecosy: {name:"LuxeCosy", home:"https://luxecosy.com/", de:"LuxeCosy ist auf Bettwaren Made in Germany spezialisiert, etwa Kopfkissen, Bettdecken und Bettwäsche. Wir zeigen dort nur Produkte ohne tierische Füllung (keine Daunen oder Federn) mit geprüftem Rabatt.", en:"LuxeCosy specialises in bedding made in Germany such as pillows, duvets and bed linen. We only show products without animal filling (no down or feathers) with a checked discount."},
  miniminipower: {name:"miniminipower", home:"https://miniminipower.com", de:"miniminipower verkauft Energielösungen für kleine Haushalte: Solarmodule, Balkonkraftwerke, Batteriespeicher, Wechselrichter und Ladestationen für Elektroautos. Hier findest du Angebote mit geprüftem Rabatt.", en:"miniminipower sells energy solutions for small households: solar panels, balcony power plants, battery storage, inverters and EV chargers. Here are deals with a checked discount."},
  solo: {name:"SOLO", home:"https://shop.solo.global/", de:"SOLO Kleinmotoren ist ein Familienunternehmen aus Sindelfingen, das seit über 70 Jahren Spritzen und Sprühgeräte für Pflanzenschutz, Reinigung und Desinfektion sowie Trennschleifer für den Bau herstellt. Hier findest du Angebote aus dem offiziellen SOLO-Shop.", en:"SOLO Kleinmotoren is a family company from Sindelfingen, Germany, making sprayers for plant protection, cleaning and disinfection plus power cutters for construction for over 70 years. Here are deals from the official SOLO shop."},
  currysmarter: {name:"CURRYSMARTER", home:"https://currysmarter.com/", de:"CURRYSMARTER ist eine Marke für Smart-Home-Produkte, die das Leben zu Hause einfacher machen sollen. Hier findest du Angebote aus dem offiziellen Shop.", en:"CURRYSMARTER is a smart home brand. Here are deals from the official shop."},
  ecovacs: {name:"Ecovacs", home:"https://www.ecovacs.com/de/shop", de:"Ecovacs ist einer der größten Hersteller von Saugrobotern und Saug-Wisch-Robotern (DEEBOT), dazu Fensterputzroboter (WINBOT) und Mähroboter (GOAT). Hier findest du Angebote aus dem offiziellen Ecovacs-Shop, geprüft gegen den Preisverlauf.", en:"Ecovacs is one of the largest makers of robot vacuums and mops (DEEBOT), window cleaning robots (WINBOT) and robot mowers (GOAT). Here are deals from the official Ecovacs shop, checked against price history."},
  allpowers: {name:"ALLPOWERS", home:"https://www.iallpowers.de/", de:"ALLPOWERS bietet tragbare Powerstationen, Balkonspeicher und Solarmodule für Camping, Notstrom und Balkonkraftwerke. Hier findest du ALLPOWERS-Angebote mit geprüftem Rabatt.", en:"ALLPOWERS offers portable power stations, balcony storage and solar panels for camping, backup power and balcony solar. Here are ALLPOWERS deals with a checked discount."},
  tesmart: {name:"TESmart", home:"https://tesmart.de/", de:"TESmart ist auf KVM-Switches und Docking-Lösungen spezialisiert, mit denen du mehrere Computer an einem Monitor-Setup nutzt, bis 8K60 und 4K144. Hier findest du Angebote aus dem deutschen Shop.", en:"TESmart specialises in KVM switches and docking solutions to use several computers with one monitor setup, up to 8K60 and 4K144. Here are deals from the German shop."},
  sovol: {name:"Sovol", home:"https://sovoleu.myshopify.com/", de:"Sovol ist eine Marke für günstige Open-Source-3D-Drucker. Hier findest du Angebote aus dem europäischen Sovol-Shop.", en:"Sovol is a brand of affordable open-source 3D printers. Here are deals from the European Sovol shop."},
  magix: {name:"MAGIX", home:"https://www.magix.com/de/", de:"MAGIX ist ein europäischer Softwarehersteller für Video, Musik und Foto, bekannt für Programme wie Video deluxe, Music Maker und VEGAS. Hier findest du Software-Aktionen von MAGIX.", en:"MAGIX is a European software maker for video, music and photo, known for Video deluxe, Music Maker and VEGAS. Here are MAGIX software offers."},
  cambuy: {name:"cambuy", home:"https://cambuy.de/", de:"cambuy ist ein Onlineshop für professionelle Sicherheitstechnik und Videoüberwachung, vor allem mit Systemen von Hikvision. Hier findest du Angebote für Kameras, Rekorder und Zubehör.", en:"cambuy is an online shop for professional security and video surveillance, mainly Hikvision systems. Here are deals on cameras, recorders and accessories."},
  mactrade: {name:"MacTrade", home:"https://www.mactrade.de/", de:"MacTrade ist ein Apple-Händler mit Onlineshop und Stores in Deutschland für Mac, iPhone, iPad, Apple Watch und Zubehör. Hier findest du MacTrade-Angebote mit geprüftem Rabatt.", en:"MacTrade is an Apple reseller with an online shop and stores in Germany for Mac, iPhone, iPad, Apple Watch and accessories. Here are MacTrade deals with a checked discount."},
  kaspersky: {name:"Kaspersky", home:"https://www.kaspersky.com/de/", de:"Kaspersky ist ein Anbieter von Sicherheitssoftware wie Virenschutz, Passwort-Manager und VPN. Hier findest du aktuelle Kaspersky-Aktionen.", en:"Kaspersky makes security software such as antivirus, password manager and VPN. Here are current Kaspersky offers."},
  comspot: {name:"comspot", home:"https://comspot.de/", de:"comspot berät seit über 20 Jahren Geschäfts- und Privatkunden rund um IT und verkauft Hard- und Software. Hier findest du comspot-Angebote mit geprüftem Rabatt.", en:"comspot has advised business and private customers on IT for over 20 years and sells hardware and software. Here are comspot deals with a checked discount."},
  shifter: {name:"SHIFTER", home:"https://www.shifter.shop", de:"SHIFTER bietet zeitlich begrenzte Technik-Deals in limitierter Stückzahl, dazu ein festes Sortiment. Hier findest du SHIFTER-Angebote, die wir gegen den Marktpreis geprüft haben.", en:"SHIFTER offers time-limited tech deals in limited quantities plus a regular range. Here are SHIFTER deals checked against market prices."},
  lusini: {name:"LUSINI", home:"https://www.lusini.com/de-de/", de:"LUSINI liefert Ausstattung in Profi-Qualität für Gastgeber und Gastronomie, von Geschirr und Gläsern bis Küchengeräten und Möbeln. Hier findest du LUSINI-Angebote.", en:"LUSINI supplies professional-grade equipment for hosts and hospitality, from tableware and glasses to kitchen appliances and furniture. Here are LUSINI deals."},
  otterbox: {name:"OtterBox", home:"https://www.otterbox.eu/de", de:"OtterBox stellt seit 1998 Schutzhüllen für Smartphones und Tablets her, dazu Displayschutz und Ladezubehör. Hier findest du OtterBox-Angebote.", en:"OtterBox has made protective cases for smartphones and tablets since 1998, plus screen protectors and charging accessories. Here are OtterBox deals."},
  egret: {name:"Egret", home:"https://my-egret.com/de", de:"Egret aus Hamburg entwickelt seit 2011 Premium-E-Scooter mit Straßenzulassung. Hier findest du Egret-Angebote mit geprüftem Rabatt.", en:"Egret from Hamburg has developed premium road-legal e-scooters since 2011. Here are Egret deals with a checked discount."},
  handyhuellen: {name:"Handyhuellen.de", home:"https://www.handyhuellen.de/", de:"Handyhuellen.de verkauft Handyhüllen, Tablethüllen und Zubehör für viele Geräte und Marken. Hier findest du Aktionen des Shops.", en:"Handyhuellen.de sells phone and tablet cases and accessories for many devices and brands. Here are the shop’s offers."},
  tip: {name:"T.I.P. Pumpen", home:"https://www.tip-pumpen.de/", de:"T.I.P. aus Waibstadt liefert seit 1978 Wasserpumpen, Gartenpumpen, Hauswasserwerke und Teichfilter. Hier findest du T.I.P.-Angebote aus dem offiziellen Shop.", en:"T.I.P. from Waibstadt, Germany, has supplied water pumps, garden pumps, domestic waterworks and pond filters since 1978. Here are T.I.P. deals from the official shop."},
  weroll: {name:"WeRoll", home:"https://weroll.de/", de:"WeRoll ist ein Onlineshop für E-Scooter mit kostenlosem Versand, Reparaturservice und Online-Support. Hier findest du WeRoll-Angebote.", en:"WeRoll is an e-scooter shop with free shipping, repair service and online support. Here are WeRoll deals."},
  yalehome: {name:"Yale", home:"https://yalehome.de/", de:"Yale steht für smarte und mechanische Sicherheitslösungen für Zuhause, etwa smarte Türschlösser, Tresore und Video-Türklingeln. Hier findest du Yale-Angebote.", en:"Yale offers smart and mechanical home security such as smart locks, safes and video doorbells. Here are Yale deals."},
  mrkeyshop: {name:"Mr Key Shop", home:"https://mrkeyshop.com/de/", de:"Mr Key Shop verkauft digitale Software-Lizenzen, etwa für Windows, Office und Antivirus, mit Lieferung per E-Mail. Hier findest du Aktionen des Shops.", en:"Mr Key Shop sells digital software licences, e.g. for Windows, Office and antivirus, delivered by email. Here are the shop’s offers."},
  nexalia: {name:"Nexalia", home:"https://nexalia.de/", de:"Nexalia ist ein Onlineshop mit über 25.000 Produkten rund um Parfum, Kosmetik, Friseurbedarf und Spielwaren. Hier findest du Nexalia-Angebote; Kosmetik nehmen wir nur auf, wenn sie ausdrücklich vegan ist.", en:"Nexalia is an online shop with over 25,000 products in perfume, cosmetics, hairdressing supplies and toys. Here are Nexalia deals; cosmetics only if explicitly vegan."},
  "2gosoftware": {name:"2GO Software", home:"https://2gosoftware.eu/", de:"2GO Software ist ein Händler für Softwarelizenzen wie Microsoft Office, Windows und Sicherheitssoftware. Hier findest du Aktionen des Shops.", en:"2GO Software sells software licences such as Microsoft Office, Windows and security software. Here are the shop’s offers."},
  itversand: {name:"it-versand.com", home:"https://it-versand.com/", de:"it-versand.com verkauft professionell aufbereitete Marken-IT wie Laptops, PCs und Monitore sowie Neuware aus Lagerretouren. Hier findest du Angebote mit geprüftem Rabatt.", en:"it-versand.com sells professionally refurbished brand-name IT such as laptops, PCs and monitors, plus new returned stock. Here are deals with a checked discount."},
  joybuy: {name:"Joybuy", home:"https://www.joybuy.de/", de:"Joybuy ist der europäische Onlineshop von JD.com mit Markenprodukten aus eigenen Lagern und eigener Lieferung. Hier findest du Joybuy-Angebote, die wir gegen den Marktpreis geprüft haben.", en:"Joybuy is JD.com’s European online shop with brand-name products from its own warehouses and delivery network. Here are Joybuy deals checked against market prices."},
  gsmnet: {name:"GSMnet", home:"https://gsmnet.de/", de:"GSMnet ist ein Onlineshop mit über 30.000 Produkten rund um Smartphones, Zubehör und Elektronik. Hier findest du GSMnet-Angebote.", en:"GSMnet is an online shop with over 30,000 products around smartphones, accessories and electronics. Here are GSMnet deals."},
  akkunet: {name:"Akku.net", home:"https://www.akku.net/", de:"Akku.net ist seit über 30 Jahren Spezialist für Ersatz-Akkus, etwa für Werkzeug, Notebooks, Kameras und Smartphones, dazu Ladegeräte. Hier findest du Akku.net-Angebote.", en:"Akku.net has specialised in replacement batteries for over 30 years, e.g. for tools, laptops, cameras and smartphones, plus chargers. Here are Akku.net deals."},
  outdoorqueen: {name:"Outdoor Queen", home:"https://www.outdoor-queen.com/", de:"Outdoor Queen ist auf Sonnensegel spezialisiert: wasserabweisende und atmungsaktive Segel in vielen Formen und Größen, dazu Montagezubehör für Garten, Terrasse und Balkon. Hier findest du Outdoor-Queen-Angebote.", en:"Outdoor Queen specialises in shade sails in many shapes and sizes plus mounting kits for garden, patio and balcony. Here are Outdoor Queen deals."},
  deluxehomeart: {name:"Deluxe Homeart", home:"https://deluxehomeartshop.de/", de:"DeluxeHomeart ist Spezialist für LED-Kerzen: flammenlose Echtwachs-Kerzen mit Timer und Fernbedienung, Lichterketten und Deko für drinnen und draußen. Hier findest du DeluxeHomeart-Angebote.", en:"DeluxeHomeart specialises in LED candles: flameless real-wax candles with timer and remote, fairy lights and decor. Here are DeluxeHomeart deals."},
  elv: {name:"ELV", home:"https://de.elv.com/", de:"ELV ist ein Elektronik-Versandhändler mit Bausätzen, Messtechnik, Smart-Home-Komponenten (Homematic) und Elektronik-Zubehör. Hier findest du ELV-Angebote.", en:"ELV sells electronics kits, measuring equipment, smart home components (Homematic) and accessories. Here are ELV deals."},
  aosom: {name:"Aosom", home:"https://www.aosom.de/", de:"Aosom verkauft Möbel, Garten- und Freizeitartikel, Haustierbedarf und Fitnessgeräte zu günstigen Preisen. Hier findest du Aosom-Angebote.", en:"Aosom sells furniture, garden and leisure products, pet supplies and fitness equipment. Here are Aosom deals."},
  gdata: {name:"G DATA", home:"https://www.gdata.de/", de:"G DATA ist ein deutscher Hersteller von Antiviren- und Internet-Security-Software. Hier findest du G DATA-Angebote.", en:"G DATA is a German maker of antivirus and internet security software. Here are G DATA deals."},
  hmsat: {name:"hm-sat.de", home:"https://www.hm-sat-shop.de/", de:"hm-sat.de ist ein Fachshop für Heimkino- und Satellitentechnik, etwa Receiver, Antennen und Zubehör. Hier findest du hm-sat.de-Angebote.", en:"hm-sat.de specialises in home cinema and satellite equipment. Here are hm-sat.de deals."},
  intergard: {name:"InterGard", home:"https://www.intergardshop.de/", de:"InterGard bietet Produkte für Heim und Garten, zum Beispiel Gartenmöbel, Pavillons und Wohnaccessoires. Hier findest du InterGard-Angebote.", en:"InterGard offers home and garden products such as garden furniture and gazebos. Here are InterGard deals."},
  rasendoktor: {name:"Rasendoktor", home:"https://www.rasendoktor.de/", de:"Rasendoktor ist Spezialist für Rasenpflege: Rasensamen, Dünger und Zubehör für einen gesunden Rasen. Hier findest du Rasendoktor-Angebote.", en:"Rasendoktor specialises in lawn care: seed, fertiliser and accessories. Here are Rasendoktor deals."},
  systemtreff: {name:"Systemtreff", home:"https://www.systemtreff.de/", de:"Systemtreff verkauft professionell aufbereitete gebrauchte Business-Notebooks, PCs und Monitore. Hier findest du Systemtreff-Angebote.", en:"Systemtreff sells professionally refurbished business laptops, PCs and monitors. Here are Systemtreff deals."},
  creality: {name:"Creality", home:"https://store.creality.com/", de:"Creality ist einer der bekanntesten Hersteller von 3D-Druckern, 3D-Scannern und Lasergravierern. Hier findest du Creality-Angebote.", en:"Creality is a well-known maker of 3D printers, 3D scanners and laser engravers. Here are Creality deals."},
  ankersolix: {name:"Anker SOLIX", home:"https://www.ankersolix.com/", de:"Anker SOLIX bietet Powerstationen, Balkonkraftwerk-Speicher und Solarlösungen von Anker. Hier findest du Anker SOLIX-Angebote.", en:"Anker SOLIX offers power stations, balcony solar storage and solar solutions. Here are Anker SOLIX deals."},
  arlo: {name:"Arlo", home:"https://www.arlo.com/", de:"Arlo stellt kabellose Überwachungskameras, Video-Türklingeln und Smart-Home-Sicherheitslösungen her. Hier findest du Arlo-Angebote.", en:"Arlo makes wireless security cameras, video doorbells and smart home security. Here are Arlo deals."},
  hwt: {name:"Heimwerkertools", home:"https://www.hwt-pro.com/", de:"Heimwerkertools (HWT) bietet Werkzeug, Gartengeräte und Zubehör für Heimwerker. Hier findest du Heimwerkertools-Angebote.", en:"Heimwerkertools offers tools, garden equipment and accessories for DIYers. Here are Heimwerkertools deals."},
  xppen: {name:"XPPen", home:"https://www.storexppen.de/", de:"XPPen stellt Grafiktabletts und Stift-Displays für Zeichner, Designer und Homeoffice her. Hier findest du XPPen-Angebote.", en:"XPPen makes graphics tablets and pen displays. Here are XPPen deals."},
  tuerklingel: {name:"Edelstahl-Türklingel", home:"https://edelstahl-tuerklingel.de/", de:"Edelstahl-Türklingel.de fertigt Klingelanlagen, Briefkästen und Hausnummern aus Edelstahl. Hier findest du Edelstahl-Türklingel-Angebote.", en:"Edelstahl-Türklingel makes stainless steel doorbells, letterboxes and house numbers. Here are Edelstahl-Türklingel deals."},
  airq: {name:"air-Q", home:"https://www.air-q.com/", de:"air-Q ist ein Luftanalysegerät aus Deutschland, das bis zu 14 Werte wie CO2, Feinstaub und VOC misst. Hier findest du air-Q-Angebote.", en:"air-Q is a German air quality analyser measuring CO2, particulate matter, VOC and more. Here are air-Q deals."},
  magnagrill: {name:"Magna Grill", home:"https://www.magna-grill.de/", de:"Magna Grill bietet Grills, Grillzubehör und Outdoor-Küchen. Hier findest du Magna Grill-Angebote.", en:"Magna Grill offers grills, accessories and outdoor kitchens. Here are Magna Grill deals."},
  softwaredealz: {name:"Software-Dealz", home:"https://software-dealz.de/", de:"Software-Dealz verkauft Softwarelizenzen wie Windows und Office als Download. Hier findest du Software-Dealz-Angebote.", en:"Software-Dealz sells software licences such as Windows and Office as downloads. Here are Software-Dealz deals."},
  "3dmakerpro": {name:"3DMakerpro", home:"https://eu.store.3dmakerpro.com/", de:"3DMakerpro stellt 3D-Scanner für Hobby und Profis her. Hier findest du 3DMakerpro-Angebote.", en:"3DMakerpro makes 3D scanners for hobbyists and professionals. Here are 3DMakerpro deals."},
  retrobad: {name:"Retrobad", home:"https://www.retrobad-shop.de/", de:"Retrobad bietet Badmöbel, Armaturen und Badzubehör im Retro- und Landhausstil. Hier findest du Retrobad-Angebote.", en:"Retrobad offers retro and country-style bathroom furniture and fittings. Here are Retrobad deals."},
  cleva: {name:"CLEVA", home:"https://eu.cleva.com/", de:"CLEVA stellt Akku-Werkstattsauger und Reinigungsgeräte für Haus und Garten her. Hier findest du CLEVA-Angebote.", en:"CLEVA makes cordless wet-dry vacuums and cleaning tools. Here are CLEVA deals."},
  dusbad: {name:"Dusbad", home:"https://www.dusbad.de/", de:"Dusbad ist ein Onlineshop für Badezimmer: Duschen, Badmöbel, Armaturen und Zubehör. Hier findest du Dusbad-Angebote.", en:"Dusbad is an online bathroom shop: showers, furniture and fittings. Here are Dusbad deals."},
  esr: {name:"ESR", home:"https://eu.esrtech.com/", de:"ESR stellt Handyhüllen, Displayschutz, MagSafe-Ladegeräte und Tablet-Zubehör her. Hier findest du ESR-Angebote.", en:"ESR makes phone cases, screen protectors, MagSafe chargers and tablet accessories. Here are ESR deals."},
  xiaomi: {name:"Xiaomi", home:"https://www.mi.com/de/", de:"Xiaomi ist einer der größten Elektronik-Hersteller: Smartphones, Saugroboter, Smart-Home-Geräte, E-Scooter und Zubehör im offiziellen Shop. Hier findest du Xiaomi-Angebote.", en:"Xiaomi's official store: smartphones, robot vacuums, smart home devices, e-scooters and accessories. Here are Xiaomi deals."},
  ledvance: {name:"LEDVANCE (OSRAM)", home:"https://shop.ledvance.com/", de:"Der offizielle LEDVANCE-Shop verkauft OSRAM- und LEDVANCE-Leuchtmittel, Smart-Home-Lampen und Leuchten. Hier findest du LEDVANCE (OSRAM)-Angebote.", en:"The official LEDVANCE shop sells OSRAM and LEDVANCE bulbs, smart lights and luminaires. Here are LEDVANCE (OSRAM) deals."}
};
const shopKey = d => d.shop || "amazon";
const AWIN_PROMOS = fs.existsSync(`${SRC}/data/awin-promotions.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/awin-promotions.json`, "utf8")).promotions || [] : [];
const promoActive = p => !p.end || new Date(p.end) > new Date();
function shopPromos(lang, k){
  const mid = AWIN_MID[k]; if (!mid) return "";
  const list = AWIN_PROMOS.filter(p => p.mid === mid && promoActive(p)).slice(0, 8);
  if (!list.length) return "";
  const de = lang === "de", dd = s => s ? new Date(s).toLocaleDateString(de ? "de-DE" : "en-GB", {day:"2-digit", month:"2-digit", year:"numeric"}) : "";
  return `<div class="wrap"><section class="section"><h2>${de ? `Aktuelle ${esc(SHOPS[k].name)}-Aktionen und Gutscheine` : `Current ${esc(SHOPS[k].name)} promotions and vouchers`}</h2><ul class="rs-promos">${list.map(p => `<li><strong>${esc(p.title)}</strong>${p.description && p.description !== p.title ? `<p>${esc(p.description.slice(0, 220))}</p>` : ""}${p.code ? `<p>${de?"Code":"Code"}: <code>${esc(p.code)}</code></p>` : ""}<p><small>${p.end ? (de ? `gültig bis ${dd(p.end)}` : `valid until ${dd(p.end)}`) : ""}${p.terms ? ` · ${esc(p.terms.slice(0, 140))}` : ""}</small></p><a class="btn btn-ghost" href="${awinLink(mid, p.url || SHOPS[k].home)}" ${AFF}>${de ? "Zur Aktion" : "Go to offer"}</a></li>`).join("")}</ul><p><small>${de ? "Aktionen laut Partnerprogramm (Awin), automatisch aktualisiert. Bedingungen im Shop prüfen. Anzeige." : "Promotions per affiliate network (Awin), updated automatically. Check terms in the shop. Ad."}</small></p></section></div>`;
}
function buildShop(lang, k){
  const S = SHOPS[k], u = UI[lang], de = lang==="de";
  const list = sorted.filter(d => shopKey(d) === k);
  const h = de ? `${S.name} Angebote` : `${S.name} deals`;
  const desc = de ? `Aktuelle ${S.name}-Angebote mit Preisverlauf: ${list.length} geprüfte Deals, mehrmals täglich aktualisiert. Ohne Fake-Rabatte.` : `Current ${S.name} deals with price history: ${list.length} checked deals, updated several times a day. No fake discounts.`;
  const cr = crumbs(lang, [[u.home, R.home[lang]], [h]]);
  const others = Object.keys(SHOPS).filter(x => x !== k).map(x => `<a class="chip" href="${R.shop[lang](x)}">${esc(SHOPS[x].name)}</a>`).join("");
  const faq = de ? [[`Wie aktuell sind die ${S.name}-Angebote?`, `Wir suchen mehrmals täglich nach neuen Deals und entfernen abgelaufene Angebote. Der Preis bei jedem Deal gilt zum angegebenen Zeitpunkt, im Shop kann er sich inzwischen geändert haben.`],[`Sind die Rabatte echt?`, `Wir vergleichen den Preis mit dem Vorpreis des Shops und, sobald vorhanden, mit unserem eigenen Preisverlauf. Deals mit auffällig aufgeblähtem Vergleichspreis nehmen wir nicht auf.`],[`Kostet mich der Kauf über perldeals mehr?`, `Nein. Wir erhalten bei Käufen über unsere Links ggf. eine Provision, der Preis bleibt für dich gleich.`]]
    : [[`How current are the ${S.name} deals?`, `We look for new deals several times a day and remove expired ones. Each price applies at the time shown and may have changed in the shop since.`],[`Are the discounts real?`, `We compare the price with the shop's previous price and, once available, with our own price history. We skip deals with an obviously inflated comparison price.`],[`Does buying through perldeals cost more?`, `No. We may earn a commission on purchases through our links, the price stays the same for you.`]];
  const body = `<div class="wrap">${cr.html}<div class="eyebrow">${de?"Shop":"Shop"}</div><h1>${esc(h)}</h1><p class="lead">${esc(S[lang])}</p>${S.home && AWIN_MID[k] ? `<p><a class="btn btn-primary" href="${awinLink(AWIN_MID[k], S.home).replace("perldeals-rabatte","perldeals-shop")}" ${AFF}>${de?`Zum ${esc(S.name)}-Shop`:`Visit ${esc(S.name)}`} <span class="ad-tag">${u.ad}</span></a></p>` : ""}${couponShops().some(x => x.k === k) ? `<p class="prose"><a class="more" href="${R.coupon[lang](k)}">${de?`${S.name} Gutscheine und Rabattcodes`:`${S.name} vouchers and discount codes`}</a></p>` : ""}</div>
    ${list.length ? grid(list, lang, "h2", de ? `${list.length} aktuelle Deals` : `${list.length} current deals`) : `<div class="wrap"><p>${de?"Gerade gibt es hier keine geprüften Deals. Schau bald wieder vorbei oder stöbere in allen Deals.":"No checked deals here right now. Check back soon or browse all deals."} <a href="${R.home[lang]}">${de?"Alle Deals":"All deals"}</a></p></div>`}
    ${shopPromos(lang, k)}
    <div class="wrap"><h2>${de?"Häufige Fragen":"FAQ"}</h2>${faq.map(f=>`<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}
    <h2>${de?"Weitere Shops":"More shops"}</h2><div class="chips">${others}</div>${followBox(lang)}</div>`;
  const ld = [{"@context":"https://schema.org","@type":"CollectionPage","name":h,"description":desc,"url":BASE+R.shop[lang](k)},
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":faq.map(f=>({"@type":"Question","name":f[0],"acceptedAnswer":{"@type":"Answer","text":f[1]}}))},
    {"@context":"https://schema.org", ...cr.ld}];
  layout({lang, pathFor:l=>R.shop[l](k), title:`${h} ${de?"heute":"today"} · perldeals`, description:desc, body, ld});
}

function travelPartners(lang){
  const de = lang==="de", ks = ["lidlreisen","meinschiff","ehoi","turbopass"].filter(x => SHOPS[x]);
  return `<div class="wrap"><section class="section"><h2>${de?"Unsere Reise-Partner":"Our travel partners"}</h2><ul class="link-list">${ks.map(x => `<li><strong><a href="${R.shop[lang](x)}">${esc(SHOPS[x].name)}</a></strong><br><span>${esc(SHOPS[x][lang])}</span><br><a class="btn btn-ghost" href="${awinLink(AWIN_MID[x], SHOPS[x].home).replace("perldeals-rabatte","perldeals-reisen")}" ${AFF}>${de?`Angebote bei ${esc(SHOPS[x].name)} ansehen`:`See offers at ${esc(SHOPS[x].name)}`} <span class="ad-tag">${UI[lang].ad}</span></a></li>`).join("")}</ul></section></div>`;
}
function buildCategory(lang, k){
  const u = UI[lang], name = CATS[k][lang][0];
  const list = sorted.filter(d => catHas(d, k));
  const h = lang==="de" ? `${name}-Deals` : `${name} deals`;
  const desc = lang==="de" ? `Aktuelle ${name}-Angebote bei Amazon, OTTO und Co., gegen den Preisverlauf geprüft. ${list.length} Deals, täglich aktualisiert.` : `Current ${name.toLowerCase()} deals from Amazon.de, OTTO and more, checked against price history. ${list.length} deals, updated daily.`;
  const cr = crumbs(lang, [[u.home, R.home[lang]], [name]]);
  const VP = k === "vegan" && fs.existsSync(`${SRC}/data/vegan-picks.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/vegan-picks.json`,"utf8")).items : [];
  const veganPicks = !VP.length ? "" : `<div class="wrap"><section class="section"><h2>${lang==="de"?"Vegane Produkt-Tipps (auch ohne Rabatt)":"Vegan product picks (not necessarily on sale)"}</h2>
    <p>${lang==="de"?"Ausdrücklich vegan gekennzeichnete Alternativen zu Leder, Wolle & Co. Den aktuellen Preis siehst du beim Shop.":"Explicitly vegan alternatives to leather, wool and more. See the current price at the shop."}</p>
    <ul class="link-list">${VP.map(p=>`<li><strong>${esc(p.type[lang])}: ${esc(p.name[lang])}</strong><br><span>${esc(p.why[lang])}</span><br><a class="btn btn-ghost" href="${amz(p.asin)}" ${AFF}>${lang==="de"?"Preis bei Amazon ansehen":"Check price on Amazon"} <span class="ad-tag">${UI[lang].ad}</span></a></li>`).join("")}</ul></section></div>`;
  const veganNote = k !== "vegan" ? "" : `<div class="wrap"><p class="lead">${lang==="de"
    ? "Nur Produkte, die Hersteller oder Shop ausdrücklich als vegan kennzeichnen: Lebensmittel, Protein, Kosmetik, Kleidung und Schuhe ohne tierische Materialien. Bitte Angaben vor dem Kauf im Shop prüfen."
    : "Only products the maker or shop explicitly labels as vegan: food, protein, cosmetics, clothing and shoes without animal materials. Please check details in the shop before buying."}</p>${lang==="de" ? `<p><a class="more" href="/vegan-ratgeber/">🌱 Vegan-Ratgeber: vegan werden, B12, Protein, günstig einkaufen, Siegel und mehr</a></p>` : ""}</div>`;
  const desc2 = k !== "vegan" ? desc : (lang==="de" ? `Vegane Angebote: ausdrücklich vegan gekennzeichnete Produkte im Angebot, von pflanzlichem Protein bis veganen Schuhen. ${list.length} Deals, täglich geprüft.` : `Vegan deals: products explicitly labelled vegan, from plant protein to vegan shoes. ${list.length} deals, checked daily.`);
  const catTopics = lang!=="de" ? [] : TOPICS.filter(T => !T.price && topicIndexed(T) && TOPIC_LIVE[T.slug].filter(d => catHas(d, k)).length * 2 > TOPIC_LIVE[T.slug].length);
  const body = `<div class="wrap">${cr.html}</div>${rail(lang, k)}${catTopics.length ? `<div class="wrap">${topicChips(catTopics)}</div>` : ""}${veganNote}${list.length ? grid(list, lang, "h1", h) : `<div class="wrap"><h1>${esc(h)}</h1><p>${lang==="de"?"Gerade gibt es hier keine geprüften Deals. Wir suchen mehrmals täglich nach neuen Angeboten.":"No checked deals here right now. We look for new offers several times a day."}</p></div>`}${catAlertBox(lang, k)}${veganPicks}${k==="travel" ? travelPartners(lang) : ""}`;
  const og = fs.existsSync(`${SRC}/assets/og/cat-${k}.jpg`) ? `/assets/og/cat-${k}.jpg` : undefined;
  layout({lang, pathFor:l=>R.cat[l](k), title: lang==="de" ? `${name}-Angebote & Deals ${MONTH_DE} · perldeals` : `${h} · perldeals`, description:desc2, body: body + `<div class="wrap">${followBox(lang)}</div>`, ld:[{"@context":"https://schema.org", ...cr.ld}], image:og});
}

/* Expired deals: old links (WhatsApp, Telegram, Google) land on a helpful page instead of a 404.
   src/data/archive.json keeps a snapshot of every deal that was ever online; local builds add new ones. */
const ARCHIVE = fs.existsSync(`${SRC}/data/archive.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/archive.json`, "utf8")) : {};
if (!process.env.CI) {
  const liveIds = new Set(DATA.deals.map(d => d.id)), endDay = new Date().toISOString().slice(0,10);
  for (const d of DATA.deals) ARCHIVE[d.id] = Object.fromEntries(["id","asin","shop","shopName","brand","cat","now","was","title","added","vegan"].filter(k => d[k] !== undefined).map(k => [k, d[k]]));
  for (const a of Object.values(ARCHIVE)) { if (liveIds.has(a.id)) delete a.ended; else if (!a.ended) a.ended = endDay; }
  fs.writeFileSync(`${SRC}/data/archive.json`, JSON.stringify(ARCHIVE, null, 0));
}
/* Auto-Deals stehen nicht in deals.json: ihr Schnappschuss liegt in /data/auto-archive.json (CI lädt die Live-Datei, ergänzt und lädt sie wieder hoch) */
const AUTO_ARCH = fs.existsSync(`${SRC}/data/auto-archive.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/auto-archive.json`, "utf8")) : {};
{ const today = new Date().toISOString().slice(0,10), liveIds = new Set(DATA.deals.map(d => d.id));
  for (const d of DATA.deals.filter(d => d.auto)) AUTO_ARCH[d.id] = Object.fromEntries(["id","shop","shopName","brand","cat","now","was","title","added","vegan"].filter(k => d[k] !== undefined).map(k => [k, d[k]]));
  for (const a of Object.values(AUTO_ARCH)) { if (liveIds.has(a.id)) delete a.ended; else if (!a.ended) a.ended = today; if (!ARCHIVE[a.id]) ARCHIVE[a.id] = a; }}
const LIVE = new Set(DATA.deals.map(d => d.id));
const EXPIRED = Object.values(ARCHIVE).filter(a => !LIVE.has(a.id) && CATS[a.cat] && a.title);
function buildExpired(lang, a){
  const de = lang==="de", u = UI[lang], t = a.title[lang] || a.title.de, cat = CATS[a.cat][lang][0];
  const alts = sorted.filter(x => x.cat === a.cat).slice(0, 6);
  const shop = a.shopName || "Amazon.de";
  const body = `<div class="wrap">
    <div class="expired">
      <div class="eyebrow">${de?"Deal abgelaufen":"Deal expired"} · ${esc(cat)} · ${esc(a.brand||"")}</div>
      <h1>${esc(t)}</h1>
      <p class="lead">${NP(a) ? (de?"Dieses Angebot ist leider vorbei.":"Sorry, this offer has ended.") : de?`Dieses Angebot ist leider vorbei. Zuletzt kostete es bei ${esc(shop)} ${eur(a.now,"de")} statt ${eur(a.was,"de")}.`:`Sorry, this offer has ended. It last cost ${eur(a.now,"en")} instead of ${eur(a.was,"en")} at ${esc(shop)}.`}</p>
      ${PRICEUP[a.id] ? `<p class="note xp-up">${de?`Der Preis ist wieder gestiegen: aktuell ${eur(PRICEUP[a.id].price,"de")} (Stand ${fmtDate(PRICEUP[a.id].ts,"de")}). Mit dem Preisalarm erfährst du, wenn er wieder fällt.`:`The price has gone up again: currently ${eur(PRICEUP[a.id].price,"en")} (as of ${fmtDate(PRICEUP[a.id].ts,"en")}). Set a price alert to know when it drops again.`}</p>` : ""}
      ${SHOPS[a.shop] ? `<p><a class="btn btn-ghost" href="${R.shop[lang](a.shop)}">${de?`Aktuelle ${esc(SHOPS[a.shop].name)}-Angebote`:`Current ${esc(SHOPS[a.shop].name)} deals`}</a></p>` : ""}
      ${!NP(a) && (HIST[a.id]||[]).length >= 2 ? historyBox(a, lang) : ""}
      <p class="note"><a href="${de?"/abgelaufene-deals/":"/en/expired-deals/"}">${de?"Alle abgelaufenen Deals ansehen":"See all expired deals"}</a></p>
      <div class="expired-cta">
        <strong>${de?"Verpasst? Beim nächsten Mal bekommst du ihn sofort.":"Missed it? Next time you get it instantly."}</strong>
        ${alertBox(lang, a)}
      </div>
    </div>
    ${followBox(lang)}
    ${alts.length?`<section class="section"><h2>${de?`Aktuelle ${esc(cat)}-Deals`:`Current ${esc(cat)} deals`}</h2><ul class="grid">${alts.map(x=>card(x, lang)).join("")}</ul><p class="prose"><a class="more" href="${R.cat[lang](a.cat)}">${de?"Alle Deals dieser Kategorie":"All deals in this category"}</a></p></section>`:""}
  </div>`;
  layout({lang, pathFor:l=>R.deal[l](a.id), title:`${de?"Abgelaufen":"Expired"}: ${t.split(",")[0]} · perldeals`, description:de?`Der Deal für ${t} ist abgelaufen. Aktuelle ${cat}-Deals und Preisalarm, damit du den nächsten nicht verpasst.`:`The deal on ${t} has ended. Current ${cat} deals and a price alert so you don't miss the next one.`, body});
}

/* Übersicht abgelaufener Deals (Nico 04.11.): zeigt, welche Perlen wir schon gefunden haben */
function buildExpiredHub(lang){
  const de = lang==="de";
  const endOf = a => a.ended || (a.added||"").slice(0,10) || "2026-10-01";
  const list = EXPIRED.slice().sort((x,y) => endOf(y).localeCompare(endOf(x)));
  const priced = list.filter(a => !NP(a) && a.was > a.now);
  const avg = priced.length ? Math.round(priced.reduce((s,a) => s + pct(a), 0) / priced.length) : 0;
  const save = priced.reduce((s,a) => s + (a.was - a.now), 0);
  const top = priced.slice().sort((x,y) => (y.was-y.now)-(x.was-x.now))[0];
  const months = {};
  for (const a of list) { const m = endOf(a).slice(0,7); (months[m] = months[m] || []).push(a); }
  const mName = m => new Date(m+"-15T12:00:00").toLocaleDateString(de?"de-DE":"en-GB", {month:"long", year:"numeric"});
  const row = a => { const t = a.title[lang] || a.title.de; return `<li><a href="${R.deal[lang](a.id)}">${esc(t)}</a><span class="xp-meta">${esc(a.shopName || "Amazon.de")}${NP(a) ? "" : ` · ${de?"zuletzt":"last"} <strong>${eur(a.now,lang)}</strong> ${de?"statt":"instead of"} ${eur(a.was,lang)} <span class="xp-pct">−${pct(a)} %</span>`}</span></li>`; };
  const body = `<div class="wrap xp-wrap">
    <div class="eyebrow">${de?"Verpasste Perlen":"Missed pearls"}</div>
    <h1>${de?"Abgelaufene Deals: Diese Schnäppchen haben wir schon gefunden":"Expired deals: bargains we have already found"}</h1>
    <p class="lead">${de?"Hier landen alle Angebote, die vorbei oder ausverkauft sind. So siehst du, welche Preise bei welchem Shop schon möglich waren – und wie oft sich das Warten lohnt. Mit dem Preisalarm oder unserem WhatsApp-Kanal bekommst du den nächsten Deal sofort.":"Every offer that has ended or sold out lands here, so you can see which prices were possible at which shop. Use a price alert or our WhatsApp channel to catch the next one."}</p>
    <ul class="xp-stats">
      <li><strong>${list.length}</strong><span>${de?"abgelaufene Deals":"expired deals"}</span></li>
      ${priced.length ? `<li><strong>−${avg} %</strong><span>${de?"Rabatt im Schnitt":"average discount"}</span></li><li><strong>${eur(Math.round(save / priced.length),lang)}</strong><span>${de?"Ersparnis pro Deal im Schnitt":"average saving per deal"}</span></li>` : ""}
    </ul>
    ${top ? `<p>${de?"Größte Ersparnis bisher":"Biggest saving so far"}: <a href="${R.deal[lang](top.id)}">${esc(top.title[lang]||top.title.de)}</a> – ${eur(top.now,lang)} ${de?"statt":"instead of"} ${eur(top.was,lang)}.</p>` : ""}
    <div class="ak-cta"><a class="btn btn-primary" href="${R.home[lang]}">${de?"Zu den aktuellen Deals":"Current deals"}</a><a class="btn btn-ghost" href="${SOCIAL.wa}" target="_blank" rel="noopener">${de?"📲 WhatsApp-Kanal folgen":"📲 Follow on WhatsApp"}</a></div>
    ${Object.keys(months).map(m => `<section class="section"><h2>${mName(m)} <span class="n">${months[m].length}</span></h2><ul class="xp-list">${months[m].map(row).join("")}</ul></section>`).join("")}
    ${followBox(lang)}
  </div>`;
  const maxP = priced.length ? Math.max(...priced.map(pct)) : 0;
  layout({lang, pathFor:l => l==="de" ? "/abgelaufene-deals/" : "/en/expired-deals/", title: de ? `Abgelaufene Deals: ${list.length} Schnäppchen mit bis zu −${maxP} % · perldeals` : `Expired deals: ${list.length} bargains we found · perldeals`,
    description: de ? `${list.length} abgelaufene Deals${priced.length?` mit im Schnitt −${avg} % Rabatt`:""}: Diese Preise waren bei Amazon, OTTO, Coolblue, Alternate und Co. schon möglich. Jetzt Preisalarm setzen.` : `${list.length} expired deals and the prices that were possible. Set a price alert for the next one.`, body});
}


/* Status-Karten (Nico 05.11.): /status/<id>/ – hochformatige Karte je Deal für den WhatsApp-Status (Screenshot im Hochformat-Fenster), noindex */
function buildStatus(d){
  const t = d.title.de, dir = `${OUT}/status/${d.id}`;
  const img = d.img ? `<img class="st-img" src="${esc(d.img.src)}" alt="">` : `<div class="st-icon">${icon(d.cat, 160)}</div>`;
  const price = NP(d) ? `<div class="st-price"><span class="st-now st-np">Aktueller Preis bei Amazon</span></div>`
    : `<div class="st-price"><span class="st-now">${eur(d.now,"de")}</span><span class="st-was">statt ${eur(d.was,"de")}</span><span class="st-pct">−${pct(d)} %</span></div>`;
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(`${dir}/index.html`, `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(t)} · perldeals</title><link rel="stylesheet" href="/assets/style.css"></head><body class="st-body"><main class="st">
<div class="st-top"><span class="pearl" aria-hidden="true"></span><span class="st-brand">perldeals</span><span class="st-tag">🔥 Deal des Tages</span></div>
<div class="st-card">${img}</div>
<div class="st-shop">${esc(shopName(d))}</div>
<h1 class="st-title">${esc(t)}</h1>
${price}
<div class="st-foot">👉 Link im nächsten Status · perldeals.com</div>
</main></body></html>`);
}
/* Gutscheine des Shops direkt beim Deal (Nico 05.11.: Leute sollen nicht auf Gutscheinseiten abwandern) */
function dealCodes(d, lang){
  const k = shopKey(d), de = lang === "de";
  const codes = activeCodes().filter(c => c.shop === k && c.code).slice(0, 2);
  if (!codes.length) return "";
  return `<div class="deal-codes"><strong>${de ? `🎟️ Gutschein für ${esc(shopName(d))}` : `🎟️ Voucher for ${esc(shopName(d))}`}</strong>${codes.map(c => `<div class="dc-row"><button class="dc-code" type="button" data-code="${esc(c.code)}" title="${de?"Code kopieren":"Copy code"}">${esc(c.code)}</button><span>${esc(c.title[lang] || c.title.de)}${c.validUntil ? ` · ${de?"bis":"until"} ${new Date(c.validUntil+"T12:00:00Z").toLocaleDateString(loc[lang], {day:"2-digit", month:"2-digit"})}` : ""}</span></div>`).join("")}<p class="dc-note">${de ? "Bedingungen im Shop prüfen, nicht mit jedem Angebot kombinierbar." : "Check the conditions in the shop."} <a href="${R.coupon[lang](k)}">${de?"Alle Gutscheine":"All vouchers"}</a> · <a href="/gutschein-alarm/?shop=${k}">${de?"Gutschein-Alarm":"Voucher alert"}</a></p></div>`;
}
/* Häufige Fragen je Deal (12.11.): datenbasierte Antworten (Preis, Einordnung, Laufzeit) plus optionale recherchierte Produktfragen aus d.faq / Kaufberatung. Nichts Erfundenes. */
function dealFaq(d, lang, tShort){
  if (lang !== "de") return [];
  if (tShort.length > 42) { const cut = tShort.split(/ mit | für | inkl\.? | – | - /)[0].trim(); if (cut.length >= 10) tShort = cut; }
  const f = priceFacts(d), out = [], shop = shopName(d), day = fmtDay(d.priceTs || d.checked || d.added || DATA.updated, "de");
  const fd = x => new Date(x+"T12:00:00").toLocaleDateString("de-DE", {day:"numeric", month:"long", year:"numeric"});
  if (NP(d)) {
    out.push([`Was kostet ${tShort} gerade?`, `Den aktuellen Preis siehst du direkt bei Amazon, er ändert sich dort oft mehrmals am Tag. Zuletzt wurde das Angebot am ${npDay(d,"de")} mit rund ${pct(d)} % Rabatt gemeldet.`]);
  } else {
    out.push([`Was kostet ${tShort} gerade?`, `Bei ${shop} kostet ${tShort} ${eur(d.now,"de")} (Stand ${day}). Der Vergleichspreis liegt bei ${eur(d.was,"de")}, das sind ${pct(d)} % weniger.`]);
    let a;
    if (d.idealoMedian && d.idealoMedian > d.now) a = `Laut idealo lag der günstigste Preis im Handel in den letzten 30 Tagen im Mittel bei ${eur(d.idealoMedian,"de")}. Der aktuelle Preis von ${eur(d.now,"de")} liegt ${Math.round((1-d.now/d.idealoMedian)*100)} % darunter.`;
    else if (f.days >= 7 && f.min != null) a = d.now <= f.min ? `Ja, nach unserer eigenen Aufzeichnung: Seit ${fd(f.first)} haben wir bei ${shop} keinen niedrigeren Preis als ${eur(d.now,"de")} gesehen.` : `Wir zeichnen den Preis seit ${fd(f.first)} auf. Der tiefste Preis in dieser Zeit war ${eur(f.min,"de")}, aktuell sind es ${eur(d.now,"de")}.`;
    else a = `Der Vergleichspreis von ${eur(d.was,"de")} ist der Streichpreis bzw. die UVP laut ${shop}. Gegenüber dem üblichen Marktpreis fällt die Ersparnis meist kleiner aus als gegenüber der UVP. Wir zeichnen den Preis ab jetzt täglich auf und zeigen den Verlauf auf dieser Seite.`;
    out.push([`Ist ${eur(d.now,"de")} ein guter Preis für ${tShort}?`, a]);
  }
  const extra = (d.faq && d.faq.de) || (GUIDES[d.id] && GUIDES[d.id].de && GUIDES[d.id].de.faq) || [];
  for (const q of extra.filter(q => q && q[0] && q[1] && q[0].trim().length > 8 && q[1].trim().length > 15).slice(0, 5)) out.push(q);
  out.push([`Wie lange gilt das Angebot?`, d.validUntil ? `Laut ${shop} gilt der Preis bis ${fd(String(d.validUntil).slice(0,10))} oder solange der Vorrat reicht.` : `${shop} nennt kein festes Enddatum. Wir prüfen die Angebote mehrmals täglich und kennzeichnen sie als abgelaufen, sobald der Preis steigt oder der Artikel ausverkauft ist.`]);
  out.push([`Kostet mich der Kauf über perldeals mehr?`, `Nein. Wir erhalten bei einem Kauf über unseren Link ggf. eine Provision vom Shop, der Preis bleibt für dich gleich.`]);
  return out;
}
function buildDeal(lang, d){
  const u = UI[lang], t = d.title[lang], cat = CATS[d.cat][lang][0];
  const related = sorted.filter(x => x.cat === d.cat && x.id !== d.id).slice(0, 3);
  const h1 = NP(d) ? t : lang==="de" ? `${t} für ${eur(d.now,"de")}` : `${t} for ${eur(d.now,"en")}`;
  let tShort = t.split(",")[0];
  if (tShort.lastIndexOf("(") > tShort.lastIndexOf(")")) tShort = tShort.slice(0, tShort.lastIndexOf("(")); // no half-open brackets
  tShort = tShort.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const seoTitle = (d.seoTitle && d.seoTitle[lang]) ? d.seoTitle[lang] : NP(d) ? (lang==="de" ? `${tShort} bei Amazon (zuletzt −${pct(d)}%)` : `${tShort} at Amazon (last −${pct(d)}%)`) : lang==="de" ? `${tShort} für ${eur(d.now,"de")} (−${pct(d)}%)` : `${tShort} for ${eur(d.now,"en")} (−${pct(d)}%)`;
  const summary = NP(d) ? (lang==="de" ? `${t} wurde am ${npDay(d,"de")} in Deal-Berichten mit ${pct(d)} % Rabatt bei Amazon gemeldet. Den aktuellen Preis siehst du direkt bei Amazon; Preise bei Amazon ändern sich oft mehrmals am Tag.` : `${t} was reported on ${npDay(d,"en")} at ${pct(d)}% off at Amazon. Check the current price directly on Amazon; Amazon prices often change several times a day.`) : lang==="de"
    ? `Bei ${shopName(d)} kostet ${t} am ${fmtDay(DATA.updated,"de")} ${eur(d.now,"de")} statt ${eur(d.was,"de")}. Das sind ${pct(d)} % oder ${eur(d.was-d.now,"de")} weniger.`
    : `On ${fmtDay(DATA.updated,"en")}, ${t} costs ${eur(d.now,"en")} at ${shopName(d)} instead of ${eur(d.was,"en")}. That is ${pct(d)}% or ${eur(d.was-d.now,"en")} less.`;
  const cr = crumbs(lang, [[u.home, R.home[lang]], [cat, R.cat[lang](d.cat)], [t]]);
  // Product markup only with a real product photo: Google treats a missing "image" as critical. No invented ratings, shipping or return data (we are not the seller).
  const product = d.img ? {"@context":"https://schema.org","@type":"Product","name":t,"description":summary,"brand":{"@type":"Brand","name":d.brand},...(d.asin?{"sku":d.asin}:{}),"category":cat,"image":absUrl(d.img.src),
    "offers":{"@type":"Offer","price":d.now.toFixed(2),"priceCurrency":"EUR","availability":"https://schema.org/InStock","itemCondition":/generalüberholt|refurbished/i.test(d.title.de+d.title.en)?"https://schema.org/RefurbishedCondition":"https://schema.org/NewCondition","url":BASE+R.deal[lang](d.id),"seller":{"@type":"Organization","name":shopName(d)},...(d.added?{"validFrom":d.added}:{}),...(d.validUntil?{"priceValidUntil":d.validUntil}:{})}} : null;
  const dfaq = dealFaq(d, lang, tShort);
  const body = `<div class="wrap">
    ${cr.html}
    <div class="p-hero">
      <div>
        <div class="eyebrow">Deal · ${esc(cat)} · ${esc(d.brand)}</div>
        <h1>${esc(h1)}${veganTag(d, lang)}</h1>
        <div class="updated"><span>${u.priceAt} ${DSTAMP(d, lang)}</span>${d.asin?`<span>ASIN <span class="mono">${d.asin}</span></span>`:`<span>${esc(shopName(d))}</span>`}</div>
        <div class="answer"><h2>${lang==="de"?"Das Wichtigste":"Key facts"}</h2><p>${esc(summary)}${d.note?" "+esc(d.note[lang]):""}</p></div>
        ${GUIDES[d.id]?`<p class="prose"><a class="more" href="${R.guide[lang](d.id)}">${u.guideLink}</a></p>`:""}
        ${lang==="de" ? wdLinkFor(d) : ""}
        ${Object.keys(ARTICLES).filter(k=>ARTICLES[k].picks.includes(d.id)).map(k=>`<p class="prose"><a class="more" href="${R.article[lang](k)}">${lang==="de"?"Im Vergleich":"Compared"}: ${esc(ARTICLES[k][lang].h1)}</a></p>`).join("")}
      </div>
      <aside class="buybox" aria-label="${u.details}">
        <div class="visual">${pic(d,80)}<span class="brand">${esc(d.brand)}</span>${discBadge(d)}${d.low?`<span class="low">${u.best}</span>`:""}</div>
        <div class="buybox-body">
          ${NP(d) ? npPrice(d, lang) : `<div class="price"><span class="now">${eur(d.now, lang)}</span><span class="was">${eur(d.was, lang)}</span></div>
          <div class="save">${eur(d.was-d.now, lang)} ${u.saved}</div>${idealoLine(d, lang)}`}
          <a class="btn btn-primary" href="${dealLink(d)}" ${AFF}>${u.atShop(shopName(d))} <span class="ad-tag">${u.ad}</span></a>${shareBtn(d, lang, true)}
          <div class="stamp">${u.priceAt} ${DSTAMP(d, lang)}. ${u.priceNote} <a href="${R.money[lang]}">${u.more}</a>.</div>
          ${dealCodes(d, lang)}
          ${alertBox(lang, d)}
        </div>
      </aside>
    </div>
    ${followBox(lang)}
    ${NP(d) ? "" : `<section class="section">${historyBox(d, lang)}</section>`}
    ${dfaq.length ? faqBlock(lang, dfaq).replace("<h2>Häufige Fragen</h2>", `<h2>Häufige Fragen: ${esc(tShort)}</h2>`) : ""}
    ${lang==="de" ? (() => { const tl = topicsFor(d).slice(0, 4), bk = brandKeyOf(d); const bl = BRAND_SET.has(bk) && brandLive(bk).length ? `<a class="chip" href="${BRAND_PATH(bk)}">Alle ${esc(d.brand)}-Angebote</a>` : ""; return tl.length || bl ? `<section class="section"><h2>Mehr Angebote</h2><nav class="chips topic-chips" aria-label="Mehr Angebote">${tl.map(T => `<a class="chip" href="${TOPIC_PATH(T.slug)}">${esc(T.h)}</a>`).join("")}${bl}</nav></section>` : ""; })() : ""}
    ${related.length?`<section class="section"><h2>${u.related}</h2><ul class="grid">${related.map(x=>card(x, lang)).join("")}</ul></section>`:""}
  </div>
  <div class="mobile-cta">${NP(d) ? "" : `<span class="now">${eur(d.now, lang)}</span>`}<a class="btn btn-primary" href="${dealLink(d)}" ${AFF}>${u.atShop(shopName(d))} <span class="ad-tag">${u.ad}</span></a></div>`;
  layout({lang, pathFor:l=>R.deal[l](d.id), title:`${seoTitle} · perldeals`, description:summary, body, ld:[...(product?[product]:[]), ...(dfaq.length?[faqLd(dfaq)]:[]), {"@context":"https://schema.org", ...cr.ld}], bodyClass:"has-cta", type:"product", image: fs.existsSync(`${SRC}/assets/og/deal/${d.id}.jpg`) ? `/assets/og/deal/${d.id}.jpg` : d.img && d.img.src.startsWith("/assets/products/") ? d.img.src : d.asin && d.img && /^https:\/\/m\.media-amazon\.com\//.test(d.img.src) ? d.img.src : (fs.existsSync(`${SRC}/assets/og/${d.id}.jpg`) ? `/assets/og/${d.id}.jpg` : `/assets/og/cat-${d.cat}.jpg`)});
}

function buildGuide(lang, id){
  const G = GUIDES[id], g = G[lang], d = DATA.deals.find(x => x.id === id), u = UI[lang];
  if (!d) return;
  const T = lang==="de"
    ? {short:"Kurze Antwort", upd:"Aktualisiert am", plus:"Spricht dafür", minus:"Spricht dagegen", forWho:"Passt zu dir, wenn …", skip:"Lieber nicht, wenn …", specs:"Technische Daten", faq:"Häufige Fragen", alt:"Alternativen aus den aktuellen Deals", src:"Quellen", srcNote:"Technische Daten und Einschätzungen stammen aus Herstellerangaben und unabhängigen Tests. Preise von Amazon.de zum angegebenen Zeitpunkt."}
    : {short:"Short answer", upd:"Updated", plus:"In favour", minus:"Against", forWho:"A good fit if …", skip:"Skip it if …", specs:"Specifications", faq:"Frequently asked questions", alt:"Alternatives from current deals", src:"Sources", srcNote:"Specs and assessments are based on manufacturer data and independent reviews. Prices from Amazon.de at the time shown."};
  const related = sorted.filter(x => x.cat === d.cat && x.id !== d.id).sort((a,b)=>a.now-b.now).slice(0,3);
  const cr = crumbs(lang, [[u.home, R.home[lang]], [lang==="de"?"Kaufberatung":"Buying guides", R.guides[lang]], [g.h1]]);
  const ld = [
    {"@context":"https://schema.org","@type":"Article","headline":g.h1,"description":g.desc,"inLanguage":lang,"dateModified":G.updated,"datePublished":G.updated,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`},"mainEntityOfPage":BASE+R.guide[lang](id),
      ...(G.sources.length?{"citation":G.sources.map(s=>s[1])}:{}),
      "about":{"@type":"Thing","name":d.title[lang]}},
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":g.faq.map(f=>({"@type":"Question","name":f[0],"acceptedAnswer":{"@type":"Answer","text":f[1]}}))},
    {"@context":"https://schema.org", ...cr.ld}
  ];
  const body = `<div class="wrap">
    ${cr.html}
    <div class="p-hero">
      <div>
        <div class="eyebrow">${esc(g.eyebrow)}</div>
        <h1>${esc(g.h1)}</h1>
        <div class="updated"><span>${T.upd} ${fmtDay(G.updated+"T12:00:00+02:00", lang)}</span><span>${u.priceAt} ${STAMP(lang)}</span></div>
        <div class="answer"><h2>${T.short}</h2><p>${esc(g.answer)}</p></div>
      </div>
      <aside class="buybox" aria-label="${u.details}">
        <div class="visual">${pic(d,80)}<span class="brand">${esc(d.brand)}</span>${discBadge(d)}${d.low?`<span class="low">${u.best}</span>`:""}</div>
        <div class="buybox-body">
          ${NP(d) ? npPrice(d, lang) : `<div class="price"><span class="now">${eur(d.now, lang)}</span><span class="was">${eur(d.was, lang)}</span></div>
          <div class="save">${eur(d.was-d.now, lang)} ${u.saved}</div>`}
          <a class="btn btn-primary" href="${dealLink(d)}" ${AFF}>${u.atShop(shopName(d))} <span class="ad-tag">${u.ad}</span></a>${shareBtn(d, lang, true)}
          <div class="stamp">${u.priceAt} ${DSTAMP(d, lang)}. ${u.priceNote} <a href="${R.money[lang]}">${u.more}</a>.</div>
        </div>
      </aside>
    </div>
    <section class="section"><h2>${esc(g.fitH)}</h2>
      <div class="pc"><div class="plus"><h3>${T.plus}</h3><ul>${g.plus.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div class="minus"><h3>${T.minus}</h3><ul>${g.minus.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></div>
      <div class="pc" style="margin-top:16px"><div><h3>${T.forWho}</h3><p class="prose" style="margin:0">${esc(g.forWho)}</p></div><div><h3>${T.skip}</h3><p class="prose" style="margin:0">${esc(g.skip)}</p></div></div>
    </section>
    <section class="section"><h2>${T.specs}</h2><div class="specs-wrap"><table class="specs">${g.specs.map(s=>`<tr><th scope="row">${esc(s[0])}</th><td>${esc(s[1])}</td></tr>`).join("")}<tr><th scope="row">Amazon ASIN</th><td class="mono">${d.asin}</td></tr></table></div></section>
    <section class="section"><h2>${T.faq}: ${esc(d.title[lang].split(",")[0])}</h2>${g.faq.map((f,i)=>`<details class="faq"${i===0?" open":""}><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>
    ${related.length?`<section class="section"><h2>${T.alt}</h2><p class="prose">${esc(g.altP)}</p><ul class="grid">${related.map(x=>card(x, lang)).join("")}</ul></section>`:""}
    <section class="section"><h2>${T.src}</h2><p class="prose">${T.srcNote}</p>${G.sources.length?`<ul class="prose">${G.sources.map(s=>`<li><a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a></li>`).join("")}</ul>`:""}</section>
  </div>
  <div class="mobile-cta">${NP(d) ? "" : `<span class="now">${eur(d.now, lang)}</span>`}<a class="btn btn-primary" href="${dealLink(d)}" ${AFF}>${u.atShop(shopName(d))} <span class="ad-tag">${u.ad}</span></a></div>`;
  layout({lang, pathFor:l=>R.guide[l](id), title:`${g.title} · perldeals`, description:g.desc, body, ld, bodyClass:"has-cta", type:"article", image: fs.existsSync(`${SRC}/assets/og/${id}.jpg`) ? `/assets/og/${id}.jpg` : ""});
}

function buildArticle(lang, slug){
  const A = ARTICLES[slug], a = A[lang], u = UI[lang], de = lang==="de";
  const picks = A.picks.map(id => DATA.deals.find(d => d.id === id)).filter(Boolean);
  if (picks.length < 2) return;
  const T = de
    ? {short:"Kurze Antwort", upd:"Aktualisiert am", how:"So haben wir verglichen", table:"Die Modelle im Überblick", price:"Preis", picks:"Unsere Empfehlungen", faq:"Häufige Fragen", src:"Quellen", srcNote:"Wir haben die Geräte nicht selbst im Labor getestet. Technische Daten stammen von den Herstellern, Einschätzungen aus den unten verlinkten unabhängigen Tests. Preise zum angegebenen Zeitpunkt.", guide:"Ausführliche Kaufberatung", deal:"Zum Deal"}
    : {short:"Short answer", upd:"Updated", how:"How we compared", table:"The models at a glance", price:"Price", picks:"Our picks", faq:"Frequently asked questions", src:"Sources", srcNote:"We did not lab-test the devices ourselves. Specs come from the manufacturers, assessments from the independent reviews linked below. Prices at the time shown.", guide:"Full buying guide", deal:"See the deal"};
  const byId = Object.fromEntries(picks.map(d => [d.id, d]));
  const cr = crumbs(lang, [[u.home, R.home[lang]], [de?"Kaufberatung":"Buying guides", R.guides[lang]], [a.h1]]);
  const ld = [
    {"@context":"https://schema.org","@type":"Article","headline":a.h1,"description":a.desc,"inLanguage":lang,"dateModified":A.updated,"datePublished":A.updated,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`},"mainEntityOfPage":BASE+R.article[lang](slug),
      ...(A.sources.length?{"citation":A.sources.map(s=>s[1])}:{})},
    {"@context":"https://schema.org","@type":"ItemList","name":a.h1,"itemListElement":picks.map((d,i)=>({"@type":"ListItem","position":i+1,"url":BASE+R.deal[lang](d.id),"name":d.title[lang]}))},
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":a.faq.map(f=>({"@type":"Question","name":f[0],"acceptedAnswer":{"@type":"Answer","text":f[1]}}))},
    {"@context":"https://schema.org", ...cr.ld}
  ];
  const rows = (a.table?.rows || []).filter(r => byId[r[0]]);
  const table = rows.length ? `<section class="section"><h2>${T.table}</h2><div class="specs-wrap cmp-wrap"><table class="cmp"><thead><tr>${a.table.cols.map(c=>`<th scope="col">${esc(c)}</th>`).join("")}<th scope="col">${T.price}</th></tr></thead><tbody>${rows.map(r => { const d = byId[r[0]]; return `<tr><th scope="row"><a href="${R.deal[lang](d.id)}">${esc(d.title[lang].split(",")[0])}</a></th>${r.slice(1).map(c=>`<td>${esc(c)}</td>`).join("")}<td class="mono"><strong>${NP(d) ? NPTXT(lang) : eur(d.now, lang)}</strong><br><a href="${dealLink(d)}" ${AFF}>${esc(shopName(d))}</a> <span class="ad-tag">${u.ad}</span></td></tr>`; }).join("")}</tbody></table></div><p class="stamp">${u.priceAt} ${STAMP(lang)}. ${u.priceNote}</p></section>` : "";
  const pickCards = picks.map(d => { const n = a.pickNotes?.[d.id]; return `<li class="card">
      <a class="visual" href="${R.deal[lang](d.id)}" tabindex="-1" aria-hidden="true">${pic(d,64)}<span class="brand">${esc(d.brand)}</span>${discBadge(d)}${n?`<span class="low">${esc(n.label)}</span>`:""}</a>
      <div class="card-body"><div class="meta"><span>${esc(shopName(d))}</span></div><h3><a href="${R.deal[lang](d.id)}">${esc(d.title[lang])}</a></h3>
      ${n?`<p class="note">${esc(n.why)}</p>`:""}
      ${NP(d) ? npPrice(d, lang) : `<div class="price"><span class="now">${eur(d.now, lang)}</span><span class="was">${eur(d.was, lang)}</span></div>`}
      ${GUIDES[d.id]?`<a class="more" href="${R.guide[lang](d.id)}">${T.guide}</a>`:""}
      <div class="card-foot"><a class="btn btn-primary" href="${dealLink(d)}" ${AFF}>${u.toDeal} <span class="ad-tag">${u.ad}</span></a>${shareBtn(d, lang)}</div></div></li>`; }).join("");
  const body = `<div class="wrap">
    ${cr.html}
    <div class="article-head">
      <div class="eyebrow">${esc(a.eyebrow)}</div>
      <h1>${esc(a.h1)}</h1>
      <div class="updated"><span>${T.upd} ${fmtDay(A.updated+"T12:00:00+02:00", lang)}</span><span>${u.priceAt} ${STAMP(lang)}</span></div>
      <div class="answer"><h2>${T.short}</h2><p>${esc(a.answer)}</p></div>
    </div>
    <section class="section"><h2>${T.picks}</h2><ul class="grid">${pickCards}</ul></section>
    ${table}
    <section class="section prose-block"><h2>${T.how}</h2><p class="prose">${esc(a.intro)}</p>
      ${a.sections.map(x=>`<h2>${esc(x[0])}</h2><p class="prose">${esc(x[1])}</p>`).join("")}</section>
    <section class="section"><h2>${T.faq}</h2>${a.faq.map((f,i)=>`<details class="faq"${i===0?" open":""}><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>
    <section class="section"><h2>${T.src}</h2><p class="prose">${T.srcNote}</p>${A.sources.length?`<ul class="prose">${A.sources.map(s=>`<li><a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a></li>`).join("")}</ul>`:""}</section>
  </div>`;
  layout({lang, pathFor:l=>R.article[l](slug), title:`${a.title} · perldeals`, description:a.desc, body, ld, type:"article", image: fs.existsSync(`${SRC}/assets/og/${slug}.jpg`) ? `/assets/og/${slug}.jpg` : ""});
}

/* ---------------- best-of lists, Black Friday, gift finder ---------------- */
const amzSearch = q => `https://www.amazon.de/s?k=${encodeURIComponent(q)}&tag=${DATA.amazonTag}`;
const dealById = id => id ? DATA.deals.find(d => d.id === id) : null;
function srcList(lang, sources){
  const T = lang==="de" ? "Quellen" : "Sources";
  const note = lang==="de" ? "Wir haben die Geräte nicht selbst im Labor getestet. Die Auswahl beruht auf Herstellerangaben und den unten verlinkten unabhängigen Tests." : "We did not lab-test the devices ourselves. The selection is based on manufacturer data and the independent reviews linked below.";
  return `<section class="section"><h2>${T}</h2><p class="prose">${note}</p>${sources?.length?`<ul class="prose">${sources.map(x=>`<li><a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])}</a></li>`).join("")}</ul>`:""}</section>`;
}
function faqBlock(lang, faq){
  return `<section class="section"><h2>${lang==="de"?"Häufige Fragen":"Frequently asked questions"}</h2>${faq.map((f,i)=>`<details class="faq"${i===0?" open":""}><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>`;
}
const faqLd = faq => ({"@context":"https://schema.org","@type":"FAQPage","mainEntity":faq.map(f=>({"@type":"Question","name":f[0],"acceptedAnswer":{"@type":"Answer","text":f[1]}}))});

function buildBest(lang, slug){
  const B = BEST[slug], b = B[lang], u = UI[lang], de = lang==="de";
  const cr = crumbs(lang, [[u.home, R.home[lang]], [de?"Bestenlisten":"Best lists", R.bestIndex[lang]], [b.h1]]);
  const items = b.items.map((it, i) => {
    const d0 = dealById(it.dealId), d = d0 && !NP(d0) ? d0 : null;
    const cta = d0 && NP(d0) ? `<div class="best-cta"><a class="btn btn-primary" href="${dealLink(d0)}" ${AFF}>${u.atShop(shopName(d0))} <span class="ad-tag">${u.ad}</span></a><a class="btn btn-ghost" href="${R.deal[lang](d0.id)}">${de?"Zum Deal":"See the deal"}</a></div>` : d
      ? `<div class="price"><span class="now">${eur(d.now, lang)}</span><span class="was">${eur(d.was, lang)}</span><span class="save">−${pct(d)}%</span></div>
         <div class="best-cta"><a class="btn btn-primary" href="${dealLink(d)}" ${AFF}>${u.atShop(shopName(d))} <span class="ad-tag">${u.ad}</span></a><a class="btn btn-ghost" href="${R.deal[lang](d.id)}">${de?"Zum Deal":"See the deal"}</a></div>
         <div class="stamp">${u.priceAt} ${DSTAMP(d, lang)}.</div>`
      : `<div class="best-cta"><a class="btn btn-ghost" href="${amzSearch(it.amazonQuery)}" ${AFF}>${de?"Preis bei Amazon ansehen":"Check price on Amazon"} <span class="ad-tag">${u.ad}</span></a></div>`;
    const ebayAlt = `<a class="more small" href="${ebaySearch(it.amazonQuery)}" ${AFF}>${de?"Neu, gebraucht oder generalüberholt bei eBay vergleichen":"Compare new, used or refurbished on eBay"} <span class="ad-tag">${u.ad}</span></a>`;
    return `<article class="best-item" id="platz-${i+1}">
      <div class="best-head"><span class="rank">${i+1}</span><div><div class="eyebrow">${esc(it.label)}</div><h3>${esc(it.name)}</h3></div></div>
      <div class="best-body">
        <div class="visual best-visual">${d ? pic(d, 80) : icon(B.cat, 80)}${d?`${discBadge(d)}`:""}</div>
        <div>
          <p class="prose" style="margin-top:0">${esc(it.why)}</p>
          <div class="pc"><div class="plus"><h4>${de?"Spricht dafür":"In favour"}</h4><ul>${it.plus.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div class="minus"><h4>${de?"Spricht dagegen":"Against"}</h4><ul>${it.minus.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></div>
          <div class="specs-wrap"><table class="specs">${it.specs.map(x=>`<tr><th scope="row">${esc(x[0])}</th><td>${esc(x[1])}</td></tr>`).join("")}</table></div>
          ${cta}
          <p style="margin:6px 0 0">${ebayAlt}</p>
          ${d && GUIDES[d.id] ? `<a class="more" href="${R.guide[lang](d.id)}">${u.guideLink}</a>` : ""}
        </div>
      </div>
    </article>`;
  }).join("");
  const toc = `<ol class="best-toc">${b.items.map((it,i)=>`<li><a href="#platz-${i+1}"><strong>${esc(it.label)}:</strong> ${esc(it.name)}</a></li>`).join("")}</ol>`;
  const others = Object.keys(BEST).filter(k=>k!==slug).map(k=>`<li><a href="${R.best[lang](k)}">${esc(BEST[k][lang].h1.split(":")[0])}</a></li>`).join("");
  const ld = [
    {"@context":"https://schema.org","@type":"Article","headline":b.h1,"description":b.desc,"inLanguage":lang,"dateModified":B.updated,"datePublished":B.updated,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`},"mainEntityOfPage":BASE+R.best[lang](slug),...(B.sources?.length?{"citation":B.sources.map(x=>x[1])}:{})},
    {"@context":"https://schema.org","@type":"ItemList","name":b.h1,"itemListOrder":"https://schema.org/ItemListOrderAscending","numberOfItems":b.items.length,"itemListElement":b.items.map((it,i)=>({"@type":"ListItem","position":i+1,"name":it.name,"url":`${BASE}${R.best[lang](slug)}#platz-${i+1}`}))},
    faqLd(b.faq), {"@context":"https://schema.org", ...cr.ld}
  ];
  const body = `<div class="wrap">${cr.html}
    <div class="article-head"><div class="eyebrow">${esc(b.eyebrow)}</div><h1>${esc(b.h1)}</h1>
      <div class="updated"><span>${de?"Aktualisiert am":"Updated"} ${fmtDay(B.updated+"T12:00:00+02:00", lang)}</span></div>
      <div class="answer"><h2>${de?"Kurze Antwort":"Short answer"}</h2><p>${esc(b.answer)}</p></div></div>
    <section class="section"><h2>${de?"Unsere Auswahl auf einen Blick":"Our picks at a glance"}</h2>${toc}</section>
    <section class="section best-list">${items}</section>
    <section class="section prose-block"><h2>${de?"So haben wir ausgewählt":"How we chose"}</h2><p class="prose">${esc(b.intro)}</p>
      ${b.criteria.map(x=>`<h2>${esc(x[0])}</h2><p class="prose">${esc(x[1])}</p>`).join("")}</section>
    ${subBox(lang, "best")}
    ${faqBlock(lang, b.faq)}
    <section class="section"><h2>${de?"Weitere Bestenlisten":"More best lists"}</h2><ul class="link-list">${others}</ul></section>
    ${srcList(lang, B.sources)}
  </div>`;
  layout({lang, pathFor:l=>R.best[l](slug), title:`${b.title} · perldeals`, description:b.desc, body, ld, type:"article", image: fs.existsSync(`${SRC}/assets/og/${slug}.jpg`) ? `/assets/og/${slug}.jpg` : ""});
}

function buildBestIndex(lang){
  const de = lang==="de", u = UI[lang];
  const h = de ? "Bestenlisten: Welches Gerät ist das beste?" : "Best lists: which one is the best?";
  const intro = de ? "Unsere Bestenlisten beantworten die Frage nach dem besten Gerät in einer Kategorie: mit Empfehlungen für jedes Budget, Vor- und Nachteilen, Kaufkriterien und Quellen. Wo es gerade ein Angebot gibt, siehst du den aktuellen Preis." : "Our best lists answer which device is best in a category, with picks for every budget, pros and cons, buying criteria and sources. Where there is a current deal, you see the price.";
  const cr = crumbs(lang, [[u.home, R.home[lang]], [de?"Bestenlisten":"Best lists"]]);
  const items = Object.keys(BEST).map(k => { const b = BEST[k][lang];
    return `<li class="card"><a class="visual" href="${R.best[lang](k)}" tabindex="-1" aria-hidden="true">${icon(BEST[k].cat,64)}<span class="brand">${esc(b.eyebrow)}</span></a>
      <div class="card-body"><div class="meta"><span>${esc(b.eyebrow)}</span></div><h3><a href="${R.best[lang](k)}">${esc(b.h1)}</a></h3><p class="note">${esc(b.answer.split(". ")[0])}.</p>
      <div class="card-foot"><a class="btn btn-ghost" href="${R.best[lang](k)}">${de?"Bestenliste lesen":"Read the list"}</a></div></div></li>`; }).join("");
  const ld = [{"@context":"https://schema.org","@type":"CollectionPage","name":h,"inLanguage":lang,"hasPart":Object.keys(BEST).map(k=>({"@type":"Article","headline":BEST[k][lang].h1,"url":BASE+R.best[lang](k)}))},{"@context":"https://schema.org", ...cr.ld}];
  layout({lang, image:"/assets/og/bestenliste.jpg", pathFor:l=>R.bestIndex[l], title:`${h} · perldeals`, description:(lang==="de"?"Bestenlisten 2026: die besten Saugroboter, Mähroboter, Kopfhörer, Airfryer, Monitore und Kameras mit Empfehlungen für jedes Budget.":"Best lists 2026: the best robot vacuums, mowers, headphones, air fryers, monitors and cameras, with picks for every budget."), body:`<div class="wrap">${cr.html}<div class="feed-head" style="display:block"><h1>${h}</h1><p class="lead">${intro}</p></div><ul class="grid">${items}</ul></div>`, ld});
}

/* Black-Friday-Unterseiten je Kategorie (DE, seit 04.11.) + Shop-Aktionen aus der Awin-API */
const BF_CATS = [
  ["saugroboter","Saugroboter",/saugrobot|wischrobot|saug-wisch|deebot|roborock|qrevo/i,[300,600]],
  ["staubsauger","Akku-Staubsauger",/staubsauger|akku-sauger|handstaubsauger|dyson v|stielsauger/i,[150,300]],
  ["fernseher","Fernseher",/\btv\b|fernseher|oled|qled|smart-tv/i,[500,1000]],
  ["laptop","Laptops",/notebook|laptop|thinkpad|macbook|chromebook|elitebook|zenbook|ideapad/i,[500,1000]],
  ["monitor","Monitore",/monitor/i,[150,300]],
  ["kopfhoerer","Kopfhörer",/kopfhörer|earbuds|headphones|airpods|in-ear|headset/i,[50,150]],
  ["smartphone","Smartphones",/smartphone|iphone|galaxy s|galaxy a|pixel \d|handy|edge \d|redmi|xiaomi \d/i,[300,600]],
  ["smartwatch","Smartwatches",/smartwatch|apple watch|galaxy watch|fitness-tracker/i,[100,250]],
  ["konsolen","Konsolen & Gaming",/playstation|ps5|xbox|nintendo|switch 2|konsole|gaming-stuhl|gaming chair|controller/i,[100,400]],
  ["lego","LEGO",/\blego\b/i,[50,100]],
  ["geschirrspueler","Geschirrspüler",/geschirrspül|spülmaschine/i,[300,600]],
  ["waermepumpentrockner","Wärmepumpentrockner & Trockner",/wärmepumpentrockner|wäschetrockner|(?<!wasch)trockner/i,[400,700]],
  ["waschtrockner","Waschtrockner",/waschtrockner/i,[500,800]],
  ["waschmaschine","Waschmaschinen",/waschmaschine/i,[350,600]],
  ["kuehlschrank","Kühlschrank & Gefrierschrank",/kühlschrank|gefrierschrank|kühl-gefrier|kühlgefrier/i,[350,700]],
  ["backofen","Backofen, Herd & Kochfeld",/backofen|herd-set|herdset|kochfeld|\bherd\b/i,[250,500]],
  ["kuechengeraete","Küchengeräte",null,[100,300],"kitchen"],
  ["werkzeug","Werkzeug",null,[100,250],"tools"],
  ["smart-home","Smart Home",null,[50,150],"smarthome"],
  /* 18.11.: Produkt-Keywords fürs Weihnachtsgeschäft (black friday fire tv stick, echo, airfryer, kaffeevollautomat, ssd …) */
  ["fire-tv-echo","Fire TV, Echo & Kindle",/fire tv|\becho\b|kindle|alexa|ember \d/i,[30,100]],
  ["heissluftfritteuse","Heißluftfritteusen (Airfryer)",/airfryer|heißluft|fritteuse|double stack|flexdrawer/i,[80,150]],
  ["kaffeemaschine","Kaffeemaschinen & Kaffeevollautomaten",/kaffee|espresso|senseo|nespresso|tassimo|siebträger/i,[100,400]],
  ["speicher","SSD, Festplatten & Speicherkarten",/\bssd\b|microsd|speicherkarte|festplatte|\bnvme\b|usb-stick/i,[50,120]],
  ["lautsprecher","Lautsprecher & Soundbars",/lautsprecher|soundbar|speaker|musikbox/i,[50,200]],
  ["kamera","Kameras, Action-Cams & Drohnen",/kamera|actioncam|action-cam|gopro|\bdji\b|insta360|drohne|webcam/i,[100,300]],
  ["spielzeug","Spielzeug (ohne LEGO)",/playmobil|spielzeug|puppe|barbie|hot wheels|ravensburger|brettspiel|dorfromantik|tonie/i,[25,60]]
];
const bfDeals = c => sorted.filter(d => c[4] ? d.cat === c[4] : c[2].test(`${d.title.de} ${d.brand||""}`));
/* Black Friday je Marke (07.11., Search Console: „bauknecht black friday“, „braun black friday“, „samsung cyber monday“ u. a.) – nur gebaut, wenn mind. 2 geprüfte Deals da sind */
const BF_BRANDS = [["bauknecht","Bauknecht",/bauknecht/i,[300,600]],["bosch","Bosch",/\bbosch\b/i,[300,600]],["siemens","Siemens",/\bsiemens\b/i,[300,600]],["samsung","Samsung",/samsung/i,[200,500]],["lg","LG",/\blg\b/i,[300,700]],["aeg","AEG",/\baeg\b/i,[300,600]],["braun","Braun",/\bbraun\b/i,[50,150]],["lenovo","Lenovo",/lenovo/i,[500,1000]],["dell","Dell",/\bdell\b|alienware/i,[500,1000]],["ecovacs","Ecovacs",/ecovacs|deebot/i,[300,600]],["ninja","Ninja & Shark",/\bninja\b|\bshark\b/i,[100,250]],["amazon","Amazon-Geräte",/fire tv|\becho\b|kindle|ember \d|\bring\b|blink/i,[30,100]],["philips","Philips",/philips/i,[50,200]],["roborock","Roborock",/roborock/i,[300,700]],["jbl","JBL",/\bjbl\b/i,[50,150]],["sony","Sony",/\bsony\b|playstation|ps5/i,[100,400]],["delonghi","De'Longhi",/de.?longhi/i,[200,500]],["dyson","Dyson",/dyson/i,[300,500]],["hp","HP",/\bhp\b|omen|omnibook/i,[400,800]],["xiaomi","Xiaomi",/xiaomi|redmi/i,[100,300]],["bose","Bose",/\bbose\b/i,[150,300]],["anker","Anker & soundcore",/anker|soundcore|eufy/i,[30,100]],["playmobil","PLAYMOBIL",/playmobil/i,[25,60]],["logitech","Logitech",/logitech/i,[30,100]],["dji","DJI",/\bdji\b/i,[200,500]],["microsoft","Microsoft & Xbox",/microsoft|surface|xbox/i,[100,800]],["msi","MSI",/\bmsi\b/i,[200,800]],["lego","LEGO",/\blego\b/i,[50,100]]].filter(b => b[0] !== "lego");
const bfBrandList = () => BF_BRANDS.filter(b => bfDeals(b).length >= 2);
const bfPromos = () => AWIN_PROMOS.filter(p => promoActive(p) && /black|cyber|singles day|bf-|bfw|november/i.test(`${p.title} ${p.description}`));
function buildBFSub(c){
  const [slug, name, , [p1, p2]] = c, list = bfDeals(c), path = `/black-friday/${slug}/`;
  const bf = new Date("2026-11-27T00:00:00+01:00"), days = Math.max(0, Math.ceil((bf - new Date()) / 86400000));
  const cr = crumbs("de", [["Start", R.home.de], ["Black Friday", R.bf.de], [name]]);
  const u1 = list.filter(d => d.now <= p1), u2 = list.filter(d => d.now > p1 && d.now <= p2);
  const maxPct = list.length ? Math.max(...list.map(pct)) : 0;
  const faq = [[`Wann ist Black Friday 2026?`, `Black Friday ist am Freitag, 27. November 2026, Cyber Monday am 30. November. Viele Shops starten ihre Aktionen schon Tage vorher.`],
    [`Lohnt es sich, mit dem Kauf von ${name} bis Black Friday zu warten?`, `Oft ja, besonders bei Technik. Aber nicht jeder Black-Friday-Preis ist ein Bestpreis: Wir prüfen jeden Deal gegen den Preisverlauf. Ist ein Preis schon jetzt sehr gut, steht das beim Deal.`],
    [`Wie finde ich die besten ${name}-Deals?`, `Auf dieser Seite sammeln wir geprüfte ${name}-Angebote aus vielen Shops, sortiert nach Ersparnis. Mit dem Deal-Alarm bekommst du neue Deals per E-Mail.`]];
  const body = `<div class="wrap">${cr.html}<div class="article-head"><div class="eyebrow">Black Friday 2026 · ${esc(name)}</div><h1>Black Friday ${esc(name)} 2026: die besten Angebote</h1>
    <div class="updated"><span>${list.length === 1 ? "1 geprüfter Deal" : `${list.length} geprüfte Deals`}</span>${maxPct?`<span>bis −${maxPct} %</span>`:""}${days?`<span>noch ${days} Tage bis Black Friday</span>`:""}<span>Stand ${fmtDay(DATA.updated,"de")}</span></div>
    <p class="prose">Hier sammeln wir die besten ${esc(name)}-Angebote rund um Black Friday und Cyber Monday 2026, gegen den Preisverlauf geprüft und mehrmals täglich aktualisiert. Fake-Rabatte mit aufgeblähten Streichpreisen lassen wir weg.</p>${subBox("de", "blackfriday")}</div></div>
    ${list.length ? grid(list.slice(0, 24), "de", "h2", `Aktuelle ${name}-Deals`) : `<div class="wrap"><p>Gerade gibt es keinen geprüften ${esc(name)}-Deal. Aktiviere den Deal-Alarm, dann verpasst du den ersten nicht.</p></div>`}
    <div class="wrap">${u1.length ? `<section class="section"><h2>${esc(name)} unter ${p1} €</h2><ul class="link-list">${u1.slice(0,10).map(d => `<li><a href="${R.deal.de(d.id)}">${esc(d.title.de)}</a>${NP(d) ? "" : ` – ${eur(d.now,"de")} statt ${eur(d.was,"de")}`}</li>`).join("")}</ul></section>` : ""}
    ${u2.length ? `<section class="section"><h2>${esc(name)} unter ${p2} €</h2><ul class="link-list">${u2.slice(0,10).map(d => `<li><a href="${R.deal.de(d.id)}">${esc(d.title.de)}</a>${NP(d) ? "" : ` – ${eur(d.now,"de")} statt ${eur(d.was,"de")}`}</li>`).join("")}</ul></section>` : ""}
    <section class="section"><h2>Black Friday nach Kategorie</h2><nav class="chips">${BF_CATS.filter(x => x !== c).map(x => `<a class="chip" href="/black-friday/${x[0]}/">${esc(x[1])}</a>`).join("")}<a class="chip" href="${R.bf.de}">Alle Black-Friday-Deals</a></nav>${bfBrandList().length ? `<h3>Nach Marke</h3><nav class="chips">${bfBrandList().filter(x => x[0] !== slug).map(x => `<a class="chip" href="/black-friday/${x[0]}/">${esc(x[1])}</a>`).join("")}</nav>` : ""}</section>
    ${faqBlock("de", faq)}</div>`;
  layout({lang:"de", single:true, pathFor:()=>path, title:`Black Friday ${name} 2026: beste Angebote · perldeals`, description:`Black Friday ${name} 2026: ${list.length === 1 ? "1 geprüftes Angebot" : `${list.length} geprüfte Angebote`}${maxPct?` mit bis zu ${maxPct} % Rabatt`:""}, gegen den Preisverlauf geprüft. Mehrmals täglich aktualisiert.`, body,
    ld:[faqLd(faq), {"@context":"https://schema.org", ...cr.ld}, {"@context":"https://schema.org","@type":"ItemList","name":`Black Friday ${name}`,"itemListElement":list.slice(0,20).map((d,i)=>({"@type":"ListItem","position":i+1,"url":BASE+R.deal.de(d.id),"name":d.title.de}))}]});
}
/* ---------- Neue SEO-Seiten (05.11.): Vegan-Ratgeber-Hub, „Ist das wasserdicht?“, Black Friday je Shop ---------- */
const srcList2 = arr => `<ul class="link-list">${arr.map(([n, u]) => `<li><a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(n)}</a></li>`).join("")}</ul>`;
function buildVeganHub(){
  if (!VEGAN_G) return;
  const H = VEGAN_G.hub, cr = crumbs("de", [["Start", R.home.de], ["Vegan", R.cat.de("vegan")], ["Ratgeber"]]);
  const vdeals = sorted.filter(d => d.cat === "vegan" || d.vegan).slice(0, 8);
  const faq = [["Wo finde ich vegane Angebote?", "In unserer Kategorie Vegan sammeln wir nur Produkte, die Hersteller oder Shop ausdrücklich als vegan kennzeichnen, von Proteinpulver über Lebensmittel bis zu Schuhen und Kosmetik."],
    ["Woran erkenne ich, ob ein Produkt vegan ist?", "Am sichersten an einem Vegan-Siegel (z. B. V-Label oder Veganblume) und an der Zutatenliste. Details im Ratgeber „Ist das vegan?“."],
    ["Brauche ich als Veganer Nahrungsergänzung?", "Vitamin B12 ja, das empfiehlt die DGE ausdrücklich. Weitere Nährstoffe wie Jod, Omega-3 oder Vitamin D hängen von deiner Ernährung ab. Lass dich im Zweifel ärztlich beraten."]];
  const body = `<div class="wrap legal wissen">${cr.html}<div class="eyebrow">Vegan · Ratgeber</div><h1>${esc(H.title)}</h1><p class="lead">${esc(H.lead)}</p>${(H.intro||[]).map(p => `<p>${linkify(p)}</p>`).join("")}
    <ul class="link-list xp-guides">${VEGAN_G.items.map(w => `<li><a href="/wissen/${w.slug}/"><strong>${esc(w.title)}</strong></a><br><span>${esc(w.desc)}</span></li>`).join("")}</ul></div>
    ${vdeals.length ? grid(vdeals, "de", "h2", "Aktuelle vegane Deals") : ""}
    <div class="wrap"><p><a class="more" href="${R.cat.de("vegan")}">Alle veganen Deals</a></p>${faqBlock("de", faq)}${followBox("de")}</div>`;
  layout({lang:"de", single:true, pathFor:() => "/vegan-ratgeber/", title:`${H.title} · perldeals`, description:H.desc, body, ld:[faqLd(faq), {"@context":"https://schema.org", ...cr.ld}]});
}
const wdQ = m => m.category === "earbuds" ? "Sind die" : m.category === "watch" ? "Ist die" : "Ist das";
const WD = fs.existsSync(`${SRC}/data/wasserdicht.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/wasserdicht.json`, "utf8")) : null;
function buildWasserdicht(){
  if (!WD) return;
  const catName = {phone:"Smartphone", watch:"Smartwatch", earbuds:"Kopfhörer"};
  for (const m of WD.items) {
    const path = `/wasserdicht/${m.slug.replace(/-wasserdicht$/, "")}/`;
    m.path = path;
    const cr = crumbs("de", [["Start", R.home.de], ["Wasserdicht?", "/wasserdicht/"], [m.model]]);
    const terms = (m.query || m.model).toLowerCase().split(/\s+/).filter(Boolean);
    const deals = sorted.filter(d => terms.every(t => `${d.title.de} ${d.brand||""}`.toLowerCase().includes(t))).slice(0, 6);
    const faq = [[`${wdQ(m)} ${m.model} wasserdicht?`, m.answer], [`Welche Schutzklasse hat ${m.model}?`, `${m.ip}: ${m.ipMeaning}.`],
      [`Darf ich mit ${m.model} schwimmen oder duschen?`, (m.donts || []).slice(0, 2).join(" ") || "Herstellerhinweise beachten."]];
    const others = WD.items.filter(x => x !== m && x.category === m.category).slice(0, 10);
    const body = `<div class="wrap legal wissen">${cr.html}<div class="eyebrow">${esc(catName[m.category] || "Technik")} · Schutzklasse</div><h1>${wdQ(m)} ${esc(m.model)} wasserdicht?</h1>
      <div class="answer"><h2>Kurze Antwort</h2><p>${esc(m.answer)}</p></div>
      <h2>Schutzklasse ${esc(m.ip)}</h2><p>${esc(m.ip)} bedeutet bei ${esc(m.model)}: ${esc(m.ipMeaning)}.</p>
      ${m.dos && m.dos.length ? `<h2>Das solltest du tun</h2><ul class="checklist">${m.dos.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${m.donts && m.donts.length ? `<h2>Das solltest du lassen</h2><ul class="checklist">${m.donts.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${WD.ipExplainer ? `<h2>Was bedeutet der IP-Code?</h2>${WD.ipExplainer.text.map(p => `<p>${esc(p)}</p>`).join("")}` : ""}
      <h2>Schutz für unterwegs</h2><p>Eine Hülle schützt vor Stürzen, aber nicht vor Wasser. Für Strand, Pool oder Kajak ist eine wasserdichte Handytasche die sichere Wahl.</p>
      <p class="rg-links"><a class="btn btn-ghost" href="${amzSearch((m.query || m.model) + " hülle")}" ${AFF}>Hüllen bei Amazon ansehen <span class="ad-tag">Anzeige</span></a> <a class="more small" href="${amzSearch("wasserdichte handyhülle")}" ${AFF}>Wasserdichte Handytaschen</a></p>
      <h2>Quellen</h2>${srcList2([m.source, m.source2, WD.ipExplainer && WD.ipExplainer.source].filter(Boolean))}
      ${others.length ? `<h2>Weitere Modelle</h2><ul class="link-list">${others.map(x => `<li><a href="/wasserdicht/${x.slug.replace(/-wasserdicht$/, "")}/">${wdQ(x)} ${esc(x.model)} wasserdicht?</a></li>`).join("")}</ul>` : ""}</div>
      ${deals.length ? grid(deals, "de", "h2", `Aktuelle Angebote: ${m.model}`) : ""}
      <div class="wrap">${faqBlock("de", faq)}</div>`;
    layout({lang:"de", single:true, pathFor:() => path, title:`${wdQ(m)} ${m.model} wasserdicht? ${(m.answer.split(/[:,.]/)[0] || "").trim()}, ${m.ip} · perldeals`, description:`${m.model}: ${m.ip}. ${m.answer}`.slice(0, 158), body, type:"article",
      ld:[faqLd(faq), {"@context":"https://schema.org", ...cr.ld}, {"@context":"https://schema.org","@type":"Article","headline":`${wdQ(m)} ${m.model} wasserdicht?`,"inLanguage":"de","dateModified":WD.updated,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`}}]});
  }
  const cr = crumbs("de", [["Start", R.home.de], ["Wasserdicht?"]]);
  const groups = ["phone", "watch", "earbuds"].map(c => [c, WD.items.filter(x => x.category === c)]).filter(([, l]) => l.length);
  const body = `<div class="wrap legal wissen">${cr.html}<div class="eyebrow">Schutzklassen · Stand ${WD.updated.split("-").reverse().join(".")}</div><h1>Ist mein Handy wasserdicht? IP-Schutzklassen aller wichtigen Modelle</h1>
    <p class="lead">Ob du das Handy in der Dusche nutzen darfst oder ein Sturz in den Pool gefährlich ist, hängt von der Schutzklasse ab. Hier steht für jedes Modell, was der Hersteller angibt, mit Quelle.</p>
    ${groups.map(([c, l]) => `<h2>${{phone:"Smartphones", watch:"Smartwatches", earbuds:"Kopfhörer"}[c]}</h2><table class="wd-table"><thead><tr><th>Modell</th><th>Schutzklasse</th></tr></thead><tbody>${l.map(x => `<tr><td><a href="/wasserdicht/${x.slug.replace(/-wasserdicht$/, "")}/">${esc(x.model)}</a></td><td>${esc(x.ip)}</td></tr>`).join("")}</tbody></table>`).join("")}
    ${WD.ipExplainer ? `<h2>Was bedeutet der IP-Code?</h2>${WD.ipExplainer.text.map(p => `<p>${esc(p)}</p>`).join("")}<p class="note">Quelle: <a href="${esc(WD.ipExplainer.source[1])}" rel="nofollow noopener" target="_blank">${esc(WD.ipExplainer.source[0])}</a></p>` : ""}</div>`;
  layout({lang:"de", single:true, pathFor:() => "/wasserdicht/", title:"Ist mein Handy wasserdicht? IP67, IP68 & Co. für alle Modelle · perldeals", description:"Wasserdicht oder nicht? IP-Schutzklassen von Samsung Galaxy, iPhone, Google Pixel, Apple Watch und AirPods laut Hersteller, mit Tipps für Dusche, Pool und Meer.", body, ld:[{"@context":"https://schema.org", ...cr.ld}]});
}
const BFS = fs.existsSync(`${SRC}/data/bf-shops.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/bf-shops.json`, "utf8")) : null;
const BF_OLD = {amazon:"/black-friday-amazon/", otto:"/black-friday-otto/", alternate:"/black-friday-alternate/", notebooksbilliger:"/black-friday-notebooksbilliger/", coolblue:"/black-friday-coolblue/", ebay:"/black-friday-ebay/"};
const bfShopUrl = k => BF_OLD[k] || `/black-friday/${k}/`;
const bfDate = s => s ? new Date(s + "T12:00:00").toLocaleDateString("de-DE", {day:"numeric", month:"long", year:"numeric"}) : null;
function buildBFShops(){
  if (!BFS) return;
  for (const S of BFS.shops) {
    if (BF_OLD[S.key]) continue; // ältere Shop-Seite existiert (hubs.json), keine doppelte Seite
    const path = `/black-friday/${S.key}/`;
    const cr = crumbs("de", [["Start", R.home.de], ["Black Friday", R.bf.de], [S.name]]);
    const deals = sorted.filter(d => (d.shop || "amazon") === (S.key === "amazon" ? "amazon" : S.key)).slice(0, 12);
    const when = S.from ? `${bfDate(S.from)} bis ${bfDate(S.to)}` : "noch nicht offiziell angekündigt";
    const answer = S.from ? `${S.name} hat die Black-Friday-Aktion 2026 angekündigt: ${when}. Black Friday selbst ist am ${bfDate(BFS.blackFriday)}, Cyber Monday am ${bfDate(BFS.cyberMonday)}.`
      : `${S.name} hat die Black-Friday-Aktion 2026 noch nicht offiziell angekündigt. Black Friday ist am ${bfDate(BFS.blackFriday)}, Cyber Monday am ${bfDate(BFS.cyberMonday)}. ${S.lastYear ? "Zum Vergleich: " + S.lastYear : ""}`;
    const faq = [[`Wann ist Black Friday 2026 bei ${S.name}?`, answer], [`Wann ist Cyber Monday 2026?`, `Am Montag, ${bfDate(BFS.cyberMonday)}.`], [`Wie finde ich die besten ${S.name}-Deals?`, `Wir prüfen Angebote gegen den Preisverlauf und sammeln sie hier und im Black-Friday-Hub. Mit dem Deal-Alarm oder unserem WhatsApp-Kanal bekommst du neue Deals sofort.`]];
    const others = BFS.shops.filter(x => x !== S).map(x => `<a class="chip" href="${bfShopUrl(x.key)}">${esc(x.name)}</a>`).join("");
    const body = `<div class="wrap">${cr.html}<div class="article-head"><div class="eyebrow">Black Friday 2026 · ${esc(S.name)}</div><h1>Black Friday 2026 bei ${esc(S.name)}: Termin, Aktionen und Tipps</h1>
      <div class="updated"><span>${S.status === "angekündigt" ? "✅ angekündigt" : "⏳ noch nicht angekündigt"}</span><span>Stand ${bfDate(BFS.updated)}</span></div>
      <div class="answer"><h2>Kurze Antwort</h2><p>${esc(answer)}</p></div></div>
      <section class="section prose-block"><h2>Was bisher bekannt ist</h2><ul class="checklist">${S.facts.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${S.lastYear ? `<h2>So war es 2025</h2><p class="prose">${esc(S.lastYear)}</p>` : ""}
      <h2>Tipps</h2><ul class="checklist">${S.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
      ${subBox("de", "bf-" + S.key)}</div>
      ${deals.length ? grid(deals, "de", "h2", `Aktuelle ${S.name}-Deals`) : ""}
      <div class="wrap">${SHOPS[S.key] || S.key === "amazon" ? `<p><a class="more" href="${R.coupon.de(S.key)}">${esc(S.name)}-Gutscheine</a></p>` : ""}
      <section class="section"><h2>Quellen</h2>${srcList2(S.source)}</section>
      <section class="section"><h2>Black Friday bei anderen Shops</h2><nav class="chips">${others}<a class="chip" href="${R.bf.de}">Alle Black-Friday-Deals</a></nav></section>
      ${faqBlock("de", faq)}</div>`;
    layout({lang:"de", single:true, pathFor:() => path, title:`Black Friday 2026 bei ${S.name}: Termin & Angebote · perldeals`, description:answer.slice(0, 158), body, type:"article", ld:[faqLd(faq), {"@context":"https://schema.org", ...cr.ld}]});
  }
}
function buildBlackFriday(lang){
  const H = HUBS.blackfriday[lang], u = UI[lang], de = lang==="de";
  const cr = crumbs(lang, [[u.home, R.home[lang]], ["Black Friday"]]);
  const top = [...DATA.deals].sort((a,b)=>((b.low?1:0)-(a.low?1:0)) || (pct(b)-pct(a))).slice(0, 9);
  const bf = new Date("2026-11-27T00:00:00+01:00"), today = new Date(DATA.updated);
  const days = Math.max(0, Math.ceil((bf - today) / 86400000));
  const body = `<div class="wrap">${cr.html}
    <div class="article-head"><div class="eyebrow">${esc(H.eyebrow)}</div><h1>${esc(H.h1)}</h1>
      <div class="updated"><span>${de?"Aktualisiert am":"Updated"} ${fmtDay(DATA.updated, lang)}</span>${days?`<span>${de?`Noch ${days} Tage bis Black Friday`:`${days} days to Black Friday`}</span>`:""}</div>
      <div class="answer"><h2>${de?"Kurze Antwort":"Short answer"}</h2><p>${esc(H.answer)}</p></div>
      ${subBox(lang, "blackfriday")}</div>
    ${de && BFS ? `<section class="section"><h2>Black Friday 2026 nach Shop</h2><p class="prose">Black Friday ist am Freitag, 27. November 2026, Cyber Monday am Montag, 30. November 2026. Viele Shops starten schon Anfang November.</p><p class="prose">Für Wiederverkäufer und Sammler: <a href="/reseller/black-friday/">Black Friday 2026 für Reseller (Pokémon, LEGO EOL, Konsolen)</a>.</p><nav class="chips">${BFS.shops.map(x => `<a class="chip" href="${bfShopUrl(x.key)}">${esc(x.name)}${x.status === "angekündigt" ? " ✅" : ""}</a>`).join("")}</nav></section>` : ""}
    ${de ? `<section class="section"><h2>Black Friday nach Kategorie</h2><nav class="chips">${BF_CATS.map(x => `<a class="chip" href="/black-friday/${x[0]}/">${esc(x[1])} <span class="n">${bfDeals(x).length}</span></a>`).join("")}</nav><h3>Black Friday nach Marke</h3><nav class="chips">${bfBrandList().map(x => `<a class="chip" href="/black-friday/${x[0]}/">${esc(x[1])} <span class="n">${bfDeals(x).length}</span></a>`).join("")}</nav></section>` : ""}
    ${de && bfPromos().length ? `<section class="section"><h2>Black-Friday-Aktionen der Shops</h2><ul class="rs-promos">${bfPromos().slice(0,18).map(p => { const k = Object.keys(AWIN_MID).find(x => AWIN_MID[x] === p.mid); return `<li><span class="code-shop">${esc(p.advertiser || (SHOPS[k]||{}).name || "")}</span><h3>${esc(p.title)}</h3>${p.code ? `<p>Code: <code>${esc(p.code)}</code></p>` : ""}${p.end ? `<p><small>bis ${new Date(p.end).toLocaleDateString("de-DE")}</small></p>` : ""}<a class="btn btn-ghost" href="${awinLink(p.mid, p.url || (SHOPS[k]||{}).home || "")}" ${AFF}>Zur Aktion</a></li>`; }).join("")}</ul><p><small>Laut Partnerprogramm (Awin), automatisch aktualisiert. Anzeige.</small></p></section>` : ""}
    <section class="section"><h2>${de?"Checkliste für Black Friday":"Black Friday checklist"}</h2><ul class="checklist">${H.checklist.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>
    <section class="section"><h2>${de?"Die stärksten Deals schon jetzt":"The strongest deals right now"}</h2><ul class="grid">${top.map(d=>card(d, lang)).join("")}</ul></section>
    <section class="section prose-block">${H.sections.map(x=>`<h2>${esc(x[0])}</h2><p class="prose">${esc(x[1])}</p>`).join("")}</section>
    <section class="section"><h2>${de?"Vorab informieren: unsere Bestenlisten":"Get ready: our best lists"}</h2><ul class="link-list">${Object.keys(BEST).map(k=>`<li><a href="${R.best[lang](k)}">${esc(BEST[k][lang].h1.split(":")[0])}</a></li>`).join("")}</ul></section>
    ${faqBlock(lang, H.faq)}
  </div>`;
  const ld = [{"@context":"https://schema.org","@type":"Article","headline":H.h1,"description":H.desc,"inLanguage":lang,"dateModified":DATA.updated.slice(0,10),"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`},"mainEntityOfPage":BASE+R.bf[lang],
    "about":{"@type":"Event","name":"Black Friday 2026","startDate":"2026-11-27","endDate":"2026-11-30","eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode","location":{"@type":"VirtualLocation","url":BASE+R.bf[lang]}}},
    faqLd(H.faq), {"@context":"https://schema.org", ...cr.ld}];
  layout({lang, pathFor:l=>R.bf[l], title:`${H.title} · perldeals`, description:H.desc, body, ld, type:"article", image: fs.existsSync(`${SRC}/assets/og/black-friday.jpg`) ? "/assets/og/black-friday.jpg" : ""});
}

const seasonFilter = f => f && f.startsWith("shop:") ? (d => (d.shop || "amazon") === f.slice(5)) : SEASON_FILTER[f];
const SEASON_FILTER = { top: () => true, tech: d => ["phone","watch","headphones","speaker","tv","computer","smarthome"].includes(d.cat), gift: d => d.now <= 150 };
const ADV = fs.existsSync(`${SRC}/data/adventskalender.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/adventskalender.json`, "utf8")) : null;
if (ADV) ADV.cats = ADV.cats.filter(c => c.items.length >= 2); // zu dünne Themen (z. B. Fitness mit 1 Kalender) nicht als eigene Seite
function buildAdvent(){
  if (!ADV) return;
  const base = "/adventskalender-angebote/";
  for (const c of ADV.cats) {
    const path = `${base}${c.slug}/`;
    const cr = crumbs("de", [["Start", R.home.de], ["Adventskalender 2026", base], [c.h1.split(":")[0]]]);
    const items = c.items.map(it => {
      const shop = it.shopKey && SHOPS[it.shopKey] && AWIN_MID[it.shopKey] ? it.shopKey : null;
      const btns = `${shop ? `<a class="btn btn-ghost" href="${awinLink(AWIN_MID[shop], SHOPS[shop].home)}" ${AFF}>Bei ${esc(SHOPS[shop].name)} ansehen <span class="ad-tag">Anzeige</span></a> ` : ""}<a class="btn btn-ghost" href="${amzSearch(it.query || it.name)}" ${AFF}>Preis bei Amazon ansehen <span class="ad-tag">Anzeige</span></a>`;
      return `<li class="adv-item"><h3>${esc(it.name)}</h3><p class="adv-meta">${it.brand ? esc(it.brand) : ""}${it.uvp ? ` · UVP ${eur(it.uvp, "de")}` : ""}${it.vegan ? " · 🌱 vegan" : ""}</p>${it.contents ? `<p>${esc(it.contents)}</p>` : ""}${it.why ? `<p class="adv-why">${esc(it.why)}</p>` : ""}<p class="rg-links">${btns}</p>${it.source && it.source[1] ? `<p class="adv-src">Quelle: ${esc(it.source[0])}</p>` : ""}</li>`;
    }).join("");
    const re = new RegExp(`adventskalender|advent calendar`, "i");
    const deals = sorted.filter(d => re.test(`${d.title.de} ${d.title.en}`)).slice(0, 12);
    const others = ADV.cats.filter(x => x !== c).map(x => `<a class="chip" href="${base}${x.slug}/">${esc(x.h1.split(":")[0])}</a>`).join("");
    const faq = c.faq || [];
    const body = `<div class="wrap legal wissen">${cr.html}<div class="eyebrow">Adventskalender 2026 · Stand ${ADV.updated.split("-").reverse().join(".")}</div><h1>${esc(c.h1)}</h1>
      ${(c.intro || []).map(p => `<p>${linkify(p)}</p>`).join("")}
      <h2>Die Kalender im Überblick</h2><ul class="adv-list">${items}</ul>
      ${c.tips && c.tips.length ? `<h2>Tipps zum Kauf</h2><ul class="checklist">${c.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p class="note">UVP laut Hersteller bzw. Quelle, aktuelle Preise beim Händler. Ausverkaufte Kalender kommen erfahrungsgemäß kaum nach.</p></div>
      ${deals.length ? grid(deals, "de", "h2", "Adventskalender im Angebot") : ""}
      <div class="wrap"><section class="section"><h2>Weitere Adventskalender</h2><nav class="chips">${others}<a class="chip" href="${base}">Alle Adventskalender-Angebote</a></nav></section>
      ${faq.length ? faqBlock("de", faq) : ""}${followBox("de")}</div>`;
    layout({lang:"de", single:true, pathFor:() => path, title:`${c.title} · perldeals`, description:c.desc, body, type:"article",
      ld:[...(faq.length ? [faqLd(faq)] : []), {"@context":"https://schema.org", ...cr.ld}, {"@context":"https://schema.org","@type":"ItemList","name":c.h1,"itemListElement":c.items.map((it, i) => ({"@type":"ListItem","position":i+1,"name":it.name}))}]});
  }
}
function buildSeason(lang, key){
  const S = HUBS.seasons[key], H = S[lang], u = UI[lang], de = lang==="de";
  const cr = crumbs(lang, [[u.home, R.home[lang]], [H.eyebrow]]);
  const top = sorted.filter(seasonFilter(S.filter)).slice(0, 12);
  const days = Math.max(0, Math.ceil((new Date(S.date+"T00:00:00+01:00") - new Date(DATA.updated)) / 86400000));
  const others = Object.keys(HUBS.seasons).filter(k => k !== key).map(k => `<li><a href="${HUBS.seasons[k].path[lang]}">${esc(HUBS.seasons[k][lang].h1.split(":")[0])}</a></li>`).join("") + `<li><a href="${R.bf[lang]}">Black Friday 2026</a></li><li><a href="${R.gifts[lang]}">${de?"Geschenkefinder":"Gift finder"}</a></li><li><a href="${R.codes[lang]}">${de?"Rabattcodes":"Discount codes"}</a></li>`;
  const body = `<div class="wrap">${cr.html}
    <div class="article-head"><div class="eyebrow">${esc(H.eyebrow)}</div><h1>${esc(H.h1)}</h1>
      <div class="updated"><span>${de?"Aktualisiert am":"Updated"} ${fmtDay(DATA.updated, lang)}</span>${days?`<span>${de?`Noch ${days} Tage`:`${days} days to go`}</span>`:""}</div>
      <div class="answer"><h2>${de?"Kurze Antwort":"Short answer"}</h2><p>${esc(H.answer)}</p></div></div>
    ${de && key === "adventskalender-angebote" && ADV ? `<section class="section"><h2>Adventskalender 2026 nach Thema</h2><nav class="chips">${ADV.cats.map(c => `<a class="chip" href="/adventskalender-angebote/${c.slug}/">${esc(c.h1.split(":")[0].replace(/ Adventskalender 2026| 2026/g, ""))} <span class="n">${c.items.length}</span></a>`).join("")}</nav></section>` : ""}
    <section class="section"><h2>${de?"Checkliste":"Checklist"}</h2><ul class="checklist">${H.checklist.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>
    <section class="section"><h2>${de?"Die stärksten Deals schon jetzt":"The strongest deals right now"}</h2><ul class="grid">${top.map(d=>card(d, lang)).join("")}</ul></section>
    <section class="section prose-block">${H.sections.map(x=>`<h2>${esc(x[0])}</h2><p class="prose">${esc(x[1])}</p>`).join("")}</section>
    ${followBox(lang)}
    ${faqBlock(lang, H.faq)}
    <section class="section"><h2>${de?"Weitere Aktionstage":"More shopping events"}</h2><ul class="link-list">${others}</ul></section>
  </div>`;
  const ld = [{"@context":"https://schema.org","@type":"Article","headline":H.h1,"description":H.desc,"inLanguage":lang,"dateModified":DATA.updated.slice(0,10),"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`},"mainEntityOfPage":BASE+S.path[lang]},
    faqLd(H.faq), {"@context":"https://schema.org", ...cr.ld}];
  layout({lang, pathFor:l=>HUBS.seasons[key].path[l], title:`${H.title} · perldeals`, description:H.desc, body, ld, type:"article", image: fs.existsSync(`${SRC}/assets/og/${key}.jpg`) ? `/assets/og/${key}.jpg` : (fs.existsSync(`${SRC}/assets/og/black-friday.jpg`) ? "/assets/og/black-friday.jpg" : "")});
}

const GIFT_FILTER = {
  "geschenke-unter-25-euro": d => d.now <= 25,
  "geschenke-unter-50-euro": d => d.now <= 50,
  "geschenke-unter-100-euro": d => d.now <= 100,
  "geschenke-fuer-gamer": d => d.cat === "computer" || /gaming|gamer|konsole|controller|playstation|xbox|nintendo|switch|mario|donkey kong|zelda/i.test(d.title.de),
  "geschenke-fuer-kinder": d => d.cat === "toys",
  "technik-geschenke": d => ["phone","watch","headphones","speaker","tv","computer","smarthome"].includes(d.cat) && d.now <= 400
};
const giftFilterOf = id => GIFT_FILTER[id] || (f => d => (!f.cats || f.cats.includes(d.cat) || (f.cats.includes("vegan") && d.vegan)) && (!f.re || new RegExp(f.re, "i").test(`${d.title.de} ${d.brand||""}`)) && (!f.max || d.now <= f.max) && (!f.vegan || d.vegan || d.cat === "vegan"))(HUBS.gifts.pages[id].filter || {});
const giftList = id => DATA.deals.filter(giftFilterOf(id)).filter(d => !["home","garden"].includes(d.cat) || id.startsWith("geschenke-unter")).sort((a,b)=>pct(b)-pct(a)).slice(0, 24);

/* ---------------- discount codes & promotions (src/data/codes.json, refreshed in the daily round) ---------------- */
const CODES = fs.existsSync(`${SRC}/data/codes.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/codes.json`, "utf8")) : [];
const awinLink = (mid, url) => `https://www.awin1.com/cread.php?awinmid=${mid}&awinaffid=2721610&clickref=perldeals-rabatte&ued=${encodeURIComponent(url)}&platform=pl`;
const codeLink = c => AWIN_MID[c.shop] ? awinLink(AWIN_MID[c.shop], c.landing)
  : c.shop === "ebay" ? epn(c.landing, "perldeals-rabatte")
  : c.shop === "amazon" ? `${c.landing}${c.landing.includes("?") ? "&" : "?"}tag=${DATA.amazonTag}` : c.landing;
const TODAY_BERLIN = new Date().toLocaleDateString("sv-SE", {timeZone:"Europe/Berlin"});
// Gutscheine aus der Awin-API ergänzen (max. 3 Codes je Shop insgesamt)
{ const MID2K = Object.fromEntries(Object.entries(AWIN_MID).map(([k,m]) => [m,k]));
  for (const p of AWIN_PROMOS) {
    const k = MID2K[p.mid]; if (!k || !SHOPS[k] || !p.code || !promoActive(p)) continue;
    if (CODES.some(c => c.shop === k && (c.code || "").toUpperCase() === p.code.toUpperCase())) continue;
    if (CODES.filter(c => c.shop === k).length >= 5) continue;
    const vu = p.end ? new Date(p.end).toLocaleDateString("sv-SE", {timeZone:"Europe/Berlin"}) : null;
    CODES.push({shop:k, shopName:SHOPS[k].name, code:p.code, title:{de:p.title, en:p.title}, conditions:{de:p.terms || p.description || "Bedingungen im Shop prüfen.", en:p.terms || p.description || "Check terms in the shop."}, validUntil:vu, landing:p.url || SHOPS[k].home, source:"awin", checked:new Date().toLocaleDateString("sv-SE", {timeZone:"Europe/Berlin"})});
  } }
const activeCodes = () => CODES.filter(c => !c.validUntil || c.validUntil >= TODAY_BERLIN)
  .sort((a,b) => (b.code ? 1 : 0) - (a.code ? 1 : 0) || a.shopName.localeCompare(b.shopName));
function codeCard(c, lang){
  const de = lang==="de", u = UI[lang];
  const fmt = d => new Date(d+"T12:00:00Z").toLocaleDateString(loc[lang], {day:"2-digit", month:"2-digit", year:"numeric"});
  return `<li class="code-card">
    <div class="code-top"><span class="code-shop">${esc(c.shopName)}</span>${c.validUntil ? `<span class="code-until">${de?"bis":"until"} ${fmt(c.validUntil)}</span>` : `<span class="code-until">${de?"aktuell gültig":"currently valid"}</span>`}</div>
    <h3>${esc(c.title[lang])}</h3>
    ${c.code ? `<div class="code-box"><code>${esc(c.code)}</code><button class="btn" type="button" data-code="${esc(c.code)}">${de?"Kopieren":"Copy"}</button></div>` : `<div class="code-box code-none">${de?"Kein Code nötig":"No code needed"}</div>`}
    <p class="code-cond">${esc(c.conditions[lang])}</p>
    <div class="code-foot"><a class="btn btn-primary" href="${esc(codeLink(c))}" target="_blank" rel="sponsored noopener">${de?"Zum Shop":"Go to shop"} <span class="ad-tag">${u.ad}</span></a><span class="code-checked">${de?"Geprüft am":"Checked on"} ${fmt(c.checked)} · ${c.source==="awin" ? (de?"Offizieller Partner-Code":"Official partner code") : `<a href="${esc(c.source)}" target="_blank" rel="noopener nofollow">${de?"Quelle":"Source"}</a>`}</span></div>
  </li>`;
}
// shops with a coupon page: every shop that has active codes or current deals
const couponShops = () => { const m = new Map();
  activeCodes().forEach(c => m.set(c.shop, c.shopName));
  DATA.deals.forEach(d => { const k = d.shop || "amazon"; if (!m.has(k)) m.set(k, shopName(d)); });
  for (const [k, mid] of Object.entries(AWIN_MID)) if (!m.has(k) && SHOPS[k] && AWIN_PROMOS.some(p => p.mid === mid && promoActive(p))) m.set(k, SHOPS[k].name);
  return [...m].map(([k, name]) => ({k, name})); };
function buildCoupon(lang, k, name){
  const de = lang==="de", u = UI[lang];
  const codes = activeCodes().filter(c => c.shop === k);
  const deals = sorted.filter(d => (d.shop || "amazon") === k);
  const month = new Date(DATA.updated).toLocaleDateString(loc[lang], {month:"long", year:"numeric"});
  const best = deals.reduce((m, d) => Math.max(m, pct(d)), 0);
  const newCust = codes.find(c => /neukund|new customer|erstbestell|first order/i.test(c.title.de + c.conditions.de));
  const h1 = de ? `${name} Gutschein & Rabattcode ${month}` : `${name} voucher & discount code ${month}`;
  const cr = crumbs(lang, [[u.home, R.home[lang]], [de?"Rabatte":"Discounts", R.codes[lang]], [de?`${name} Gutschein`:`${name} voucher`]]);
  const intro = de
    ? `${codes.length ? `Aktuell haben wir ${codes.length} ${codes.length===1?"geprüften Gutschein bzw. eine Aktion":"geprüfte Gutscheine und Aktionen"} für ${name}.` : `Gerade kennen wir keinen gültigen ${name}-Gutscheincode.`} ${deals.length ? `Dazu kommen ${deals.length} reduzierte ${name}-Angebote mit bis zu ${best} % Rabatt, die wir mit dem Vorpreis vergleichen.` : ""} Jeder Code hat ein Prüfdatum und eine Quelle, abgelaufene Codes entfernen wir automatisch.`
    : `${codes.length ? `We currently list ${codes.length} checked ${codes.length===1?"voucher or offer":"vouchers and offers"} for ${name}.` : `We currently know of no valid ${name} voucher code.`} ${deals.length ? `Plus ${deals.length} discounted ${name} deals with up to ${best}% off, compared with the previous price.` : ""} Every code has a check date and a source; expired codes are removed automatically.`;
  const faq = de ? [
    [`Gibt es einen ${name} Gutschein für Neukunden?`, newCust ? `Ja: ${newCust.title.de}. Bedingungen: ${newCust.conditions.de}` : `Einen speziellen Neukunden-Gutschein für ${name} haben wir gerade nicht gefunden. Sobald es einen gibt, steht er hier.`],
    [`Wie löse ich einen ${name} Gutschein ein?`, `Code kopieren, über den Button zum Shop gehen und den Code im Warenkorb oder an der Kasse in das Gutscheinfeld einfügen. Aktionen ohne Code gelten automatisch. Mindestbestellwert und ausgeschlossene Artikel stehen bei jedem Eintrag.`],
    [`Lohnt sich ${name} ohne Gutschein?`, deals.length ? `Ja, oft schon: Gerade sind ${deals.length} Angebote reduziert, das stärkste mit ${best} % Rabatt. Wir zeigen sie unten mit Preis und Vorpreis.` : `Gerade haben wir keine geprüften Angebote von ${name}. Schau bald wieder vorbei oder stell dir einen Preisalarm ein.`],
    [`Warum funktioniert mein ${name} Gutschein nicht?`, `Meist liegt es an den Bedingungen: Mindestbestellwert nicht erreicht, Code nur für Neukunden oder die App, ausgeschlossene Marken oder reduzierte Ware, abgelaufener Zeitraum oder ein Tippfehler (Leerzeichen beim Kopieren). Oft lässt sich auch nur ein Code pro Bestellung nutzen. Die Bedingungen stehen bei jedem Eintrag oben.`],
    [`Kann ich ${name} Gutschein und Cashback kombinieren?`, `Das legt das Cashback-Portal fest. Viele Portale zahlen kein Cashback, wenn ein Code von einer anderen Gutscheinseite genutzt wird. Prüfe vor dem Kauf die Bedingungen des Portals. Aktionen ohne Code sind meist unproblematisch.`]
  ] : [
    [`Is there a ${name} voucher for new customers?`, newCust ? `Yes: ${newCust.title.en}. Conditions: ${newCust.conditions.en}` : `We have not found a specific new-customer voucher for ${name} right now. Once there is one, it appears here.`],
    [`How do I redeem a ${name} voucher?`, `Copy the code, go to the shop via the button and paste it into the voucher field in the basket or at checkout. Offers without a code apply automatically. Minimum order values and exclusions are listed with each entry.`],
    [`Is ${name} worth it without a voucher?`, deals.length ? `Often yes: ${deals.length} offers are discounted right now, the best one by ${best}%. They are listed below with price and previous price.` : `We have no checked ${name} deals right now. Check back soon or set a price alert.`]
  ];
  const others = couponShops().filter(x => x.k !== k).map(x => `<a class="chip" href="${R.coupon[lang](x.k)}">${esc(x.name)}</a>`).join("");
  const body = `<div class="wrap">${cr.html}
    <div class="article-head"><div class="eyebrow">${de?"Gutscheine · geprüft":"Vouchers · checked"}</div><h1>${esc(h1)}</h1>
      <div class="updated"><span>${codes.length} ${de?"Codes und Aktionen":"codes and offers"}</span><span>${deals.length} ${de?"Angebote":"deals"}</span><span>${de?"Stand":"As of"} ${fmtDay(DATA.updated, lang)}</span></div>
      ${de ? `<div class="answer"><h2>Kurze Antwort</h2><p>${esc(codes.length ? `Ja, für ${name} gibt es gerade ${codes.length === 1 ? "einen geprüften Gutschein bzw. eine Aktion" : codes.length + " geprüfte Gutscheine und Aktionen"}: ${codes.slice(0, 2).map(c => c.title.de).join(" · ")}. Bedingungen und Enddatum stehen beim jeweiligen Code.` : `Gerade gibt es keinen gültigen ${name}-Gutscheincode, den wir geprüft haben.${deals.length ? ` Dafür sind ${deals.length} Angebote reduziert, bis zu ${best} %.` : ""} Mit dem Gutschein-Alarm bekommst du neue Codes per E-Mail.`)}</p></div>` : ""}
      <p class="prose">${esc(intro)}</p></div>
    ${codes.length ? `<ul class="codes">${codes.map(c => codeCard(c, lang)).join("")}</ul>` : ""}
    </div>
    ${de ? `<div class="wrap">${codeAlarmBox("de", [k], "gutschein-" + k)}</div>` : ""}
    ${shopPromos(lang, k)}
    ${deals.length ? grid(deals.slice(0, 24), lang, "h2", de ? `Aktuelle ${name}-Angebote` : `Current ${name} deals`) : ""}
    <div class="wrap">
    ${SHOPS[k] ? `<p class="prose"><a class="more" href="${R.shop[lang](k)}">${de?`Alle ${deals.length} ${name}-Angebote`:`All ${deals.length} ${name} deals`}</a></p>` : ""}
    ${followBox(lang)}
    ${faqBlock(lang, faq)}
    <section class="section"><h2>${de?"Gutscheine anderer Shops":"Vouchers for other shops"}</h2><div class="chips">${others}</div></section>
  </div>`;
  const ld = [faqLd(faq), {"@context":"https://schema.org", ...cr.ld}];
  layout({lang, pathFor:l=>R.coupon[l](k), title:`${h1} · perldeals`, description: de ? `${name} Gutschein ${month}: ${codes.length} geprüfte Codes und Aktionen${deals.length?`, ${deals.length} Angebote mit bis zu ${best} % Rabatt`:""}. Mit Bedingungen und Prüfdatum.` : `${name} voucher ${month}: ${codes.length} checked codes and offers${deals.length?`, ${deals.length} deals with up to ${best}% off`:""}. With conditions and check date.`, body, ld});
}

/* Gutschein-Alarm (Nico 05.11.): neue Codes je Shop per Mail (kind "codes" in /api/subscribe.php, Versand in cron.php aus /data/codes-live.json) */
const codeId = c => `${c.shop}:${(c.code || "").toLowerCase()}:${String(c.title.de || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
const codeAlarmBox = (lang, pre = [], source = "codes") => {
  const de = lang === "de";
  const shops = couponShops().slice().sort((a, b) => a.name.localeCompare(b.name, "de"));
  return `<form class="sub rs-alarm code-alarm" id="gutschein-alarm" data-sub data-kind="codes" data-source="${source}" novalidate>
  <div class="sub-head"><strong>🎟️ ${de ? "Gutschein-Alarm" : "Voucher alert"}</strong><span>${de ? "Neue Rabattcodes und Aktionen deiner Lieblingsshops per E-Mail. Höchstens eine Mail alle 6 Stunden, kostenlos, jederzeit abbestellbar." : "New discount codes and offers from your favourite shops by email. At most one email every 6 hours, free, cancel anytime."}</span></div>
  <fieldset class="rs-topics code-shops"><legend>${de ? "Deine Shops" : "Your shops"}</legend>
    <label class="cs-all"><input type="checkbox" name="topics" value="all"${pre.length ? "" : " checked"}> ⭐ ${de ? "Alle Shops" : "All shops"}</label>
    ${shops.map(x => `<label><input type="checkbox" name="topics" value="${x.k}"${pre.includes(x.k) ? " checked" : ""}> ${esc(x.name)}</label>`).join("")}
  </fieldset>
  <div class="sub-row"><input type="email" name="email" required autocomplete="email" placeholder="${de ? "Deine E-Mail-Adresse" : "Your email address"}" aria-label="E-Mail"><input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><button class="btn btn-primary" type="submit">${de ? "Alarm aktivieren" : "Activate alert"}</button></div>
  <p class="sub-legal">${de ? `Mit Bestätigungs-E-Mail (Double-Opt-in), jederzeit abbestellbar. <a href="${R.privacy[lang]}">Datenschutz</a>` : `Double opt-in, cancel anytime. <a href="${R.privacy[lang]}">Privacy</a>`}</p>
  <p class="sub-msg" role="status" aria-live="polite"></p>
</form>`;
};
function buildCodeAlarm(){
  const cr = crumbs("de", [["Start", R.home.de], ["Rabatte", R.codes.de], ["Gutschein-Alarm"]]);
  const n = activeCodes().length;
  const faq = [
    ["Was ist der Gutschein-Alarm?", "Du wählst deine Lieblingsshops aus und bekommst eine E-Mail, sobald wir für einen davon einen neuen Rabattcode oder eine neue Aktion finden. Die Codes stammen aus den Partnerprogrammen der Shops und aus unserer eigenen Prüfung."],
    ["Wie oft bekomme ich E-Mails?", "Höchstens eine E-Mail alle 6 Stunden, mit allen neuen Gutscheinen gesammelt. Gibt es nichts Neues, kommt auch keine Mail."],
    ["Kostet der Gutschein-Alarm etwas?", "Nein. Wir finanzieren uns über Partnerlinks: Kaufst du über einen Link, bekommen wir eine kleine Provision, für dich bleibt der Preis gleich."],
    ["Wie melde ich mich ab?", "In jeder E-Mail steht ein Abmeldelink, ein Klick genügt. Deine Shop-Auswahl kannst du ändern, indem du dich hier einfach erneut einträgst."],
    ["Warum funktioniert ein Gutschein manchmal nicht?", "Häufige Gründe sind Mindestbestellwert, Neukunden-Bedingung, ausgeschlossene Marken oder ein abgelaufener Zeitraum. Die Bedingungen stehen bei jedem Gutschein in der Mail und auf der Gutscheinseite des Shops."]
  ];
  const body = `<div class="wrap legal">${cr.html}<div class="eyebrow">Rabatte · kostenlos</div><h1>Gutschein-Alarm: neue Rabattcodes deiner Lieblingsshops per E-Mail</h1>
    <p class="lead">Gutscheine sind oft nur ein paar Tage gültig. Mit dem Gutschein-Alarm bekommst du neue Codes und Aktionen für die Shops, die dich interessieren, direkt ins Postfach. Gerade kennen wir ${n} aktive Codes und Aktionen.</p>
    ${codeAlarmBox("de", [], "gutschein-alarm")}
    <h2>So funktioniert es</h2><ol class="ak-steps"><li><strong>Shops wählen:</strong> „Alle Shops“ oder nur deine Favoriten.</li><li><strong>E-Mail bestätigen:</strong> Du bekommst einen Bestätigungslink, erst danach schicken wir etwas.</li><li><strong>Sparen:</strong> Neue Codes kommen gesammelt per Mail, mit Bedingungen und Enddatum.</li></ol>
    <p><a class="more" href="${R.codes.de}">Alle aktuellen Gutscheine ansehen</a></p>
    ${faqBlock("de", faq)}
  </div>`;
  layout({lang:"de", single:true, pathFor:() => "/gutschein-alarm/", title:"Gutschein-Alarm: neue Rabattcodes per E-Mail · perldeals", description:`Neue Gutscheine und Rabattcodes deiner Lieblingsshops automatisch per E-Mail: OTTO, Alternate, Coolblue, notebooksbilliger und viele mehr. Kostenlos, jederzeit abbestellbar.`, body, ld:[faqLd(faq), {"@context":"https://schema.org", ...cr.ld}]});
}
function buildCodes(lang){
  const de = lang==="de", u = UI[lang], list = activeCodes();
  const cr = crumbs(lang, [[u.home, R.home[lang]], [de?"Rabatte":"Discounts"]]);
  const fmt = d => new Date(d+"T12:00:00Z").toLocaleDateString(loc[lang], {day:"2-digit", month:"2-digit", year:"numeric"});
  const shops = [...new Map(list.map(c => [c.shopName.toLowerCase().replace(/[^a-z0-9]/g,""), c.shopName])).values()];
  const items = list.map(c => codeCard(c, lang)).join("");
  const h1 = de ? "Rabattcodes und Gutscheine: aktuelle Aktionen unserer Partnershops" : "Discount codes and vouchers: current offers from our partner shops";
  const intro = de
    ? `Hier sammeln wir gültige Rabattcodes, Neukunden-Rabatte und Aktionen von ${shops.join(", ")}. Jeder Eintrag hat eine Quelle und ein Prüfdatum. Wir aktualisieren die Liste regelmäßig und entfernen abgelaufene Codes automatisch. Bitte beachte die Bedingungen des Shops, denn manche Codes gelten nur für Neukunden oder ab einem Mindestbestellwert.`
    : `Valid discount codes, new-customer offers and promotions from ${shops.join(", ")}. Every entry has a source and a check date. We refresh the list regularly and remove expired codes automatically. Please check the shop's conditions: some codes only apply to new customers or above a minimum order value.`;
  const faq = de ? [
    ["Warum funktioniert ein Rabattcode nicht?", "Häufige Gründe sind ein Mindestbestellwert, ausgeschlossene Marken oder Kategorien, ein Code nur für Neukunden oder ein bereits abgelaufener Aktionszeitraum. Die Bedingungen stehen bei jedem Eintrag."],
    ["Kann ich mehrere Gutscheine kombinieren?", "Meist nicht. Die meisten Shops erlauben nur einen Aktionsgutschein pro Bestellung. Reduzierte Preise und ein Code lassen sich aber oft kombinieren."],
    ["Wie oft wird die Liste aktualisiert?", "Wir prüfen die Aktionen regelmäßig, abgelaufene Einträge verschwinden automatisch am Tag nach dem Enddatum."]
  ] : [
    ["Why does a discount code not work?", "Common reasons are a minimum order value, excluded brands or categories, a code for new customers only, or an expired promotion. The conditions are listed with every entry."],
    ["Can I combine several vouchers?", "Usually not. Most shops allow only one promo voucher per order. Reduced prices and a code can often be combined, though."],
    ["How often is the list updated?", "We check the promotions regularly; expired entries disappear automatically the day after their end date."]
  ];
  const body = `<div class="wrap">${cr.html}
    <div class="article-head"><div class="eyebrow">${de?"Rabatte · Bonus für dich":"Discounts · a bonus for you"}</div><h1>${esc(h1)}</h1>
      <div class="updated"><span>${list.length} ${de?"aktive Codes und Aktionen":"active codes and offers"}</span></div>
      <p class="prose">${esc(intro)}</p>
      <div class="chips">${couponShops().map(x => `<a class="chip" href="${R.coupon[lang](x.k)}">${esc(x.name)} ${de?"Gutschein":"voucher"}</a>`).join("")}</div></div>
    ${list.length ? `<ul class="codes">${items}</ul>` : `<p class="prose">${de?"Gerade keine aktiven Codes. Schau bald wieder vorbei.":"No active codes right now. Check back soon."}</p>`}
    ${de ? codeAlarmBox("de", [], "rabatte") : ""}
    ${followBox(lang)}
    ${faqBlock(lang, faq)}
  </div>`;
  const ld = [faqLd(faq), {"@context":"https://schema.org", ...cr.ld}];
  layout({lang, pathFor:l=>R.codes[l], title:`${de?"Rabattcodes & Gutscheine":"Discount codes & vouchers"} · perldeals`, description: de ? `${list.length} geprüfte Rabattcodes und Aktionen von ${shops.slice(0,5).join(", ")} und mehr. Mit Bedingungen, Enddatum und Quelle.` : `${list.length} checked discount codes and offers from ${shops.slice(0,5).join(", ")} and more, with conditions, end date and source.`, body, ld});
}

function buildGifts(lang){
  const G = HUBS.gifts, h = G.hub[lang], u = UI[lang], de = lang==="de";
  const cr = crumbs(lang, [[u.home, R.home[lang]], [de?"Geschenke":"Gifts"]]);
  const tiles = Object.keys(G.pages).map(id => { const p = G.pages[id][lang], n = giftList(id).length;
    return `<li><a class="gift-tile" href="${R.gift[lang](id)}"><strong>${esc(p.h1.split(":")[0])}</strong><span>${n} ${de?"Angebote":"deals"}</span></a></li>`; }).join("");
  const body = `<div class="wrap">${cr.html}
    <div class="article-head"><div class="eyebrow">${esc(h.eyebrow)}</div><h1>${esc(h.h1)}</h1>
      <div class="answer"><h2>${de?"Kurze Antwort":"Short answer"}</h2><p>${esc(h.answer)}</p></div><p class="prose">${esc(h.intro)}</p></div>
    <section class="section"><h2>${de?"Geschenke finden nach Budget und Person":"Find gifts by budget and person"}</h2><ul class="gift-tiles">${tiles}</ul></section>
    <section class="section"><h2>${de?"Beliebte Geschenk-Deals":"Popular gift deals"}</h2><ul class="grid">${giftList("geschenke-unter-50-euro").slice(0,6).map(d=>card(d, lang)).join("")}</ul></section>
    ${faqBlock(lang, h.faq)}
  </div>`;
  layout({lang, pathFor:l=>R.gifts[l], title:`${h.title} · perldeals`, description:h.desc, body, ld:[faqLd(h.faq), {"@context":"https://schema.org", ...cr.ld}], image: fs.existsSync(`${SRC}/assets/og/geschenke.jpg`) ? "/assets/og/geschenke.jpg" : ""});
}

function buildGift(lang, id){
  const P = HUBS.gifts.pages[id], p = P[lang], u = UI[lang], de = lang==="de";
  const list = giftList(id);
  const cr = crumbs(lang, [[u.home, R.home[lang]], [de?"Geschenke":"Gifts", R.gifts[lang]], [p.h1.split(":")[0]]]);
  const others = Object.keys(HUBS.gifts.pages).filter(k=>k!==id).map(k=>`<li><a href="${R.gift[lang](k)}">${esc(HUBS.gifts.pages[k][lang].h1.split(":")[0])}</a></li>`).join("");
  const body = `<div class="wrap">${cr.html}
    <div class="article-head"><div class="eyebrow">${de?"Geschenkfinder":"Gift finder"}</div><h1>${esc(p.h1)}</h1>
      <div class="updated"><span>${u.priceAt} ${STAMP(lang)}</span><span>${list.length} ${de?"Angebote":"deals"}</span></div>
      <p class="prose">${esc(p.intro)}</p></div>
    ${list.length ? `<ul class="grid">${list.map(d=>card(d, lang)).join("")}</ul>` : `<p class="prose">${de?"Gerade keine passenden Angebote. Schau morgen wieder vorbei oder stell dir einen Preisalarm.":"No matching deals right now. Check back tomorrow or set a price alert."}</p>`}
    <section class="section prose-block"><h2>${de?"Tipps zum Schenken":"Gift tips"}</h2>${p.tips.map(x=>`<h3>${esc(x[0])}</h3><p class="prose">${esc(x[1])}</p>`).join("")}</section>
    ${p.faq ? `<section class="section faq"><h2>${de?"Häufige Fragen":"FAQ"}</h2>${p.faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>` : ""}
    <section class="section"><h2>${de?"Weitere Geschenkideen":"More gift ideas"}</h2><ul class="link-list">${others}</ul></section>
  </div>`;
  const ld = [...(p.faq ? [faqLd(p.faq)] : []), {"@context":"https://schema.org","@type":"ItemList","name":p.h1,"numberOfItems":list.length,"itemListElement":list.map((d,i)=>({"@type":"ListItem","position":i+1,"url":BASE+R.deal[lang](d.id),"name":d.title[lang]}))},{"@context":"https://schema.org", ...cr.ld}];
  layout({lang, pathFor:l=>R.gift[l](id), title:`${p.title} · perldeals`, description:p.desc, body, ld, image: fs.existsSync(`${SRC}/assets/og/${id}.jpg`) ? `/assets/og/${id}.jpg` : ""});
}

function buildAdvisor(lang){
  const de = lang==="de", u = UI[lang];
  const h1 = de ? "KI-Kaufberater: Sag uns, was du suchst" : "AI shopping advisor: tell us what you need";
  const lead = de ? "Beschreib in einem Satz, was du brauchst und wie viel du ausgeben willst. Der Berater sucht in unseren aktuellen Deals, Bestenlisten und Kaufberatungen die passenden Antworten." : "Describe in one sentence what you need and your budget. The advisor searches our current deals, best lists and buying guides for the right answers.";
  const ex = de ? ["Mähroboter für 600 m² unter 700 €","Noise Cancelling Kopfhörer unter 100 €","Geschenk für Kinder unter 30 €","Welcher Saugroboter für Tierhaare?","Gaming Monitor für PS5"] : ["Robot mower for 600 m² under €700","Noise cancelling headphones under €100","Gift for kids under €30","Which robot vacuum for pet hair?","Gaming monitor for PS5"];
  const cr = crumbs(lang, [[u.home, R.home[lang]], [de?"KI-Berater":"AI advisor"]]);
  const body = `<div class="wrap">${cr.html}
    <div class="article-head"><div class="eyebrow">✨ ${de?"Kaufberater":"Shopping advisor"}</div><h1>${h1}</h1><p class="lead">${lead}</p></div>
    <form id="adv-form" class="adv-form" role="search">
      <label class="sr-only" for="adv-q">${de?"Deine Frage":"Your question"}</label>
      <textarea id="adv-q" rows="2" maxlength="300" placeholder="${esc(ex[0])}"></textarea>
      <button class="btn btn-primary" type="submit">${de?"Berater fragen":"Ask the advisor"}</button>
    </form>
    <div class="adv-examples">${ex.map(x=>`<button type="button" class="chip" data-adv="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    <div id="adv-out" class="adv-out" aria-live="polite"></div>
    <p class="stamp" style="margin-top:28px">${de?`Der Berater nutzt nur Inhalte von perldeals. Gib bitte keine persönlichen Daten ein. Mehr in der <a href="${R.privacy.de}">Datenschutzerklärung</a>.`:`The advisor only uses perldeals content. Please do not enter personal data. More in the <a href="${R.privacy.en}">privacy policy</a>.`}</p>
  </div>`;
  layout({lang, image:"/assets/og/berater.jpg", pathFor:l=>R.advisor[l], title:`${h1} · perldeals`, description:lead.slice(0,155), body, scripts:["berater.js"], ld:[{"@context":"https://schema.org", ...cr.ld}]});
}

function buildGuideIndex(lang){
  const u = UI[lang];
  const ids = Object.keys(GUIDES).filter(id => DATA.deals.some(d => d.id === id));
  const h = lang==="de" ? "Kaufberatung: Lohnt sich das?" : "Buying guides: is it worth it?";
  const intro = lang==="de" ? "Zu Produkten, die gerade im Angebot sind, beantworten wir die wichtigste Frage zuerst: Lohnt sich der Kauf? Mit Vor- und Nachteilen, technischen Daten, Alternativen und Quellen." : "For products currently on sale we answer the key question first: is it worth buying? With pros and cons, specs, alternatives and sources.";
  const cr = crumbs(lang, [[u.home, R.home[lang]], [lang==="de"?"Kaufberatung":"Buying guides"]]);
  const items = ids.map(id => { const d = DATA.deals.find(x=>x.id===id), g = GUIDES[id][lang];
    return `<li class="card"><a class="visual" href="${R.guide[lang](id)}" tabindex="-1" aria-hidden="true">${pic(d,64)}<span class="brand">${esc(d.brand)}</span>${discBadge(d)}</a>
      <div class="card-body"><div class="meta"><span>${esc(g.eyebrow)}</span></div><h3><a href="${R.guide[lang](id)}">${esc(g.h1)}</a></h3><p class="note">${esc(g.answer.split(". ")[0])}.</p>
      <div class="card-foot"><a class="btn btn-ghost" href="${R.guide[lang](id)}">${lang==="de"?"Kaufberatung lesen":"Read the guide"}</a></div></div></li>`; }).join("");
  const ld = [{"@context":"https://schema.org","@type":"CollectionPage","name":h,"inLanguage":lang,"hasPart":[...Object.keys(ARTICLES).map(k=>({"@type":"Article","headline":ARTICLES[k][lang].h1,"url":BASE+R.article[lang](k)})), ...ids.map(id=>({"@type":"Article","headline":GUIDES[id][lang].h1,"url":BASE+R.guide[lang](id)}))]},{"@context":"https://schema.org", ...cr.ld}];
  const arts = Object.keys(ARTICLES).filter(k => ARTICLES[k].picks.filter(id => DATA.deals.some(d => d.id === id)).length >= 2);
  const artItems = arts.map(k => { const a = ARTICLES[k][lang], d = DATA.deals.find(x => ARTICLES[k].picks.includes(x.id));
    return `<li class="card"><a class="visual" href="${R.article[lang](k)}" tabindex="-1" aria-hidden="true">${pic(d,64)}<span class="brand">${esc(a.eyebrow)}</span></a>
      <div class="card-body"><div class="meta"><span>${esc(a.eyebrow)}</span></div><h3><a href="${R.article[lang](k)}">${esc(a.h1)}</a></h3><p class="note">${esc(a.answer.split(". ")[0])}.</p>
      <div class="card-foot"><a class="btn btn-ghost" href="${R.article[lang](k)}">${lang==="de"?"Vergleich lesen":"Read the comparison"}</a></div></div></li>`; }).join("");
  const body = `<div class="wrap">${cr.html}<div class="feed-head" style="display:block"><h1>${h}</h1><p class="lead">${intro}</p></div>
    ${artItems?`<section class="section"><h2>${lang==="de"?"Vergleiche und Bestenlisten":"Comparisons and best-of lists"}</h2><ul class="grid">${artItems}</ul></section>`:""}
    <section class="section"><h2>${lang==="de"?"Einzelne Produkte: lohnt sich das?":"Single products: is it worth it?"}</h2><ul class="grid">${items}</ul></section></div>`;
  layout({lang, image:"/assets/og/kaufberatung.jpg", pathFor:l=>R.guides[l], title:`${h} · perldeals`, description:intro, body, ld});
}

// Berlin wall-clock time -> Date (handles summer/winter time)
function berlinDate(ymd, hh, mm){
  const guess = new Date(`${ymd}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00Z`);
  const local = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (local - utc));
}
const dealScore = d => pct(d) + (d.low ? 10 : 0);
const WA_PHONE = "+491726925327";
function buildWhatsapp(){
  const vcf = ["BEGIN:VCARD","VERSION:3.0","N:;perldeals;;;","FN:perldeals Deals","ORG:perldeals","TEL;TYPE=CELL,VOICE:"+WA_PHONE,"EMAIL:kontakt@perldeals.com","URL:https://perldeals.com","NOTE:Täglich geprüfte Deals im WhatsApp-Status. Speichern und Status ansehen!","END:VCARD",""].join("\r\n");
  fs.writeFileSync(`${OUT}/perldeals.vcf`, vcf);
  const waIcon = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>`;
  const userIcon = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4 0-8 2-8 5v2h11.3a6 6 0 0 1 .4-6.4A12 12 0 0 0 12 14Zm6 1v2.5h-2.5v2H18V22h2v-2.5h2.5v-2H20V15h-2Z"/></svg>`;
  const body = `<div class="wrap wa-page">
    <div class="wa-hero"><div class="wa-pearl" aria-hidden="true"></div>
      <div class="eyebrow">perldeals auf WhatsApp</div>
      <h1>Die besten Deals direkt aufs Handy</h1>
      <p class="lead">Täglich geprüfte Schnäppchen von Amazon, eBay, OTTO, Alternate und Co., ohne Fake-Rabatte und ohne Spam. Kostenlos.</p></div>
    <div class="wa-steps">
      <a class="wa-btn wa-btn-follow" href="${SOCIAL.wa}" rel="noopener">${waIcon}<span><strong>WhatsApp-Kanal folgen</strong><small>Jeder neue Top-Deal kommt als Nachricht</small></span></a>
      <a class="wa-btn wa-btn-contact" href="/perldeals.vcf" download="perldeals.vcf">${userIcon}<span><strong>perldeals als Kontakt speichern</strong><small>Dann siehst du unseren Status mit den Tagesdeals</small></span></a>
    </div>
    <ol class="wa-how">
      <li><strong>Kanal folgen:</strong> Tippe auf den grünen Button und dann in WhatsApp auf „Folgen“. Du kannst jederzeit wieder entfolgen, deine Nummer bleibt für andere unsichtbar.</li>
      <li><strong>Kontakt speichern:</strong> Tippe auf den zweiten Button und dann auf „Kontakt hinzufügen“ bzw. „Neuen Kontakt erstellen“. Im WhatsApp-Status siehst du dann jeden Tag die besten Deals.</li>
      <li><strong>Frage zu einem Deal?</strong> <a href="https://wa.me/${WA_PHONE.slice(1)}?text=${encodeURIComponent("Hallo perldeals, ich komme von perldeals.com 👋")}" rel="noopener">Schreib uns einfach auf WhatsApp</a>.</li>
    </ol>
    <p class="wa-note">Lieber Telegram? <a href="${SOCIAL.tg}" rel="noopener">t.me/perldeals</a> · Alle Deals mit Preisverlauf: <a href="/">perldeals.com</a></p>
  </div>`;
  layout({lang:"de", pathFor:l=>"/whatsapp/", title:"Deals auf WhatsApp: Kanal folgen · perldeals", description:"Folge dem perldeals WhatsApp-Kanal und speichere perldeals als Kontakt: täglich geprüfte Deals und Schnäppchen direkt aufs Handy, kostenlos und ohne Spam.", body});
  layout({lang:"de", single:true, pathFor:()=>"/telegram/", title:"Deals auf Telegram: Kanal folgen · perldeals", description:"Folge dem perldeals Telegram-Kanal: die stärksten geprüften Deals und jeden Morgen die Perlen des Tages direkt aufs Handy. Kostenlos.",
    body:`<div class="wrap legal"><div class="eyebrow">Telegram</div><h1>perldeals auf Telegram</h1><p class="lead">Jeden Morgen die „Perlen des Tages“ und neue Top-Deals ab 20 % Ersparnis – geprüft gegen den Preisverlauf, direkt aufs Handy.</p><p><a class="btn btn-primary" href="${SOCIAL.tg}" rel="noopener">Telegram-Kanal öffnen</a></p><p>Lieber WhatsApp? <a href="/whatsapp/">Zum WhatsApp-Kanal</a></p></div>`});
}
/* ---------------- Themen- und Marken-Seiten (SEO, nur DE) ----------------
   /angebote/<slug>/ aus src/data/topics.json, /marke/<slug>/ automatisch aus Deals + Archiv.
   Indexiert nur mit mindestens 2 (Themen) bzw. 1 (Marken) aktuellen Deal, sonst noindex. */
const TOPICS = fs.existsSync(`${SRC}/data/topics.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/topics.json`, "utf8")) : [];
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const NOW_D = new Date(DATA.updated); const MONTH_DE = `${MONTHS_DE[NOW_D.getMonth()]} ${NOW_D.getFullYear()}`;
const slugify = s => s.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const topicMatch = (T, d) => {
  const txt = `${d.title.de} ${d.brand||""}`;
  if (!new RegExp(T.re, "i").test(txt)) return false;
  if (T.not && new RegExp(T.not, "i").test(txt)) return false;
  if (T.cat && d.cat !== T.cat) return false;
  if (T.vegan && !(d.vegan || d.cat === "vegan")) return false;
  if (T.max && !(d.now <= T.max)) return false;
  if (T.minPct && !(pct(d) >= T.minPct)) return false;
  return true;
};
const TOPIC_PATH = slug => `/angebote/${slug}/`;
const TOPIC_LIVE = Object.fromEntries(TOPICS.map(T => [T.slug, sorted.filter(d => topicMatch(T, d))]));
const TOPIC_OLD = Object.fromEntries(TOPICS.map(T => [T.slug, EXPIRED.filter(a => a.now && a.was && topicMatch(T, a)).sort((a,b)=>String(b.added).localeCompare(String(a.added)))]));
const topicIndexed = T => TOPIC_LIVE[T.slug].length >= 2 || (Array.isArray(T.shops) && T.shops.some(k => SHOPS[k] && AWIN_MID[k]) && T.tips.length >= 4);
const topicsFor = d => TOPICS.filter(T => !T.price && topicIndexed(T) && topicMatch(T, d));
const BRANDS = (() => {
  const m = {};
  for (const a of Object.values(ARCHIVE)) { if (!a.brand || !a.title) continue; const k = slugify(a.brand); if (!k) continue; (m[k] = m[k] || {key:k, names:{}, n:0}); m[k].names[a.brand] = (m[k].names[a.brand]||0)+1; m[k].n++; }
  return Object.values(m).filter(b => b.n >= 3).map(b => ({key:b.key, name:Object.entries(b.names).sort((x,y)=>y[1]-x[1])[0][0]}));
})();
const brandKeyOf = d => slugify(d.brand||"");
const BRAND_SET = new Set(BRANDS.map(b => b.key));
const BRAND_PATH = k => `/marke/${k}/`;
const brandLive = k => sorted.filter(d => brandKeyOf(d) === k);
const oldList = (list, n) => !list.length ? "" : `<section class="section"><h2>Zuletzt abgelaufene Deals</h2><p>Diese Angebote sind vorbei. So siehst du, welche Preise zuletzt möglich waren.</p><ul class="link-list">${list.slice(0, n).map(a => `<li><a href="${R.deal.de(a.id)}">${esc(a.title.de)}</a>${NP(a) ? "" : `: zuletzt ${eur(a.now,"de")} statt ${eur(a.was,"de")} (−${pct(a)} %)`}</li>`).join("")}</ul></section>`;
const topicChips = list => `<nav class="chips topic-chips" aria-label="Themen">${list.map(T => `<a class="chip" href="${TOPIC_PATH(T.slug)}">${esc(T.h.replace(/-Angebote$| im Angebot.*$|-Angebote .*$/,""))} <span class="n">${TOPIC_LIVE[T.slug].length}</span></a>`).join("")}</nav>`;

function topicShops(T){
  const ks = (T.shops || []).filter(k => SHOPS[k] && SHOPS[k].home && AWIN_MID[k]);
  if (!ks.length) return "";
  return `<section class="section"><h2>Hier lohnt sich der Blick: ${esc(T.kw)} bei unseren Partner-Shops</h2><ul class="link-list">${ks.map(k => `<li><strong><a href="${R.shop.de(k)}">${esc(SHOPS[k].name)}</a></strong><br><span>${esc(SHOPS[k].de)}</span><br><a class="btn btn-ghost" href="${awinLink(AWIN_MID[k], SHOPS[k].home).replace("perldeals-rabatte","perldeals-thema")}" ${AFF}>Zum ${esc(SHOPS[k].name)}-Shop <span class="ad-tag">${UI.de.ad}</span></a></li>`).join("")}</ul></section>`;
}
function buildTopic(T){
  const live = TOPIC_LIVE[T.slug], old = TOPIC_OLD[T.slug], indexed = topicIndexed(T);
  const shops = [...new Set(live.map(shopName))].slice(0, 5);
  const priced = live.filter(d => !NP(d)), maxPct = priced.length ? Math.max(...priced.map(pct)) : 0, minPrice = priced.length ? Math.min(...priced.map(d=>d.now)) : 0;
  const h1 = `${T.h} ${MONTH_DE}`;
  const cr = crumbs("de", [["Start", R.home.de], ["Angebote nach Thema", "/angebote/"], [T.h]]);
  const faq = [
    [`Wann gibt es ${T.kw} am günstigsten?`, `Viele Preise fallen rund um Aktionstage wie den Black Friday (27. November 2026), die Cyber Week und den Prime Day sowie wenn ein Nachfolgemodell erscheint. Mit dem Preisalarm von perldeals bekommst du Bescheid, sobald ein Preis fällt.`],
    [`Wie viele ${T.kw}-Deals gibt es gerade?`, live.length ? `Aktuell listen wir ${live.length} geprüfte Angebote${maxPct?`, mit bis zu ${maxPct} % Rabatt`:""}${minPrice?` und ab ${eur(minPrice,"de")}`:""}. Stand: ${STAMP("de")} Uhr.` : `Gerade gibt es keinen geprüften Deal. Wir suchen mehrmals täglich nach neuen Angeboten.`],
    [`Wie prüft perldeals die Angebote?`, `Wir vergleichen den aktuellen Preis mit dem Preisverlauf und mit anderen Shops. Deals mit Fake-Rabatten (künstlich hoher Streichpreis) nehmen wir nicht auf. Die Links sind Affiliate-Links, für dich ändert sich der Preis nicht.`]
  ];
  const sib = TOPICS.filter(x => x.slug !== T.slug && x.group === T.group && topicIndexed(x)).slice(0, 12);
  const links = [
    T.best && BEST[T.best] ? `<li><a href="${R.best.de(T.best)}">Bestenliste: ${esc(BEST[T.best].de.h1 || BEST[T.best].de.title)}</a></li>` : "",
    T.art && ARTICLES[T.art] ? `<li><a href="${R.article.de(T.art)}">Ratgeber: ${esc(ARTICLES[T.art].de.h1 || ARTICLES[T.art].de.title)}</a></li>` : ""
  ].join("");
  const ld = [{"@context":"https://schema.org", ...cr.ld}, faqLd(faq), {"@context":"https://schema.org","@type":"ItemList","name":T.h,"numberOfItems":live.length,"itemListElement":live.slice(0,20).map((d,i)=>({"@type":"ListItem","position":i+1,"url":BASE+R.deal.de(d.id),"name":d.title.de}))}];
  const body = `<div class="wrap">${cr.html}<div class="feed-head topic-head" style="display:block"><div class="eyebrow">Angebote · ${esc(MONTH_DE)}</div><h1>${esc(h1)}</h1>
    <p class="lead">${esc(T.intro)}</p>
    <p class="topic-facts">${live.length ? `<strong>${live.length} ${live.length===1?"Deal":"Deals"}</strong>${maxPct?` · bis −${maxPct} %`:""}${minPrice?` · ab ${eur(minPrice,"de")}`:""}${shops.length?` · bei ${esc(shops.join(", "))}`:""} · Stand ${STAMP("de")} Uhr` : `Gerade kein geprüfter Deal. Stell dir einen Preisalarm, dann verpasst du den nächsten nicht.`}</p></div></div>
    ${live.length ? grid(live, "de", "h2", `Aktuelle ${T.kw}-Deals`) : ""}
    <div class="wrap">
    ${topicShops(T)}
    <section class="section"><h2>Darauf solltest du beim Kauf achten</h2><ul class="tips">${T.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>${links ? `<ul class="link-list">${links}</ul>` : ""}</section>
    ${oldList(old, 8)}
    <section class="section faq"><h2>Häufige Fragen</h2>${faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>
    ${sib.length ? `<section class="section"><h2>Verwandte Angebote</h2>${topicChips(sib)}</section>` : ""}
    ${followBox("de")}</div>`;
  const desc = live.length ? `${live.length} geprüfte ${T.kw}-Angebote im ${MONTH_DE}${maxPct?`, bis zu ${maxPct} % Rabatt`:""}. Mit Preisverlauf, Preisalarm und ohne Fake-Rabatte. Täglich aktualisiert.` : `${T.kw}-Angebote mit Preisverlauf und Preisalarm. ${T.intro}`;
  layout({lang:"de", single:!TOPICS_EN[T.slug], pathFor:l => l === "en" && TOPICS_EN[T.slug] ? TOPIC_EN_PATH(T) : TOPIC_PATH(T.slug), title:`${T.h} ${MONTH_DE} · perldeals`, description:desc, body, ld, noindex:!indexed,
    image: live[0] && fs.existsSync(`${SRC}/assets/og/deal/${live[0].id}.jpg`) ? `/assets/og/deal/${live[0].id}.jpg` : ""});
}
function buildTopicIndex(){
  const G = {haushalt:"Haushalt", kueche:"Küche", tv:"Fernseher & Heimkino", audio:"Audio", computer:"Computer & Gaming", phone:"Smartphone & Wearables", smarthome:"Smart Home & Sicherheit", garten:"Garten", werkzeug:"Werkzeug & E-Mobilität", sport:"Sport & Mobilität", spielzeug:"Spielzeug & LEGO", reisen:"Reisen & Kurzurlaub", energie:"Solar & Energie", foto:"Foto & Video", geschenke:"Geschenke", beauty:"Beauty & Pflege", vegan:"Vegan", preis:"Nach Preis"};
  const cr = crumbs("de", [["Start", R.home.de], ["Angebote nach Thema"]]);
  const sec = Object.entries(G).map(([g, name]) => { const l = TOPICS.filter(T => T.group === g && topicIndexed(T)); return l.length ? `<section class="section"><h2>${name}</h2>${topicChips(l)}</section>` : ""; }).join("");
  const br = BRANDS.filter(b => brandLive(b.key).length).sort((a,b)=>a.name.localeCompare(b.name));
  const body = `<div class="wrap">${cr.html}<div class="feed-head" style="display:block"><h1>Angebote nach Thema</h1><p class="lead">Alle geprüften Deals, sortiert nach Produktart, Budget und Marke. Jede Seite zeigt nur aktuelle Angebote mit Preisverlauf, täglich aktualisiert.</p></div>${sec}
    <section class="section"><h2>Nach Marke</h2><nav class="chips topic-chips" aria-label="Marken">${br.map(b => `<a class="chip" href="${BRAND_PATH(b.key)}">${esc(b.name)} <span class="n">${brandLive(b.key).length}</span></a>`).join("")}</nav></section></div>`;
  layout({lang:"de", pathFor:l => l === "en" ? "/en/offers/" : "/angebote/", title:"Angebote nach Thema und Marke · perldeals", description:`Alle geprüften Deals nach Produktart, Preis und Marke: Saugroboter, Fernseher, Kopfhörer, Laptops, LEGO, vegane Produkte und mehr. Stand ${MONTH_DE}.`, body, ld:[{"@context":"https://schema.org", ...cr.ld}]});
}
function buildBrand(b){
  const live = brandLive(b.key), old = EXPIRED.filter(a => brandKeyOf(a) === b.key && a.now && a.was);
  const cats = [...new Set(live.concat(old).map(d => CATS[d.cat] ? CATS[d.cat].de[0] : null).filter(Boolean))];
  const shops = [...new Set(live.concat(old).map(shopName))];
  const maxPct = live.filter(d => !NP(d)).length ? Math.max(...live.filter(d => !NP(d)).map(pct)) : 0;
  const cr = crumbs("de", [["Start", R.home.de], ["Angebote nach Thema", "/angebote/"], [`${b.name} Angebote`]]);
  const tps = TOPICS.filter(T => !T.price && topicIndexed(T) && live.some(d => topicMatch(T, d))).slice(0, 10);
  const faq = [
    [`Wo gibt es ${b.name}-Produkte gerade günstig?`, live.length ? `Aktuell haben wir ${live.length} geprüfte ${b.name}-Angebote bei ${[...new Set(live.map(shopName))].join(", ")}${maxPct?`, mit bis zu ${maxPct} % Rabatt`:""}.` : `Gerade gibt es keinen geprüften ${b.name}-Deal. Bisher hatten wir Angebote bei ${shops.join(", ")}.`],
    [`Wann ist ${b.name} am günstigsten?`, `Rund um Black Friday (27. November 2026), Cyber Monday und Prime Day sowie beim Erscheinen neuer Modelle sinken die Preise oft deutlich. Der Preisverlauf auf jeder Deal-Seite zeigt dir, ob der Preis wirklich gut ist.`]
  ];
  const body = `<div class="wrap">${cr.html}<div class="feed-head" style="display:block"><div class="eyebrow">Marke · ${esc(MONTH_DE)}</div><h1>${esc(b.name)} Angebote ${esc(MONTH_DE)}</h1>
    <p class="lead">Alle geprüften ${esc(b.name)}-Deals auf einen Blick${cats.length?`: ${esc(cats.join(", "))}`:""}. Wir vergleichen jeden Preis mit dem Preisverlauf, Fake-Rabatte fliegen raus.</p>
    <p class="topic-facts">${live.length ? `<strong>${live.length} ${live.length===1?"Deal":"Deals"}</strong>${maxPct?` · bis −${maxPct} %`:""} · Stand ${STAMP("de")} Uhr` : "Gerade kein geprüfter Deal."}</p></div></div>
    ${live.length ? grid(live, "de", "h2", `Aktuelle ${b.name}-Deals`) : ""}
    <div class="wrap">${tps.length ? `<section class="section"><h2>${esc(b.name)} nach Produktart</h2>${topicChips(tps)}</section>` : ""}
    ${oldList(old, 10)}
    <section class="section faq"><h2>Häufige Fragen</h2>${faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>${followBox("de")}</div>`;
  layout({lang:"de", pathFor:l => l === "en" ? BRAND_EN_PATH(b.key) : BRAND_PATH(b.key), title:`${b.name} Angebote ${MONTH_DE} · perldeals`, description: live.length ? `${live.length} geprüfte ${b.name}-Angebote${maxPct?` mit bis zu ${maxPct} % Rabatt`:""}: ${cats.slice(0,4).join(", ")}. Mit Preisverlauf und Preisalarm, täglich aktualisiert.` : `${b.name}-Angebote mit Preisverlauf und Preisalarm. Zuletzt abgelaufene Deals und Preise.`, body, ld:[{"@context":"https://schema.org", ...cr.ld}, faqLd(faq)], noindex: !live.length});
}
/* Wissen-Seiten (Ratgeber zu Preisen, Rabatten, Rechten), nur DE */
const WISSEN = fs.existsSync(`${SRC}/data/wissen.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/wissen.json`, "utf8")) : {items:[]};
/* Zusatz-Ratgeber (05.11.): wissen-extra.json ersetzt gleiche Slugs / ergänzt neue; vegan-guides.json = veganer Ratgeber-Bereich */
for (const f of ["wissen-extra.json", "vegan-guides.json"]) {
  if (!fs.existsSync(`${SRC}/data/${f}`)) continue;
  for (const it of JSON.parse(fs.readFileSync(`${SRC}/data/${f}`, "utf8")).items || []) {
    const i = WISSEN.items.findIndex(x => x.slug === it.slug);
    if (i >= 0) WISSEN.items[i] = it; else WISSEN.items.push(it);
  }
}
const VEGAN_G = fs.existsSync(`${SRC}/data/vegan-guides.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/vegan-guides.json`, "utf8")) : null;
/* Eigene Illustrationen in Ratgebern (Nico 05.11.): figures = [[Abschnitt-Index, Pfad, alt, Bildunterschrift]] */
const figSize = src => { try { const s = fs.readFileSync(`${SRC}${src}`, "utf8").slice(0, 400); const m = s.match(/viewBox="0 0 (\d+) (\d+)"/); return m ? ` width="${m[1]}" height="${m[2]}"` : ""; } catch (e) { return ""; } };
const figs = (w, i) => (w.figures || []).filter(f => f[0] === i).map(([, src, alt, cap]) => `<figure class="illu"><a href="${src}" target="_blank" rel="noopener" title="Grafik groß ansehen"><img src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async"${figSize(src)}></a><figcaption>${esc(cap)}</figcaption></figure>`).join("");
/* Wissen-Texte: URLs und interne Pfade im Fließtext anklickbar machen */
const linkify = t => esc(t)
  .replace(/https?:\/\/[^\s<)]+[^\s<).,;:]/g, u => `<a href="${u}" rel="nofollow noopener" target="_blank">${u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>`)
  .replace(/(^|[\s(„])(\/(?:reseller|wissen|bestenliste|angebote|rabatte|black-friday|konto|whatsapp|telegram|abgelaufene-deals|gutschein-alarm|shop|kategorie|gutscheine|geschenke|vegan-ratgeber|wasserdicht)\/[a-z0-9\-\/]*)/g, (m, pre, path) => fs.existsSync(`${OUT}${path}${path.endsWith("/") ? "" : "/"}index.html`) || /^\/(reseller|wissen|bestenliste|angebote|kategorie|gutscheine|geschenke|vegan-ratgeber|wasserdicht)\//.test(path) ? `${pre}<a href="${path}">${path}</a>` : m);
function buildWissen(w){
  const cr = crumbs("de", [["Start", R.home.de], ["Wissen", "/wissen/"], [w.title.split(":")[0]]]);
  const others = WISSEN.items.filter(x => x.slug !== w.slug);
  const body = `<div class="wrap legal wissen">${cr.html}<div class="eyebrow">Wissen · aktualisiert ${fmtDay(WISSEN.updated + "T12:00:00", "de")}</div><h1>${esc(w.title)}</h1><p class="lead">${esc(w.lead)}</p>
    ${w.sections.map(([h, ps], i) => `<h2>${esc(h)}</h2>${ps.map(p => `<p>${linkify(p)}</p>`).join("")}${figs(w, i)}`).join("")}
    <section class="section faq"><h2>Häufige Fragen</h2>${w.faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>
    ${(w.sources||[]).length ? `<section class="section"><h2>Quellen</h2>${srcList2(w.sources)}</section>` : ""}
    <section class="section"><h2>Weiterlesen</h2><ul class="link-list">${(w.links||[]).map(l => { const T = TOPICS.find(x => TOPIC_PATH(x.slug) === l); const W = WISSEN.items.find(x => `/wissen/${x.slug}/` === l); const name = T ? T.h : W ? W.title : ({"/rabatte/":"Rabattcodes und Gutscheine","/konto/":"Preisalarme verwalten","/whatsapp/":"Deals auf WhatsApp","/black-friday/":"Black Friday 2026","/reseller/karten-ankauf/":"Karten verkaufen: Ankauf per WhatsApp","/reseller/pokemon-haendler/":"Pokémon für Händler: Deals & Leitfaden","/reseller/pokemon-haendler/verkaufen-gebuehren/":"Pokémon-Karten verkaufen: Gebühren im Vergleich","/reseller/rechner/":"Reseller-Rechner: Verkaufspreis nach Gebühren","/reseller/lego-eol/":"LEGO-Sets kurz vor EOL","/reseller/ankauf/retro-konsolen/":"Retro-Konsolen verkaufen: Ankauf","/reseller/ankauf/videospiele/":"Videospiele verkaufen: Ankauf","/reseller/ankauf/yugioh-karten/":"Yu-Gi-Oh-Karten verkaufen: Ankauf","/reseller/ankauf/lego/":"LEGO verkaufen: Ankauf","/reseller/ankauf/pokemon-karten/":"Pokémon-Karten verkaufen: Ankauf","/reseller/ankauf/one-piece-karten/":"One-Piece-Karten verkaufen: Ankauf","/reseller/release-kalender/":"Release-Kalender Pokémon & One Piece","/reseller/termine/":"Erscheinungstermine","/bestenliste/":"Alle Bestenlisten","/reseller/ebay-shop/":"Unser eBay-Shop & Live-Auktionen","/gutschein-alarm/":"Gutschein-Alarm: neue Codes per Mail","/abgelaufene-deals/":"Verpasste Deals","/kategorie/vegan/":"Vegane Deals","/vegan-ratgeber/":"Vegan-Ratgeber: alle Artikel","/geschenke/vegane-geschenke/":"Vegane Geschenke","/gutscheine/myprotein/":"Myprotein Gutschein","/gutscheine/otto/":"OTTO Gutschein","/gutscheine/100percentpure/":"100% Pure Gutschein","/wasserdicht/":"Ist das wasserdicht? Alle Modelle","/reseller/lego-eol/":"LEGO EOL-Liste 2026/2027","/reseller/ratgeber/sammelkarten-zubehoer/":"Sammelkarten-Zubehör: Hüllen, Toploader, Ordner","/reseller/ratgeber/reseller-ausruestung/":"Reseller-Ausrüstung: Versand, Waage, Fotos"}[l] || l); return `<li><a href="${l}">${esc(name)}</a></li>`; }).join("")}${others.slice(0,4).map(x => `<li><a href="/wissen/${x.slug}/">${esc(x.title)}</a></li>`).join("")}</ul></section>
    ${followBox("de")}</div>`;
  const ld = [{"@context":"https://schema.org", ...cr.ld}, faqLd(w.faq), {"@context":"https://schema.org","@type":"Article","headline":w.title,"description":w.desc,"inLanguage":"de","dateModified":WISSEN.updated,"datePublished":WISSEN.updated,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`},"mainEntityOfPage":BASE+`/wissen/${w.slug}/`}];
  layout({lang:"de", single:!WISSEN_EN[w.slug], pathFor:l => l === "en" && WISSEN_EN[w.slug] ? WISSEN_EN_PATH(w.slug) : `/wissen/${w.slug}/`, title:`${w.title} · perldeals`, description:w.desc, body, ld, type:"article"});
}
function buildWissenIndex(){
  const cr = crumbs("de", [["Start", R.home.de], ["Wissen"]]);
  const body = `<div class="wrap legal">${cr.html}<h1>Wissen rund ums Sparen</h1><p class="lead">Wie du echte Deals erkennst, Preise im Blick behältst und deine Rechte beim Online-Kauf kennst.</p><ul class="link-list">${WISSEN.items.map(w => `<li><a href="/wissen/${w.slug}/"><strong>${esc(w.title)}</strong></a><br><span>${esc(w.desc)}</span></li>`).join("")}</ul></div>`;
  layout({lang:"de", pathFor:l => l === "en" ? "/en/knowledge/" : "/wissen/", title:"Wissen: Fake-Rabatte, Preisverlauf, Preisalarm · perldeals", description:"Ratgeber rund ums Sparen: Fake-Rabatte erkennen, Amazon-Preisverlauf anzeigen, Preisalarm einrichten, Preisfehler, UVP, Widerrufsrecht und generalüberholte Technik.", body, ld:[{"@context":"https://schema.org", ...cr.ld}]});
}
/* ---------------- Reseller- und Sammler-Bereich (nur DE) ----------------
   /reseller/ + Unterseiten aus src/data/reseller.json (Erscheinungstermine, Aktionen, LEGO-EOL)
   und aus den Deals (Themen per rsTopics). Deal-Alarm: kind "reseller" in /api/subscribe.php, Versand in cron.php. */
const RS = fs.existsSync(`${SRC}/data/reseller.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/reseller.json`, "utf8")) : null;
const RS_T = {
  pokemon:{name:"Pokémon", path:"/reseller/pokemon/", icon:"⚡"},
  onepiece:{name:"One Piece", path:"/reseller/one-piece/", icon:"🏴‍☠️"},
  lego:{name:"LEGO", path:"/reseller/lego-eol/", icon:"🧱"},
  konsolen:{name:"Konsolen", path:"/reseller/konsolen/", icon:"🎮"}
};
const rsTopics = d => { const t = `${d.title.de} ${d.brand||""}`, r = [];
  if (/pok[eé]mon/i.test(t)) r.push("pokemon");
  if (/one piece/i.test(t)) r.push("onepiece");
  if (/\blego\b/i.test(t)) r.push("lego");
  if (/playstation|\bps5\b|nintendo switch|xbox|steam deck|spielkonsole|handheld-konsole/i.test(t)) r.push("konsolen");
  return r; };
const RS_UPLIFT = RS ? RS.uplift : 0.22;
/* Reseller-Kennzahlen eines Deals: Marktwert aus d.rs (mit Quelle) oder, nur für LEGO-Sets auf der EOL-Liste, die EOL-Schätzung */
const rsMetrics = d => {
  if (d.rs && d.rs.market) return {market:d.rs.market, basis:d.rs.basis || "Schätzung", limit:d.rs.limit || null};
  const eolSet = RS && rsTopics(d).includes("lego") && RS.eol.find(s => new RegExp(`\\b${s.num}\\b`).test(`${d.id} ${d.title.de}`));
  if (eolSet) return {market:eolSet.market.value, basis:`Schätzung: UVP + ${Math.round(RS_UPLIFT*100)} % nach EOL`, limit:(d.rs && d.rs.limit) || null};
  return {market:null, basis:null, limit:(d.rs && d.rs.limit) || null};
};
const rsDeals = topic => sorted.filter(d => topic ? rsTopics(d).includes(topic) : rsTopics(d).length);
const dayDe = s => s ? new Date(s + "T12:00:00").toLocaleDateString("de-DE", {day:"2-digit", month:"2-digit", year:"numeric"}) : "noch offen";
const daysTo = s => s ? Math.round((new Date(s + "T12:00:00") - new Date(NOW_MS)) / 864e5) : null;
const RS_NOTE = `<p class="rs-note"><strong>Hinweis:</strong> Marktwerte und Margen sind <strong>Schätzungen</strong> und können sich jederzeit ändern. Sie sind vor Gebühren, Versand und Steuern gerechnet und keine Anlage- oder Kaufberatung. Bei LEGO rechnen wir mit UVP + ${Math.round(RS_UPLIFT*100)} % (Median-Wertsteigerung versiegelter Sets zwölf Monate nach Produktionsende); einzelne Sets können deutlich darüber oder darunter liegen. Preise und Termine stammen aus Händler- und Herstellerangaben (Stand ${dayDe(RS ? RS.updated.slice(0,10) : "")}), Logos von Händlern und Marken verwenden wir bewusst nicht.</p><p class="rs-note rs-tm">LEGO® ist eine Marke der LEGO Gruppe, die diese Seite weder sponsert noch autorisiert oder unterstützt. Pokémon® ist eine Marke von Nintendo, Creatures Inc. und GAME FREAK inc.; ONE PIECE ist eine Marke von Eiichiro Oda/Shueisha/Toei Animation, das Kartenspiel erscheint bei Bandai. PlayStation® ist eine Marke von Sony Interactive Entertainment, Nintendo Switch™ von Nintendo, Xbox® von Microsoft. perldeals ist mit keinem dieser Unternehmen verbunden; alle Marken gehören ihren jeweiligen Inhabern.</p>`;
const rsAlarmBox = (source, pre = []) => `<form class="sub rs-alarm" id="alarm" data-sub data-kind="reseller" data-source="${source}" novalidate>
  <div class="sub-head"><strong>🔔 Reseller-Deal-Alarm</strong><span>Neue Erscheinungstermine, Rabattaktionen und Deals zu deinen Themen sofort per E-Mail. Kostenlos, jederzeit abbestellbar.</span></div>
  <fieldset class="rs-topics"><legend>Deine Themen</legend>
    ${Object.entries(RS_T).map(([k,T]) => `<label><input type="checkbox" name="topics" value="${k}"${!pre.length || pre.includes(k) ? " checked" : ""}> ${T.icon} ${T.name}</label>`).join("")}
    <label><input type="checkbox" name="topics" value="top"${!pre.length ? " checked" : ""}> 💎 Allgemeiner Alarm: beste Deals &amp; Aktionen</label>
    <label><input type="checkbox" name="topics" value="netzwerk"${!pre.length || pre.includes("netzwerk") ? " checked" : ""}> 🤝 Angebote direkt von perldeals</label>
  </fieldset>
  <div class="rs-filters">
    <label>Mindestrabatt <select name="min_discount"><option value="0">egal</option><option value="20">ab 20 %</option><option value="30">ab 30 %</option><option value="40">ab 40 %</option><option value="50">ab 50 %</option></select></label>
    <label>Mindestmarge <input type="number" name="min_margin" min="0" max="5000" step="5" inputmode="numeric" placeholder="z. B. 20"> €</label>
  </div>
  <div class="sub-row"><input type="email" name="email" required autocomplete="email" placeholder="Deine E-Mail-Adresse" aria-label="E-Mail-Adresse"><input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><button class="btn btn-primary" type="submit">Alarm aktivieren</button></div>
  <label class="sub-nl"><input type="checkbox" name="newsletter" value="1"> Zusätzlich den perldeals-Newsletter mit den besten Deals und Aktionen erhalten (freiwillig, jederzeit abbestellbar)</label>
  <p class="sub-legal">Mit Klick erhältst du eine Bestätigungs-E-Mail (Double-Opt-in). Erst nach Bestätigung schicken wir dir Benachrichtigungen mit Deals und Partnerlinks, je E-Mail mit Abmeldelink. Mindestrabatt und Mindestmarge gelten für Deals; neue Erscheinungstermine und Aktionen zu deinen Themen bekommst du immer. <a href="${R.privacy.de}">Datenschutz</a></p>
  <p class="sub-legal">Lieber aufs Handy? <a href="${SOCIAL.tg}" rel="noopener">Telegram-Kanal</a> · <a href="/whatsapp/">WhatsApp-Kanal</a> (dort kommen alle Top-Deals, nicht nur Reseller-Themen).</p>
  <p class="sub-msg" role="status" aria-live="polite"></p></form>`;
const rsProducts = r => r.products.length ? `<ul class="rs-prod">${r.products.map(p => `<li>${esc(p.type)}${p.price ? `: <strong>${eur(p.price,"de")}</strong>` : ""}</li>`).join("")}</ul>` : "Produkte noch nicht angekündigt";
const rsSrc = list => (list||[]).slice(0,2).map((u,i) => `<a href="${esc(u)}" rel="nofollow noopener" target="_blank">Quelle${list.length>1?" "+(i+1):""}</a>`).join(" · ");
function rsReleaseTable(game, limit){
  let list = RS.releases.filter(r => !game || r.game === game).filter(r => !r.date || daysTo(r.date) >= -45)
    .sort((a,b) => (a.date||"9999").localeCompare(b.date||"9999"));
  if (limit) list = list.filter(r => !r.date || daysTo(r.date) >= -3).slice(0, limit);
  if (!list.length) return `<p>Gerade sind keine Termine eingetragen.</p>`;
  const MON = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"], MONL = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const GAME = {pokemon:["Pokémon","pkm"], onepiece:["One Piece","op"]};
  const card = r => {
    const n = r.date ? daysTo(r.date) : null, d = r.date ? new Date(r.date + "T12:00:00") : null;
    const when = r.date ? (n > 1 ? `in ${n} Tagen` : n === 1 ? "morgen" : n === 0 ? "heute" : "erschienen") : "Datum offen";
    const prods = [...r.products].sort((a,b) => (b.price?1:0) - (a.price?1:0));
    const pr = p => `<li><span>${esc(p.type)}</span>${p.price ? `<b>${eur(p.price,"de")}</b>` : ""}</li>`;
    const g = GAME[r.game] || [r.game, "x"];
    return `<li class="rel-card${n !== null && n < 0 ? " past" : ""}${n !== null && n >= 0 && n <= 7 ? " soon" : ""}" id="${r.id}">
      <div class="rel-date">${d ? `<span class="d">${d.getDate()}</span><span class="m">${MON[d.getMonth()]}</span>` : `<span class="m">offen</span>`}</div>
      <div class="rel-body">
        <div class="rel-tags"><span class="rel-game ${g[1]}">${esc(g[0])}</span><span class="rel-when">${when}</span>${r.confirmed ? "" : `<span class="rel-unc">unbestätigt</span>`}${r.game === "onepiece" ? `<span class="rel-lang">EN</span>` : ""}</div>
        <h3><a href="${RS_REL_PATH(r)}">${esc(r.name)}</a></h3>${r.code ? `<p class="rel-code">${esc(r.code)}</p>` : ""}
        ${prods.length ? `<ul class="rel-prods">${prods.slice(0,3).map(pr).join("")}</ul>${prods.length > 3 ? `<details class="rel-more"><summary>+ ${prods.length-3} weitere Produkte</summary><ul class="rel-prods">${prods.slice(3).map(pr).join("")}</ul></details>` : ""}` : `<p class="rel-code">Produkte noch nicht angekündigt</p>`}
        <p class="rel-shops">🛒 ${r.retailers.length ? esc(r.retailers.slice(0,4).join(", ")) + (r.retailers.length > 4 ? ` +${r.retailers.length-4}` : "") : "Händler noch nicht bestätigt"}</p>
        <details class="rel-more"><summary>Hinweise &amp; Quellen</summary><p>${esc(r.note)}</p><p>${rsSrc(r.sources)}</p></details>
      </div></li>`;
  };
  let html = "", cur = "";
  const open = list.filter(r => !r.date || daysTo(r.date) >= 0), past = list.filter(r => r.date && daysTo(r.date) < 0);
  for (const r of open) {
    const key = r.date ? r.date.slice(0,7) : "offen";
    if (key !== cur) { html += `${cur ? "</ul>" : ""}<h3 class="rel-month">${key === "offen" ? "Datum noch offen" : MONL[+key.slice(5)-1] + " " + key.slice(0,4)}</h3><ul class="rel-list">`; cur = key; }
    html += card(r);
  }
  if (cur) html += "</ul>";
  if (past.length) html += `<details class="rel-past"><summary>Kürzlich erschienen (${past.length})</summary><ul class="rel-list">${past.reverse().map(card).join("")}</ul></details>`;
  return `<div class="rel">${html}</div>`;
}
function rsPromoList(topic){
  const today = new Date(NOW_MS).toISOString().slice(0,10);
  const list = RS.promos.filter(p => !p.to || p.to >= today).filter(p => !topic || p.topics.includes(topic));
  if (!list.length) return `<p>Gerade keine laufende Aktion eingetragen. Mit dem Deal-Alarm erfährst du von der nächsten sofort.</p>`;
  return `<ul class="rs-promos">${list.map(p => `<li id="${p.id}"><div class="rs-promo-head"><strong>${esc(p.retailer)}</strong><span>${p.from ? dayDe(p.from) : ""}${p.to ? " bis " + dayDe(p.to) : p.from ? " · Ende offen" : ""}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.details)}</p><small>${rsSrc(p.sources)}</small></li>`).join("")}</ul>`;
}
function rsEolTable(limit){
  let list = RS.eol.filter(s => s.best && s.discountPct > 0).sort((a,b) => (b.marginPct||0) - (a.marginPct||0));
  if (limit) list = list.slice(0, limit);
  return `<div class="rs-scroll"><table class="rs-table"><thead><tr><th>Set</th><th>UVP</th><th>Bestpreis</th><th>Rabatt</th><th>Wert nach EOL*</th><th>Marge*</th><th></th></tr></thead><tbody>${list.map(s => {
    const link = s.deal ? `<a class="btn btn-ghost" href="${R.deal.de(s.deal)}">Zum Deal</a>` : s.asin && /^Amazon\.de/.test(s.best.shop) ? `<a class="btn btn-primary" href="${amz(s.asin)}" ${AFF}>Bei Amazon <span class="ad-tag">Anzeige</span></a>` : `<a href="${esc(s.best.url || s.sources[0])}" rel="nofollow noopener" target="_blank">Preisvergleich</a>`;
    return `<tr id="${s.id}"><td data-l="Set"><a href="${RS_EOL_PATH(s)}"><strong>LEGO ${esc(s.theme)} ${s.num}</strong></a><br>${esc(s.name)}<br><small>EOL: ${esc(s.eol)} · ${rsSrc([s.eolSource])}</small></td>
    <td data-l="UVP">${eur(s.uvp,"de")}</td><td data-l="Bestpreis"><strong>${eur(s.best.price,"de")}</strong><br><small>${esc(s.best.shop)}, ${dayDe(s.best.checked)}</small></td>
    <td data-l="Rabatt"><span class="rs-pct">−${s.discountPct} %</span></td><td data-l="Wert nach EOL*">≈ ${eur(s.market.value,"de")}</td>
    <td data-l="Marge*"><strong>≈ ${eur(s.margin,"de")}</strong><br><small>${s.marginPct} %</small></td><td>${link}</td></tr>`; }).join("")}</tbody></table></div><p class="rs-foot">* Schätzung, siehe Hinweis unten. Preise inkl. Versand laut Preisvergleich zum angegebenen Datum, können sich schnell ändern.</p>`;
}
function rsMetricTable(list){
  list = list.filter(d => !NP(d));
  if (!list.length) return "";
  return `<div class="wrap"><h3 class="rs-h3">Reseller-Kennzahlen zu diesen Deals</h3><div class="rs-scroll"><table class="rs-table"><thead><tr><th>Deal</th><th>Ladenpreis</th><th>Marktwert*</th><th>mögliche Marge*</th><th>Limit pro Kunde</th></tr></thead><tbody>${list.map(d => { const m = rsMetrics(d), mg = m.market ? m.market - d.now : null;
    return `<tr><td data-l="Deal"><a href="${R.deal.de(d.id)}">${esc(d.title.de)}</a><br><small>${esc(shopName(d))}</small></td><td data-l="Ladenpreis"><strong>${eur(d.now,"de")}</strong> <small>(−${pct(d)} %)</small></td>
    <td data-l="Marktwert*">${m.market ? `≈ ${eur(m.market,"de")}<br><small>${esc(m.basis)}</small>` : "–"}</td><td data-l="Marge*">${mg != null ? `≈ ${eur(mg,"de")} <small>(${Math.round(mg/d.now*100)} %)</small>` : "–"}</td><td data-l="Limit">${m.limit ? esc(m.limit) : "nicht angegeben"}</td></tr>`; }).join("")}</tbody></table></div></div>`;
}
/* Karriere (Nico 06.11.): offene Stellen, schnelle Bewerbung per WhatsApp oder Kurzformular, Lebenslauf freiwillig */
const JOBS = [{
  id: "aushilfe-hagen", title: "Aushilfe Versand & eBay-Listings (m/w/d)", form: "Aushilfe Versand & eBay-Listings (Hagen a.T.W.)",
  place: "Hagen am Teutoburger Wald (vor Ort)", type: "Minijob, Zeiten nach Absprache", posted: "2026-11-06", emp: "PART_TIME",
  intro: "Für unseren Handel mit Sammelkarten, LEGO und Technik suchen wir Unterstützung vor Ort in Hagen a.T.W. – gemeinsam für die Bökenkröger Handelsgesellschaft und perldeals.",
  tasks: ["Bestellungen bearbeiten, verpacken und versenden", "eBay-Listings erstellen: Fotos machen, Beschreibung schreiben, Preise eintragen", "Ware sortieren und prüfen: Sammelkarten, LEGO, Technik", "Lager in Ordnung halten"],
  offer: ["Zeiten nach Absprache – gut neben Schule, Studium, Familie oder Hauptjob", "Kurze Wege, kleines Team, direkte Ansprechpartner", "Spannende Ware mit Sammler-Herz statt Fließband"],
  want: ["Sorgfalt beim Verpacken und Prüfen", "Grundkenntnisse am Smartphone oder PC", "Zuverlässigkeit – Erfahrung mit eBay ist schön, aber kein Muss"]
}, {
  id: "einkaeufer", title: "Einkäufer für Sammlerware & Technik (m/w/d)", form: "Einkäufer für Sammlerware & Technik",
  place: "Remote (von zu Hause) oder vor Ort in Hagen a.T.W.", type: "Minijob, Zeiten nach Absprache", posted: "2026-11-06", emp: "PART_TIME", remote: true,
  intro: "Du hast ein gutes Auge für Schnäppchen? Für die Bökenkröger Handelsgesellschaft und perldeals suchst du gute Ware zum Ankauf – Sammelkarten, LEGO, Konsolen, Videospiele und Technik – und hilfst, sie mit Gewinn weiterzuverkaufen. Eingekauft wird fast nur online, deshalb geht der Job auch komplett von zu Hause.",
  tasks: ["Ankaufsangebote online finden: Kleinanzeigen, eBay, Vinted, Online-Auktionen und Händler", "Marktwert einschätzen, z. B. mit Cardmarket, eBay-Verkaufspreisen und Preisverlauf", "Preise verhandeln und Ankäufe abstimmen", "Versand zu uns organisieren und Zustandsfotos prüfen"],
  offer: ["Remote von zu Hause, Zeiten nach Absprache", "Kleines Team mit kurzen Entscheidungswegen", "Du lernst, wie Reselling wirklich funktioniert – mit echten Zahlen"],
  want: ["Interesse an Sammelkarten, LEGO, Retro-Games oder Technik", "Verhandlungsgeschick und ein Gespür für faire Preise", "Zuverlässigkeit und ein Smartphone oder PC mit Internet"]
}];
function buildKarriere(){
  const li = a => `<ul class="checklist">${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const waFor = j => `https://wa.me/${WA_PHONE.slice(1)}?text=${encodeURIComponent(`Hallo, ich interessiere mich für die Stelle „${j.title}“. Mein Name ist `)}`;
  const jobHtml = j => `<section class="section job" id="${j.id}"><h2>${esc(j.title)}</h2>
  <p class="job-meta">📍 ${esc(j.place)} · ⏰ ${esc(j.type)}</p>
  <p>${esc(j.intro)}</p>
  <h3>Deine Aufgaben</h3>${li(j.tasks)}<h3>Das bieten wir</h3>${li(j.offer)}<h3>Das bringst du mit</h3>${li(j.want)}
  <div class="job-cta"><a class="btn btn-primary" href="${waFor(j)}" target="_blank" rel="noopener">💬 Per WhatsApp bewerben</a><a class="btn btn-ghost" href="#bewerben" data-job="${esc(j.form)}">✍️ Kurzbewerbung per Formular</a></div>
  </section>`;
  const faq = [
    ["Brauche ich einen Lebenslauf?", "Nein. Eine kurze Nachricht mit deinem Namen und wie wir dich erreichen, reicht völlig. Einen Lebenslauf kannst du anhängen, wenn du möchtest."],
    ["Wie schnell bekomme ich eine Antwort?", "Wir melden uns in der Regel innerhalb weniger Tage per WhatsApp, Telefon oder E-Mail – je nachdem, was du angegeben hast."],
    ["Wann und wie viel arbeite ich?", "Die Zeiten sprechen wir gemeinsam ab, damit sie zu deinem Alltag passen."]
  ];
  const body = `<div class="wrap">${crumbs("de", [["Start", R.home.de], ["Karriere"]]).html}
  <div class="feed-head" style="display:block"><div class="eyebrow">Karriere · Minijobs</div><h1>Jobs bei perldeals</h1>
  <p class="lead">Wir suchen Verstärkung auf Minijob-Basis – vor Ort in Hagen am Teutoburger Wald und remote. Bewerben geht in einer Minute: per WhatsApp oder mit einer kurzen Nachricht – ein Lebenslauf ist nie Pflicht.</p>
  <nav class="chips" aria-label="Offene Stellen">${JOBS.map(j => `<a class="chip" href="#${j.id}">${esc(j.title)}</a>`).join("")}</nav></div>
  ${JOBS.map(jobHtml).join("")}
  <section class="section" id="bewerben"><h2>Kurzbewerbung in einer Minute</h2>
  <p>Ein paar Sätze zu dir reichen. Lebenslauf? Nur wenn du magst.</p>
  <p class="ak-err" id="ak-err" hidden></p>
  <form class="ak-form" method="post" action="/api/bewerbung.php" enctype="multipart/form-data">
    <label class="rr-f"><span>Stelle</span><select name="stelle" id="job-select">${JOBS.map((j,i) => `<option${i===0?" selected":""}>${esc(j.form)}</option>`).join("")}<option>Initiativbewerbung</option></select></label>
    <label class="rr-f"><span>Name *</span><input name="name" required maxlength="80" autocomplete="name"></label>
    <div class="rr-row"><label class="rr-f"><span>Telefon/WhatsApp</span><input name="phone" maxlength="40" autocomplete="tel" inputmode="tel"></label><label class="rr-f"><span>E-Mail</span><input name="email" type="email" maxlength="254" autocomplete="email"></label></div>
    <p class="job-hint">Telefon <b>oder</b> E-Mail reicht.</p>
    <label class="rr-f"><span>Kurze Nachricht *</span><textarea name="nachricht" required minlength="5" maxlength="2000" rows="4" placeholder="z. B. Ich bin 19, habe nachmittags Zeit und verkaufe selbst manchmal auf eBay."></textarea></label>
    <label class="rr-f"><span>Lebenslauf (freiwillig – PDF, Word oder Foto, max. 10 MB)</span><input name="lebenslauf" type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png,image/heic,image/heif"></label>
    <label class="rr-f rr-chk"><input type="checkbox" name="consent" value="1" required> <span>Ich bin einverstanden, dass meine Angaben zur Bearbeitung meiner Bewerbung per E-Mail übermittelt werden (<a href="/datenschutz/">Datenschutz</a>). *</span></label>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn-primary" type="submit">Bewerbung absenden</button>
  </form></section>
  ${faqBlock("de", faq)}</div>`;
  const posting = j => ({"@context":"https://schema.org","@type":"JobPosting","title":j.title,"description":`<p>${esc(j.intro)}</p><p>Aufgaben:</p><ul>${j.tasks.map(t=>`<li>${esc(t)}</li>`).join("")}</ul><p>Wir bieten:</p><ul>${j.offer.map(t=>`<li>${esc(t)}</li>`).join("")}</ul><p>Bewerbung per WhatsApp oder Kurzformular, Lebenslauf freiwillig.</p>`,
    "datePosted":j.posted,"validThrough":"2027-02-28T23:59","employmentType":j.emp,
    "hiringOrganization":{"@type":"Organization","name":"Bökenkröger Handelsgesellschaft / perldeals","sameAs":BASE,"logo":BASE+"/assets/logo.png"},
    "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Hagen am Teutoburger Wald","postalCode":"49170","addressRegion":"Niedersachsen","addressCountry":"DE"}},
    ...(j.remote ? {"jobLocationType":"TELECOMMUTE","applicantLocationRequirements":{"@type":"Country","name":"Deutschland"}} : {}),
    "directApply":true});
  layout({lang:"de", single:true, pathFor:()=>"/karriere/", title:"Minijobs: Aushilfe in Hagen a.T.W. & Einkäufer remote (m/w/d) · perldeals", description:"Minijobs bei perldeals: Aushilfe für Versand und eBay-Listings in Hagen am Teutoburger Wald sowie Einkäufer für Sammlerware, auch remote. Bewerbung per WhatsApp oder Kurzformular – Lebenslauf freiwillig.", body, ld:[faqLd(faq), ...JOBS.map(posting)]});
  layout({lang:"de", single:true, noindex:true, pathFor:()=>"/karriere/danke/", title:"Bewerbung gesendet · perldeals", description:"Deine Bewerbung bei perldeals ist angekommen.", body:`<div class="wrap"><div class="feed-head" style="display:block"><div class="eyebrow">Karriere</div><h1>Danke, deine Bewerbung ist angekommen!</h1><p class="lead">Wir melden uns in den nächsten Tagen bei dir – per WhatsApp, Telefon oder E-Mail.</p></div><p><a class="btn btn-primary" href="/">Zu den Deals</a></p></div>`});
}
const rsNav = active => `<nav class="chips topic-chips rs-nav" aria-label="Reseller-Bereich"><a class="chip" href="/reseller/"${active==="hub"?' aria-current="page"':""}>Übersicht</a>${Object.entries(RS_T).map(([k,T]) => `<a class="chip" href="${T.path}"${active===k?' aria-current="page"':""}>${T.icon} ${T.name}</a>`).join("")}<a class="chip" href="/reseller/release-kalender/"${active==="termine"?' aria-current="page"':""}>📅 Termine</a><a class="chip" href="/reseller/aktionen/"${active==="aktionen"?' aria-current="page"':""}>🏷️ Aktionen</a><a class="chip" href="/reseller/angebote/"${active==="angebote"?' aria-current="page"':""}>💎 Angebote</a><a class="chip" href="/reseller/karten-ankauf/"${active==="ankauf"?' aria-current="page"':""}>💰 Ankauf</a><a class="chip" href="/reseller/rechner/"${active==="rechner"?' aria-current="page"':""}>🧮 Rechner</a><a class="chip" href="/reseller/ebay-shop/"${active==="ebay"?' aria-current="page"':""}>🛒 eBay-Shop</a><a class="chip" href="/reseller/ratgeber/"${active==="ratgeber"?' aria-current="page"':""}>📘 Ratgeber</a><a class="chip" href="/reseller/alarm/"${active==="alarm"?' aria-current="page"':""}>🔔 Alarm</a></nav>`;
const akForm = (catSel) => { const cats = ["Pokémon-Karten","Yu-Gi-Oh-Karten","One-Piece-Karten","Andere Sammelkarten","Retro-Konsolen","Videospiele","LEGO","Sonstiges"];
  return `<section class="wrap section" id="ankauf-formular"><h2>Lieber per Formular? Anfrage mit Fotos senden</h2>
  <p class="ak-err" id="ak-err" hidden></p>
  <form class="ak-form" method="post" action="/api/ankauf.php" enctype="multipart/form-data">
    <div class="rr-row"><label class="rr-f"><span>Name *</span><input name="name" required maxlength="80" autocomplete="name"></label><label class="rr-f"><span>E-Mail *</span><input name="email" type="email" required maxlength="254" autocomplete="email"></label></div>
    <div class="rr-row"><label class="rr-f"><span>Telefon/WhatsApp (optional)</span><input name="phone" maxlength="40" autocomplete="tel" inputmode="tel"></label><label class="rr-f"><span>PLZ / Ort (optional)</span><input name="plz" maxlength="12" autocomplete="postal-code"></label></div>
    <label class="rr-f"><span>Was möchtest du verkaufen? *</span><select name="kategorie">${cats.map(c => `<option${c===catSel?" selected":""}>${c}</option>`).join("")}</select></label>
    <label class="rr-f"><span>Beschreibung *</span><textarea name="beschreibung" required minlength="10" maxlength="3000" rows="5" placeholder="z. B. Sammlung mit ca. 800 Pokémon-Karten (Deutsch), darunter Glurak-Holo; Zustand gut; Preisvorstellung …"></textarea></label>
    <label class="rr-f"><span>Fotos (bis zu 6 Bilder, je max. 8 MB)</span><input name="fotos[]" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple></label>
    <label class="rr-f rr-chk"><input type="checkbox" name="consent" value="1" required> <span>Ich bin einverstanden, dass perldeals meine Angaben und Fotos zur Bearbeitung der Anfrage per E-Mail erhält (<a href="/datenschutz/">Datenschutz</a>). *</span></label>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn-primary" type="submit">Anfrage kostenlos senden</button>
  </form></section>`; };
function rsPage({path, active, crumb, trail, eyebrow, h1, lead, body, faq = [], title, desc, ld = [], scripts = [], noindex = false}){
  const cr = crumbs("de", trail ? [["Start", R.home.de], ["Reseller", "/reseller/"], ...trail] : crumb ? [["Start", R.home.de], ["Reseller", "/reseller/"], [crumb]] : [["Start", R.home.de], ["Reseller & Sammler"]]);
  const html = `<div class="wrap rs">${cr.html}<div class="feed-head" style="display:block"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(h1)}</h1><p class="lead">${lead}</p></div>${rsNav(active)}</div>
    ${body}
    <div class="wrap">${faq.length ? `<section class="section faq"><h2>Häufige Fragen</h2>${faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>` : ""}${RS_NOTE}</div>`;
  layout({lang:"de", single:true, pathFor:()=>path, title, description:desc, body:html, scripts, noindex, ld:[{"@context":"https://schema.org", ...cr.ld}, ...(faq.length ? [faqLd(faq)] : []), ...ld]});
}
const rsSec = (h, inner, id) => `<section class="wrap section"${id?` id="${id}"`:""}><h2>${h}</h2>${inner}</section>`;
function buildReseller(){
  if (!RS) return;
  const lego = rsDeals("lego"), kons = rsDeals("konsolen"), poke = rsDeals("pokemon"), op = rsDeals("onepiece");
  const nextRel = RS.releases.filter(r => r.date && daysTo(r.date) >= 0).sort((a,b) => a.date.localeCompare(b.date))[0];
  rsPage({path:"/reseller/", active:"hub", eyebrow:`Reseller & Sammler · ${MONTH_DE}`, h1:"Reseller-Deals: Pokémon, One Piece, LEGO EOL & Konsolen",
    lead:`Erscheinungstermine, Rabattaktionen, auslaufende LEGO-Sets und geprüfte Deals mit Ladenpreis, geschätztem Marktwert und möglicher Marge. ${nextRel ? `Nächster Termin: <strong>${esc(nextRel.name.split(" (")[0])}</strong> am ${dayDe(nextRel.date)}.` : ""} <a href="/reseller/black-friday/">🖤 Black Friday 2026 für Reseller</a>`,
    title:`Reseller-Deals ${MONTH_DE}: Pokémon, One Piece, LEGO EOL · perldeals`,
    desc:`Für Reseller und Sammler: Pokémon- und One-Piece-Neuerscheinungen mit Datum und Ladenpreis, LEGO-Sets kurz vor EOL mit Bestpreis und Marge, Rabattaktionen und Deal-Alarm per E-Mail.`,
    body: `<div class="wrap">${rsAlarmBox("reseller-hub")}</div>`
      + rsSec("📅 Nächste Erscheinungstermine", rsReleaseTable(null, 6) + `<p><a href="/reseller/pokemon/">Alle Pokémon-Termine</a> · <a href="/reseller/one-piece/">Alle One-Piece-Termine</a></p>`)
      + (rsOwn().filter(o => o.status === "verfügbar").length ? rsSec("💎 Direkt von perldeals", `<ul class="rs-promos">${rsOwn().filter(o => o.status === "verfügbar").slice(0,3).map(rsOwnCard).join("")}</ul><p><a href="/reseller/angebote/">Alle perldeals-Angebote</a></p>`) : "")
      + rsSec("🏷️ Laufende Rabattaktionen", rsPromoList(null))
      + rsSec("🧱 LEGO kurz vor EOL: höchste geschätzte Marge", rsEolTable(8) + `<p><a href="/reseller/lego-eol/">Alle ${RS.eol.length} auslaufenden Sets</a></p>`)
      + (lego.length ? grid(lego.slice(0,12), "de", "h2", "Aktuelle LEGO-Deals") + rsMetricTable(lego.slice(0,12)) : "")
      + (kons.length ? grid(kons, "de", "h2", "Konsolen-Deals") : "")
      + (poke.length + op.length ? grid(poke.concat(op), "de", "h2", "Sammelkarten-Deals") : "")
      + rsSec("Mehr für Reseller", `<ul class="link-list"><li><a href="/reseller/pokemon-preisindex/"><strong>Pokémon-Preisindex: die teuersten Karten aktueller Sets</strong></a></li><li><a href="/reseller/pokemon-sets/"><strong>Pull-Rates &amp; Erwartungswert aller aktuellen Pokémon-Sets</strong></a></li><li><a href="/reseller/pokemon-haendler/">Pokémon für Händler: Deals &amp; Bewertungs-Leitfaden</a></li><li><a href="/reseller/release-kalender/">Release-Kalender Pokémon &amp; One Piece</a></li><li><a href="/reseller/pokemon-display-kaufen/">Pokémon-Display kaufen</a></li><li><a href="/reseller/top-trainer-box-kaufen/">Pokémon Top-Trainer-Box kaufen</a></li><li><a href="/reseller/one-piece-display-kaufen/">One Piece Display kaufen</a></li><li><a href="/reseller/angebote/">Sammlerware direkt von perldeals</a></li><li><a href="/reseller/karten-ankauf/"><strong>Karten &amp; Retro-Konsolen verkaufen: Ankauf per WhatsApp</strong></a></li>${RS_GUIDES.map(g => `<li><a href="/reseller/ratgeber/${g.slug}/">${esc(g.title)}</a></li>`).join("")}</ul>`),
    faq:[
      ["Was ist der Reseller-Bereich von perldeals?", "Eine Übersicht für Sammler und Wiederverkäufer: Erscheinungstermine von Pokémon- und One-Piece-Karten, Rabattaktionen von Händlern, LEGO-Sets kurz vor dem Produktionsende und geprüfte Deals mit Ladenpreis, geschätztem Marktwert und möglicher Marge."],
      ["Wie funktioniert der Reseller-Deal-Alarm?", "Du wählst deine Themen (Pokémon, One Piece, LEGO, Konsolen oder den allgemeinen Alarm), optional einen Mindestrabatt oder eine Mindestmarge, und bestätigst deine E-Mail-Adresse. Sobald wir einen passenden Deal, Termin oder eine Aktion eintragen, geht innerhalb von etwa 15 Minuten eine E-Mail raus."],
      ["Wie genau sind die Marktwerte?", "Es sind Schätzungen. Bei LEGO rechnen wir mit der UVP plus der typischen Wertsteigerung nach Produktionsende, bei anderen Produkten mit verkauften Angeboten, wenn wir eine Quelle haben. Gebühren, Versand und Steuern sind nicht abgezogen."],
      ["Gibt es Mengenlimits?", "Viele Händler begrenzen Sammelkarten und limitierte Sets auf haushaltsübliche Mengen oder ein bis zwei Stück pro Kunde. Wenn der Händler ein Limit nennt, steht es in der Tabelle."]
    ]});
  const tcgFaq = (name, extra) => [[`Wann erscheint das nächste ${name}-Set?`, (() => { const r = RS.releases.filter(x => x.game === (name === "Pokémon" ? "pokemon" : "onepiece") && x.date && daysTo(x.date) >= 0).sort((a,b)=>a.date.localeCompare(b.date))[0]; return r ? `Als Nächstes erscheint ${r.name.split(" (")[0]} am ${dayDe(r.date)}${r.confirmed ? "" : " (noch nicht offiziell bestätigt)"}.` : "Gerade ist kein neuer Termin bekannt."; })()], ...extra];
  rsPage({path:"/reseller/pokemon/", active:"pokemon", crumb:"Pokémon", eyebrow:"Pokémon-Sammelkarten · Release-Kalender", h1:"Pokémon-Karten Neuerscheinungen 2026/2027: Termine, Preise, Händler",
    lead:"Alle kommenden Pokémon-Sets und Kollektionen mit Erscheinungsdatum, Ladenpreis je Produkt und Händlern, die führen oder vorbestellen lassen. Auch Einladungs-Angebote bei Amazon und Discounter-Aktionen.",
    title:"Pokémon Neuerscheinungen 2026/2027: Release-Termine & Preise · perldeals", desc:"Pokémon-Sammelkarten Release-Kalender: Delta-Herrschaft, 30 Jahre Kollektionen und mehr mit Datum, Ladenpreis (Display, Top-Trainer-Box, Booster) und Händlern wie Pokémon Center, Smyths, Aldi, Amazon.",
    body: akBanner() + `<div class="wrap">${rsAlarmBox("reseller-pokemon", ["pokemon"])}<p class="prose"><a class="more" href="/reseller/pokemon-haendler/">Für Händler: Leitfaden zu Sets, Top-Karten, Zustand, Grading und Fälschungen</a> · <a class="more" href="/reseller/karten-ankauf/">Karten verkaufen: Ankauf</a></p></div>` + rsSec("Release-Kalender", rsReleaseTable("pokemon")) + rsSec("Aktionen mit Pokémon-Karten", rsPromoList("pokemon")) + (poke.length ? grid(poke, "de", "h2", "Pokémon-Deals") + rsMetricTable(poke) : ""),
    faq: tcgFaq("Pokémon", [["Was ist ein Einladungs-Angebot bei Amazon?", "Bei sehr gefragten Produkten verkauft Amazon nur auf Einladung: Du klickst „Einladung anfordern“, und wenn du ausgewählt wirst, hast du 72 Stunden Zeit zum Kaufen. Wir tragen solche Angebote ein, sobald wir davon erfahren."], ["Lohnen sich Displays für Reseller?", "Das hängt stark vom Set ab. Versiegelte Displays beliebter Sets steigen oft nach dem Ende des Drucks, viele Sets fallen aber zunächst unter den Ladenpreis. Achte auf den Einkaufspreis, Gebühren und die Nachfrage auf Cardmarket."]])});
  rsPage({path:"/reseller/one-piece/", active:"onepiece", crumb:"One Piece", eyebrow:"One Piece Card Game · Release-Kalender", h1:"One Piece Kartenspiel: Neuerscheinungen und Release-Termine",
    lead:"Booster, Extra Booster, Starter Decks und Sets des One Piece Card Game mit Termin und Preis. In Deutschland erscheint das Spiel nur auf Englisch.",
    title:"One Piece Card Game Release-Termine 2026: OP-18, EB-05 & mehr · perldeals", desc:"One Piece Kartenspiel Neuerscheinungen: OP-18 The Dominance of God, EB-05 Heroines Edition, Starter Decks ST-37/ST-38 mit Datum, Displaypreis und Händlern in Deutschland.",
    body: `<div class="wrap">${rsAlarmBox("reseller-onepiece", ["onepiece"])}</div>` + rsSec("Release-Kalender", rsReleaseTable("onepiece")) + rsSec("Aktionen", rsPromoList("onepiece")) + (op.length ? grid(op, "de", "h2", "One-Piece-Deals") + rsMetricTable(op) : ""),
    faq: tcgFaq("One Piece", [["Gibt es das One Piece Card Game auf Deutsch?", "Nein. In Europa erscheint das One Piece Card Game auf Englisch, eine deutsche Ausgabe ist nicht angekündigt."]])});
  rsPage({path:"/reseller/lego-eol/", active:"lego", crumb:"LEGO EOL", eyebrow:`LEGO EOL · ${MONTH_DE}`, h1:`LEGO EOL-Liste 2026/2027: auslaufende Sets mit Bestpreis und Marge`,
    lead:`${RS.eol.length} LEGO-Sets, die voraussichtlich Ende 2026 aus dem Sortiment gehen, mit aktuellem Tiefstpreis, Rabatt auf die UVP und geschätzter Marge nach dem Produktionsende.`,
    title:`LEGO EOL-Liste 2026/2027: auslaufende Sets mit Bestpreis · perldeals`, desc:`LEGO-Sets mit Produktionsende 2026: Millennium Falcon, Venator, Technic Volvo EC500 und mehr mit aktuellem Bestpreis, Rabatt in Prozent und geschätzter Marge für Sammler und Reseller.`,
    body: `<div class="wrap">${rsAlarmBox("reseller-lego", ["lego"])}</div>` + rsSec("Auslaufende Sets, sortiert nach geschätzter Marge", rsEolTable()) + rsSec("LEGO-Aktionen", rsPromoList("lego")) + (lego.length ? grid(lego, "de", "h2", "Aktuelle LEGO-Deals") + rsMetricTable(lego) : ""),
    faq:[["Was bedeutet EOL bei LEGO?", "EOL steht für End of Life: LEGO stellt die Produktion eines Sets ein. Danach sinkt das Angebot im Handel, und gefragte Sets werden oft teurer gehandelt."], ["Woher kommen die EOL-Termine?", "Aus der Markierung „Bald nicht mehr erhältlich“ im LEGO-Shop und aus Auswertungen von Fanseiten. LEGO bestätigt die Termine nicht offiziell, sie können sich verschieben."], ["Lohnt sich LEGO als Wertanlage?", "Manche Sets steigen nach dem Produktionsende deutlich, andere kaum. Es gibt kein garantiertes Plus; Lagerung, Gebühren und Versand kosten zusätzlich."]]});
  rsPage({path:"/reseller/konsolen/", active:"konsolen", crumb:"Konsolen", eyebrow:"Konsolen-Deals", h1:"Konsolen-Deals: PlayStation, Nintendo Switch, Xbox",
    lead:"Geprüfte Angebote für Spielkonsolen und Handhelds. Neue Konsolen-Deals bekommst du mit dem Deal-Alarm sofort per E-Mail.",
    title:`Konsolen-Angebote ${MONTH_DE}: PS5, Switch 2, Xbox · perldeals`, desc:"Spielkonsolen im Angebot: PlayStation 5, Nintendo Switch 2, Xbox und Handhelds, geprüft mit Preisverlauf. Mit Deal-Alarm für Reseller und Sammler.",
    body: `<div class="wrap">${rsAlarmBox("reseller-konsolen", ["konsolen"])}</div>` + (kons.length ? grid(kons, "de", "h2", "Aktuelle Konsolen-Deals") + rsMetricTable(kons) : rsSec("Aktuelle Konsolen-Deals", `<p>Gerade gibt es keinen Konsolen-Deal, der unsere Prüfung besteht. Aktiviere den Alarm, dann bekommst du den nächsten sofort.</p>`)) + rsSec("Aktionen", rsPromoList("top")),
    faq:[["Wann gibt es Konsolen am günstigsten?", "Häufig rund um Black Friday (27. November 2026), Cyber Monday, den Prime Day und in Bundles mit Spielen. Neue Konsolen werden zum Start selten günstiger."]]});
  rsPage({path:"/reseller/aktionen/", active:"aktionen", crumb:"Aktionen", eyebrow:"Rabattaktionen · " + MONTH_DE, h1:"Rabattaktionen für Sammler: LEGO, Sammelkarten, Spielwaren",
    lead:"Aktuelle Aktionen bei Müller, Smyths, Kaufland, Aldi, Lidl, Netto und Amazon, zum Beispiel Rabatt auf LEGO, Abverkäufe und Sammelkarten im Discounter.",
    title:`Rabattaktionen ${MONTH_DE}: Müller LEGO, Kaufland, Aldi Pokémon · perldeals`, desc:"Laufende Rabattaktionen für Sammler und Reseller: Müller −20 % auf Spielwaren und LEGO, Smyths LEGO-Rabatt, Kaufland-LEGO-Angebote, Aldi Pokémon-Booster und mehr, mit Zeitraum und Quelle.",
    body: `<div class="wrap">${rsAlarmBox("reseller-aktionen")}</div>` + rsSec("Laufende und angekündigte Aktionen", rsPromoList(null))});
  rsPage({path:"/reseller/alarm/", active:"alarm", crumb:"Deal-Alarm", eyebrow:"Deal-Alarm für Reseller", h1:"Reseller-Deal-Alarm: neue Drops und Deals sofort per E-Mail",
    lead:"Wähle Pokémon, One Piece, LEGO, Konsolen oder den allgemeinen Alarm mit den besten Deals und Aktionen. Optional mit Mindestrabatt oder Mindestmarge. Kostenlos, mit Double-Opt-in und Abmeldelink in jeder E-Mail.",
    title:"Reseller-Deal-Alarm: Pokémon, One Piece, LEGO, Konsolen · perldeals", desc:"Kostenloser Deal-Alarm für Reseller und Sammler: neue Pokémon- und One-Piece-Termine, LEGO-EOL-Deals und Konsolen-Angebote sofort per E-Mail, mit Mindestrabatt und Mindestmarge.",
    body: `<div class="wrap">${rsAlarmBox("reseller-alarm")}<ol class="wa-how"><li><strong>Themen wählen:</strong> Hake an, was dich interessiert. Der allgemeine Alarm schickt dir zusätzlich die stärksten Deals (ab 40 % Rabatt oder Bestpreis) und alle neuen Aktionen.</li><li><strong>Filter setzen:</strong> Mit Mindestrabatt oder Mindestmarge bekommst du nur Deals, die sich für dich lohnen.</li><li><strong>Bestätigen:</strong> Klick auf den Link in der E-Mail. Erst dann ist der Alarm aktiv. Abmelden geht mit einem Klick in jeder E-Mail.</li></ol></div>`});
  buildResellerMore();
}
/* ---- Reseller: Unterseiten für Suche (Termine je Set, LEGO-Set-Seiten, Produktarten, Ratgeber, eigene Angebote) ---- */
const RS_REL_PATH = r => `/reseller/termine/${r.id.replace(/^rel-/, "")}/`;
const RS_EOL_PATH = s => `/reseller/lego-eol/${s.num}/`;

/* Pokémon-Sets (07.11.): Pull-Rates, Top-Karten, Erwartungswert je Set – Daten mit Quellen in src/data/pokemon-sets.json */
const PSETS = fs.existsSync(`${SRC}/data/pokemon-sets.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/pokemon-sets.json`, "utf8")) : null;
const evCalcHtml = (o, id) => `<form class="ev-calc" id="ev-calc">
    <div class="rr-row"><label class="rr-f"><span>Displaypreis (€)</span><input id="ev-price" inputmode="decimal" value=""></label><label class="rr-f"><span>Booster pro Display</span><input id="ev-packs" inputmode="numeric" value="36"></label><label class="rr-f"><span>Wert Rest pro Booster (€)</span><input id="ev-bulk" inputmode="decimal" value="0.20"><small>Bulk, Reverse Holos</small></label></div>
    <table class="ev-tbl"><thead><tr><th>Seltenheit</th><th>Chance 1 zu …</th><th>Ø Wert (€)</th></tr></thead><tbody>
    ${[["Double Rare / ex",o.dr],["Illustration Rare",o.ir],["Ultra Rare",o.ur],["Special Illustration Rare",o.sir],["Mega Hyper Rare",o.mhr]].map(([n,v]) => `<tr><td>${n}</td><td><input inputmode="decimal" data-ev-odds value="${v}"></td><td><input inputmode="decimal" data-ev-val value="" placeholder="z. B. Cardmarket"></td></tr>`).join("")}
    </tbody></table><div class="ev-out" id="ev-out" aria-live="polite"></div></form>`;
const KPREIS = fs.existsSync(`${SRC}/data/kartenpreise.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/kartenpreise.json`, "utf8")) : null;
/* Pokémon-Preisindex: teuerste Karten der aktuellen Sets (Daten: src/data/kartenpreise.json, Datum "researched" immer mitpflegen) */
/* 14.11.: Vollständiger Preisindex aller deutschen Pokémon-Karten (Daten: src/data/pokemon-karten.json, täglich per Workflow karten-preise.yml) */
const PKART = fs.existsSync(`${SRC}/data/pokemon-karten.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/pokemon-karten.json`, "utf8")) : null;
function buildKartenIndex(){
  if (!PKART) return false;
  const P = "/reseller/pokemon-preisindex/";
  const dt = new Date(PKART.updated), st = `${String(dt.getUTCDate()).padStart(2,"0")}.${String(dt.getUTCMonth()+1).padStart(2,"0")}.${dt.getUTCFullYear()}`;
  const eur = v => v == null ? "–" : v.toLocaleString("de-DE", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " €";
  const sets = new Map(PKART.sets.map(s => [s.id, {...s, cards: []}]));
  for (const c of PKART.cards) { const s = sets.get(c[1]); if (s) s.cards.push(c); }
  const price = c => c[5] ?? c[6] ?? null;            // Preistrend, sonst Ø 30 Tage
  const best = c => Math.max(price(c) || 0, c[9] || 0); // inkl. Reverse-Holo
  const slugSet = id => id.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/\./g, "-");
  const setUrl = s => `${P}${slugSet(s.id)}/`;
  const nrSort = (a, b) => { const na = parseInt(a[2], 10), nb = parseInt(b[2], 10); return (isNaN(na) || isNaN(nb)) ? String(a[2]).localeCompare(String(b[2]), "de") : na - nb || String(a[2]).localeCompare(String(b[2])); };
  const allSets = [...sets.values()].filter(s => s.cards.length);
  const withP = PKART.cards.filter(c => best(c) > 0);
  const top = [...withP].sort((a, b) => best(b) - best(a));
  const row = (c, withSet) => { const s = sets.get(c[1]); const rev = c[9] && c[9] > (price(c) || 0) ? ` <span class="note">(Reverse Holo ${eur(c[9])})</span>` : "";
    return `<tr><td data-v="${esc(c[2])}">${esc(c[2])}</td><td><strong>${esc(c[3])}</strong>${rev}</td>${withSet ? `<td><a href="${setUrl(s)}">${esc(s.n)}</a></td>` : ""}<td>${esc(c[4] || "–")}</td><td data-v="${price(c) ?? -1}">${eur(price(c))}</td><td data-v="${c[6] ?? -1}">${eur(c[6])}</td><td data-v="${c[7] ?? -1}">${eur(c[7])}</td><td data-v="${c[8] ?? -1}">${eur(c[8])}</td></tr>`; };
  const head = withSet => `<thead><tr><th data-sort="t">Nr.</th><th data-sort="t">Karte</th>${withSet ? "<th>Set</th>" : ""}<th data-sort="t">Seltenheit</th><th data-sort="n">Preistrend</th><th data-sort="n">Ø 30 Tage</th><th data-sort="n">Ø 7 Tage</th><th data-sort="n">ab</th></tr></thead>`;
  const tbl = (cards, withSet) => `<div class="tbl-wrap"><table class="ev-tbl ps-tbl pi-sort">${head(withSet)}<tbody>${cards.map(c => row(c, withSet)).join("")}</tbody></table></div>`;
  const stand = `<p><strong>Preise vom ${st}</strong> · Cardmarket (Europa, Euro, Karten ohne Grading) über TCGdex · täglich aktualisiert. „Preistrend“ = Cardmarkets gewichteter Marktpreis, „Ø 30 Tage“ = Durchschnitt der Verkäufe der letzten 30 Tage, „ab“ = günstigstes aktuelles Angebot.</p>`;
  const series = [];
  for (const s of allSets.sort((a, b) => (b.r || "").localeCompare(a.r || ""))) { let g = series.find(x => x.id === s.sid); if (!g) { g = {id: s.sid, n: s.s, sets: []}; series.push(g); } g.sets.push(s); }
  const setRow = s => { const t = [...s.cards].sort((a, b) => best(b) - best(a))[0]; const d = s.r ? s.r.split("-").reverse().join(".") : "–";
    return `<tr><td><a href="${setUrl(s)}"><strong>${esc(s.n)}</strong></a></td><td>${d}</td><td>${s.cards.length}</td><td>${t && best(t) ? `${esc(t[3])} (${eur(best(t))})` : "–"}</td></tr>`; };
  const seriesHtml = series.map(g => `<details${g === series[0] ? " open" : ""}><summary><strong>${esc(g.n)}</strong> · ${g.sets.length} Sets · ${g.sets.reduce((n, s) => n + s.cards.length, 0).toLocaleString("de-DE")} Karten</summary><div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>Set</th><th>Erschienen</th><th>Karten</th><th>Teuerste Karte</th></tr></thead><tbody>${g.sets.map(setRow).join("")}</tbody></table></div></details>`).join("");
  const current = series[0];
  const curTop = current ? [...current.sets.flatMap(s => s.cards)].sort((a, b) => best(b) - best(a)).slice(0, 20) : [];
  // Suchindex für die Seitensuche
  fs.mkdirSync(`${OUT}/data`, {recursive: true});
  fs.writeFileSync(`${OUT}/data/pokemon-suche.json`, JSON.stringify(PKART.cards.map(c => [c[3], sets.get(c[1])?.n || c[1], c[2], price(c), slugSet(c[1])])));
  fs.writeFileSync(`${OUT}/assets/preisindex.js`, `(function(){
document.querySelectorAll("table.pi-sort").forEach(function(t){t.querySelectorAll("th[data-sort]").forEach(function(th,i){th.setAttribute("role","button");th.tabIndex=0;th.title="Sortieren";var dir=1;function go(){var b=t.tBodies[0],rows=[].slice.call(b.rows),num=th.dataset.sort==="n",idx=[].indexOf.call(th.parentNode.children,th);rows.sort(function(x,y){var a=x.cells[idx],c=y.cells[idx],av=a.dataset.v!=null?a.dataset.v:a.textContent,cv=c.dataset.v!=null?c.dataset.v:c.textContent;if(num)return (parseFloat(cv)-parseFloat(av))*dir;var na=parseInt(av,10),nc=parseInt(cv,10);if(!isNaN(na)&&!isNaN(nc)&&na!==nc)return (na-nc)*dir;return av.localeCompare(cv,"de")*dir;});rows.forEach(function(r){b.appendChild(r)});dir=-dir;}th.addEventListener("click",go);th.addEventListener("keydown",function(e){if(e.key==="Enter")go()});});});
var inp=document.getElementById("pi-q"),out=document.getElementById("pi-res"),data=null;if(!inp)return;
function fmt(v){return v==null?"–":v.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"}
function show(){var q=inp.value.trim().toLowerCase();if(!data||q.length<2){out.innerHTML="";return}var parts=q.split(/\\s+/),r=[];for(var i=0;i<data.length&&r.length<60;i++){var d=data[i],s=(d[0]+" "+d[1]+" "+d[2]).toLowerCase();if(parts.every(function(p){return s.indexOf(p)>=0}))r.push(d)}r.sort(function(a,b){return (b[3]||0)-(a[3]||0)});out.innerHTML=r.length?'<div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>Karte</th><th>Set</th><th>Nr.</th><th>Preistrend</th></tr></thead><tbody>'+r.map(function(d){return '<tr><td><strong>'+d[0].replace(/</g,"&lt;")+'</strong></td><td><a href="${P}'+d[4]+'/">'+d[1].replace(/</g,"&lt;")+'</a></td><td>'+d[2]+'</td><td>'+fmt(d[3])+'</td></tr>'}).join("")+'</tbody></table></div>':'<p>Keine Karte gefunden.</p>'}
function load(){if(data)return;fetch("/data/pokemon-suche.json").then(function(r){return r.json()}).then(function(j){data=j;show()})}
inp.addEventListener("focus",load);inp.addEventListener("input",function(){load();show()});
})();`);
  const t1 = top[0];
  const faq = [
    ["Was ist die teuerste deutsche Pokémon-Karte auf Cardmarket?", t1 ? `Laut Cardmarket-Preistrend vom ${st}: ${t1[3]} aus ${sets.get(t1[1]).n} (Nr. ${t1[2]}) mit ${eur(best(t1))} ohne Grading.` : "Siehe Tabelle oben."],
    ["Woher stammen die Preise?", "Aus den Cardmarket-Preisdaten, die die offene Kartendatenbank TCGdex täglich bereitstellt. Cardmarket ist der größte Marktplatz für Sammelkarten in Europa; die Preise gelten für deutsche Karten ohne Grading in gutem Zustand."],
    ["Was bedeutet Preistrend und Ø 30 Tage?", "Der Preistrend ist Cardmarkets gewichteter aktueller Marktpreis. Ø 30 Tage ist der Durchschnitt der tatsächlichen Verkäufe der letzten 30 Tage – er zeigt, ob eine Karte gerade teurer oder günstiger wird."],
    ["Wie oft wird der Preisindex aktualisiert?", `Täglich automatisch. Das Datum steht oben auf jeder Seite (zuletzt ${st}).`],
    ["Was bekomme ich, wenn ich meine Karten verkaufe?", "Ankäufer zahlen meist weniger als den Marktpreis, weil Gebühren, Versand und Risiko dazukommen. Der Zustand entscheidet: Kratzer oder weiße Kanten senken den Wert deutlich. Für ein Angebot kannst du uns deine Karten über den Ankauf schicken."]];
  const kpi = `<div class="tbl-wrap"><table class="ev-tbl ps-tbl"><tbody><tr><td>Karten im Index</td><td><strong>${PKART.cards.length.toLocaleString("de-DE")}</strong></td></tr><tr><td>Sets</td><td><strong>${allSets.length}</strong> in ${series.length} Serien</td></tr><tr><td>Karten mit Cardmarket-Preis</td><td><strong>${withP.length.toLocaleString("de-DE")}</strong></td></tr><tr><td>Karten über 100 €</td><td><strong>${withP.filter(c => best(c) >= 100).length.toLocaleString("de-DE")}</strong></td></tr></tbody></table></div>`;
  const curated = KPREIS ? `<h2>PSA 10 &amp; Rekordverkäufe</h2><p>Gegradete Spitzenkarten der aktuellen Sets (US-Markt, Stand ${KPREIS.researched.split("-").reverse().join(".")}) und die teuersten Pokémon-Karten aller Zeiten.</p><div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>Karte</th><th>Set</th><th>Raw</th><th>PSA 10</th></tr></thead><tbody>${KPREIS.sets.flatMap(s => s.cards.filter(c => c[3]).map(c => ({s, c}))).sort((a, b) => b.c[3] - a.c[3]).slice(0, 10).map(x => `<tr><td>${esc(x.c[0])} (${esc(x.c[1])})</td><td>${esc(x.s.de)}</td><td>${x.c[2].toLocaleString("de-DE",{minimumFractionDigits:2})} $</td><td>${x.c[3].toLocaleString("de-DE",{minimumFractionDigits:2})} $</td></tr>`).join("")}</tbody></table></div><div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>Rekord</th><th>Zustand</th><th>Preis</th><th>Wann</th></tr></thead><tbody>${KPREIS.records.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])} (<a href="${esc(r[5][1])}" rel="nofollow noopener" target="_blank">${esc(r[5][0])}</a>)</td></tr>`).join("")}</tbody></table></div>` : "";
  const body = akBanner() + `<div class="wrap legal wissen">${stand}${kpi}
    <h2>Karte suchen</h2><p><label for="pi-q">Name, Set oder Nummer eingeben (z. B. „Glurak“, „Mega-Gengar 284“, „Fatale Flammen“):</label></p><p><input id="pi-q" type="search" class="pi-q" placeholder="Karte suchen …" autocomplete="off"></p><div id="pi-res"></div>
    <h2>Die 50 teuersten deutschen Pokémon-Karten</h2><p>Klick auf eine Spaltenüberschrift sortiert die Tabelle.</p>${tbl(top.slice(0, 50), true)}
    ${current ? `<h2>Top 20 der aktuellen Ära: ${esc(current.n)}</h2>${tbl(curTop, true)}` : ""}
    <h2>Alle Sets mit Preisen</h2><p>Jedes Set hat eine eigene Seite mit allen Karten und Preisen.</p>${seriesHtml}
    ${curated}
    <p><a href="/reseller/karten-ankauf/"><strong>Karten verkaufen: Ankauf anfragen</strong></a> · <a href="/reseller/pokemon-sets/">Pull-Rates</a> · <a href="/reseller/pokemon/">Pokémon-Deals</a> · <a href="/reseller/release-kalender/">Release-Kalender</a></p></div>`;
  rsPage({path:P, active:"pokemon", trail:[["Pokémon-Preisindex"]], eyebrow:`Pokémon-Preisindex · Preise vom ${st}`, h1:"Pokémon-Preisindex: alle deutschen Karten mit Cardmarket-Preis",
    lead:esc(`${PKART.cards.length.toLocaleString("de-DE")} deutsche Pokémon-Karten aus ${allSets.length} Sets mit Preistrend und 30-Tage-Durchschnitt von Cardmarket – Preise vom ${st}, täglich aktualisiert.`),
    title:`Pokémon-Preisindex ${st}: alle deutschen Karten & Preise · perldeals`, desc:`Was ist meine Pokémon-Karte wert? ${PKART.cards.length.toLocaleString("de-DE")} deutsche Karten mit Cardmarket-Preistrend und Ø 30 Tage, Suche nach Name und Set. Stand ${st}.`.slice(0, 158),
    body, faq, scripts:["preisindex.js"], ld:[{"@context":"https://schema.org","@type":"Dataset","name":"Pokémon-Preisindex (deutsche Karten)","inLanguage":"de","dateModified":PKART.updated.slice(0,10),"creator":{"@type":"Organization","name":"perldeals","url":BASE+"/"}}]});
  for (const s of allSets) {
    const cards = [...s.cards].sort(nrSort), tops = [...s.cards].filter(c => best(c) > 0).sort((a, b) => best(b) - best(a)).slice(0, 10);
    const d = s.r ? s.r.split("-").reverse().join(".") : null, sum = s.cards.reduce((n, c) => n + (price(c) || 0), 0);
    const ps = PSETS && PSETS.sets.find(x => x.de === s.n);
    const b = akBanner() + `<div class="wrap legal wissen">${stand}
      <p>${esc(s.s)}${d ? ` · erschienen am ${d}` : ""} · ${s.cards.length} Karten${s.o ? ` (${s.o} reguläre + ${s.cards.length - s.o} Secret/Extra)` : ""} · Summe aller Preistrends: ${eur(Math.round(sum * 100) / 100)}${ps ? ` · <a href="/reseller/pokemon-sets/${ps.slug}/">Pull-Rates &amp; Erwartungswert</a>` : ""}</p>
      ${tops.length ? `<h2>Die 10 teuersten Karten aus ${esc(s.n)}</h2>${tbl(tops, false)}` : ""}
      <h2>Alle ${s.cards.length} Karten aus ${esc(s.n)}</h2><p>Klick auf eine Spaltenüberschrift sortiert die Tabelle (z. B. nach Preis).</p>${tbl(cards, false)}
      <p><a href="${P}"><strong>← Alle Sets im Preisindex</strong></a> · <a href="/reseller/karten-ankauf/">Karten verkaufen</a></p></div>`;
    const t = tops[0];
    rsPage({path:setUrl(s), active:"pokemon", trail:[["Pokémon-Preisindex", P], [s.n]], eyebrow:`Pokémon-Preisindex · ${s.s} · Preise vom ${st}`, h1:`${s.n}: Preise aller ${s.cards.length} Karten`,
      lead:esc(`Was sind die Karten aus ${s.n} wert? Cardmarket-Preistrend, Ø 30 Tage und günstigstes Angebot für jede Karte${t ? ` – teuerste Karte: ${t[3]} (${eur(best(t))})` : ""}. Preise vom ${st}.`),
      title:`${s.n} Preise: alle ${s.cards.length} Pokémon-Karten (${st}) · perldeals`, desc:`${s.n} Kartenpreise: alle ${s.cards.length} Karten mit Cardmarket-Preistrend und Ø 30 Tage${t ? `, teuerste: ${t[3]}` : ""}. Stand ${st}.`.slice(0, 158),
      body:b, scripts:["preisindex.js"]});
  }
  return true;
}

function buildPreisindex(){
  if (buildKartenIndex()) return;
  if (!KPREIS) return;
  const P = "/reseller/pokemon-preisindex/", day = iso => iso.split("-").reverse().join(".");
  const st = day(KPREIS.researched);
  const usd = v => v == null ? "–" : v.toLocaleString("de-DE", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " $";
  const all = KPREIS.sets.flatMap(s => s.cards.map(c => ({s, c}))).sort((a, b) => b.c[2] - a.c[2]);
  const top = all.slice(0, 15);
  const srcLink = s => `<a href="${esc(s.src[1])}" rel="nofollow noopener" target="_blank">${esc(s.src[0])}</a>`;
  const setLink = s => PSETS && PSETS.sets.some(x => x.slug === s.slug) ? `<a href="/reseller/pokemon-sets/${s.slug}/">${esc(s.de)}</a>` : esc(s.de);
  const topTbl = `<div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>#</th><th>Karte</th><th>Set</th><th>Nr.</th><th>Raw (ohne Grading)</th><th>PSA 10</th></tr></thead><tbody>${top.map((x, i) => `<tr><td>${i + 1}</td><td><strong>${esc(x.c[0])}</strong></td><td>${setLink(x.s)} (${esc(x.s.code)})</td><td>${esc(x.c[1])}</td><td>${usd(x.c[2])}</td><td>${usd(x.c[3])}</td></tr>`).join("")}</tbody></table></div>`;
  const eur = v => v == null ? "–" : v.toLocaleString("de-DE", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " €";
  const ext = s => s.cards.some(c => c[4]);
  const extTh = "<th>Ø 30 Tage Cardmarket</th><th>Ø 30 Tage eBay</th><th>Teuerster Verkauf (30 Tage)</th>";
  const extTd = c => { const e = c[4] || {}; return `<td>${e.cm30 != null ? eur(e.cm30) : "–"}</td><td>${e.eb30 != null ? (e.ebCur === "EUR" ? eur(e.eb30) : usd(e.eb30)) : "–"}</td><td>${e.max ? `${e.max[2] === "EUR" ? eur(e.max[0]) : usd(e.max[0])} (${esc(e.max[1])}${e.max[3] ? ", " + esc(e.max[3]) : ""})` : "–"}</td>`; };
  const setTbl = s => s.cards.length ? `<div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>Karte</th><th>Nr.</th><th>Raw (ohne Grading)</th>${s.noPsa ? "" : "<th>PSA 10</th>"}${ext(s) ? extTh : ""}</tr></thead><tbody>${s.cards.map(c => `<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td><td>${usd(c[2])}</td>${s.noPsa ? "" : `<td>${usd(c[3])}</td>`}${ext(s) ? extTd(c) : ""}</tr>`).join("")}</tbody></table></div><p class="note">Quelle: ${srcLink(s)}, Stand ${st}.${s.noPsa ? " Für dieses Set zeigt die Quelle keine PSA-10-Preise." : ""}</p>` : `<p>${esc(s.empty || "Noch keine belastbaren Preise.")}</p>`;
  const recTbl = `<div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>Karte</th><th>Zustand</th><th>Preis</th><th>Wann</th><th>Details</th></tr></thead><tbody>${KPREIS.records.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])} (<a href="${esc(r[5][1])}" rel="nofollow noopener" target="_blank">${esc(r[5][0])}</a>)</td></tr>`).join("")}</tbody></table></div>`;
  const t1 = top[0];
  const faq = [
    ["Was ist die teuerste Karte der aktuellen Pokémon-Sets?", `Laut unserer Recherche vom ${st}: ${t1.c[0]} (${t1.s.de}, Nr. ${t1.c[1]}) mit ${usd(t1.c[2])} ohne Grading und ${usd(t1.c[3])} als PSA 10 (${t1.s.src[0]}).`],
    ["Was ist die teuerste Pokémon-Karte der Welt?", "Die Pikachu Illustrator (PSA 10) wurde im Februar 2026 bei Goldin Auctions für 16.492.000 US-Dollar versteigert – Weltrekord für eine Pokémon-Karte."],
    ["Warum stehen die Preise in US-Dollar?", "Unsere Quellen (PriceCharting mit abgeschlossenen eBay-Verkäufen, TCGplayer) bilden den US-Markt ab und zeigen Dollar. Wir rechnen nicht um, damit keine Schätzwerte entstehen. Auf Cardmarket (Euro) können die Preise deutlich anders sein."],
    ["Wie oft wird der Preisindex aktualisiert?", `Regelmäßig, mindestens einmal pro Woche. Das Datum der letzten Recherche steht oben auf der Seite (zuletzt ${st}).`],
    ["Was bekomme ich, wenn ich meine Karte verkaufe?", "Ankäufer zahlen in der Regel weniger als den Marktpreis, weil Gebühren, Versand und Risiko dazukommen. Der Zustand entscheidet: Schon kleine Kratzer oder weiße Kanten senken den Wert deutlich. Für ein konkretes Angebot kannst du uns deine Karten über den Ankauf schicken."],
    ["Was bedeutet PSA 10?", "PSA ist ein Grading-Dienst, der Karten bewertet und versiegelt. PSA 10 (Gem Mint) ist die Bestnote; solche Karten erzielen oft ein Vielfaches des Raw-Preises."]];
  const body = akBanner() + `<div class="wrap legal wissen">
    <p><strong>Preise zuletzt recherchiert am ${st}.</strong> ${esc(KPREIS.note)}</p>
    <h2>Top 15: die teuersten Karten aus aktuellen Sets</h2>${topTbl}
    ${KPREIS.sets.map(s => `<h2 id="${s.slug}">${esc(s.de)} (${esc(s.en)}, ${esc(s.code)})</h2>${setTbl(s)}`).join("")}
    <h2>Die teuersten Pokémon-Karten aller Zeiten</h2>${recTbl}
    <h2>So liest du den Preisindex</h2><ul>
      <li><strong>Raw</strong> = Karte ohne Grading in sehr gutem Zustand (Near Mint). Gebrauchsspuren senken den Preis oft um die Hälfte oder mehr.</li>
      <li><strong>PSA 10</strong> = von PSA bewertet mit Bestnote. Lohnt sich nur bei perfekt erhaltenen Karten, Grading kostet Geld und Zeit.</li>
      <li>Marktpreise schwanken, besonders kurz nach dem Release eines Sets. Vor einem Kauf oder Verkauf immer die aktuellen Verkäufe auf Cardmarket und eBay prüfen.</li></ul>
    <p><a href="/reseller/karten-ankauf/"><strong>Karten verkaufen: Ankauf anfragen</strong></a> · <a href="/reseller/pokemon-sets/">Pull-Rates aller Sets</a> · <a href="/reseller/pokemon/">Pokémon-Deals</a> · <a href="/reseller/release-kalender/">Release-Kalender</a></p></div>`;
  rsPage({path:P, active:"pokemon", trail:[["Pokémon-Preisindex"]], eyebrow:`Pokémon-Preisindex · Preise vom ${st}`, h1:"Pokémon-Preisindex: die teuersten Karten der aktuellen Sets",
    lead:esc(`Welche Pokémon-Karten sind gerade am meisten wert? Die Top-Karten aller Sets der Mega-Entwicklung-Ära mit Marktpreis ohne Grading und als PSA 10 – Preise zuletzt recherchiert am ${st}.`),
    title:`Pokémon-Preisindex ${st.slice(3)}: teuerste Karten aktueller Sets · perldeals`, desc:`Die teuersten Pokémon-Karten aus Erhabene Helden, Fatale Flammen, Mega-Entwicklung & Co. mit Raw- und PSA-10-Preis. Stand ${st}, mit Quellen.`.slice(0, 158), body, faq,
    ld:[{"@context":"https://schema.org","@type":"Article","headline":"Pokémon-Preisindex","inLanguage":"de","dateModified":KPREIS.researched,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`}}]});
}

function buildPokemonSets(){
  if (!PSETS) return;
  const B = "/reseller/pokemon-sets/", day = iso => iso.split("-").reverse().join(".");
  const rateRow = r => `<tr><td><a href="${esc(r.url)}" rel="nofollow noopener" target="_blank">${esc(r.src)}</a></td>${["dr","ir","ur","sir","mhr"].map(k => `<td>${esc(r[k] || "–")}</td>`).join("")}</tr>`;
  for (const x of PSETS.sets) {
    const path = `${B}${x.slug}/`, deals = sorted.filter(d => new RegExp(x.de.replace(/-/g, "[- ]?"), "i").test(d.title.de)).slice(0, 8);
    const faq = [[`Wann erscheint ${x.de}?`, `${x.de} (englisch: ${x.en}, ${x.code}) ist am ${day(x.releaseDe)} auf Deutsch erschienen.`],
      [`Wie hoch sind die Pull-Rates bei ${x.de}?`, `Laut ${x.rates[0].src}: Special Illustration Rare ${x.rates[0].sir}, Mega Hyper Rare ${x.rates[0].mhr} pro Booster. Offizielle Werte veröffentlicht Pokémon nicht.`],
      [`Was sind die teuersten Karten in ${x.de}?`, x.chase.map(c => c[0] + (c[1] ? ` (${c[1]})` : "")).join(", ") + "."],
      [`Lohnt es sich, ${x.de}-Displays zu öffnen?`, x.ev ? `Geschätzter Erwartungswert: ${x.ev}. Ob sich das Öffnen lohnt, hängt vom Einkaufspreis ab – rechne es mit dem EV-Rechner auf dieser Seite nach.` : `Für eine verlässliche Schätzung gibt es noch zu wenig Daten. Rechne mit dem EV-Rechner auf dieser Seite und aktuellen Cardmarket-Preisen nach.`]];
    const body = `<div class="wrap legal wissen">
      <p><strong>Kurz:</strong> ${esc(x.de)} (${esc(x.en)}, ${esc(x.code)}) ist am ${day(x.releaseDe)} erschienen. ${x.rates[0] ? `Pro Booster liegt die Chance auf eine Special Illustration Rare bei ${esc(x.rates[0].sir)}, auf eine Mega Hyper Rare bei ${esc(x.rates[0].mhr)} (${esc(x.rates[0].src)}).` : ""}${x.ev ? ` Erwartungswert: ${esc(x.ev)}.` : ""}</p>
      ${x.releaseNote ? `<p>${esc(x.releaseNote)}</p>` : ""}
      <h2>Produkte</h2><ul><li><strong>Display:</strong> ${esc(x.display)}${x.displaySrc ? ` (<a href="${esc(x.displaySrc[1])}" rel="nofollow noopener" target="_blank">Quelle</a>)` : ""}</li>${x.ttb ? `<li><strong>Weitere Produkte:</strong> ${esc(x.ttb)}</li>` : ""}</ul>
      <h2>Pull-Rates pro Booster</h2><div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>Quelle</th><th>Double Rare</th><th>Illustration Rare</th><th>Ultra Rare</th><th>SIR</th><th>Mega Hyper Rare</th></tr></thead><tbody>${x.rates.map(rateRow).join("")}</tbody></table></div>
      ${x.rates.some(r => r.extra) ? `<p>${x.rates.filter(r => r.extra).map(r => `${esc(r.src)}: ${esc(r.extra)}`).join(" · ")}</p>` : ""}
      ${x.rateWarn ? `<p class="note">${esc(x.rateWarn)}</p>` : ""}
      <p>${x.rates.length > 1 ? "Die Quellen weichen voneinander ab – das ist bei Zählungen aus Community-Öffnungen normal. " : ""}${esc(PSETS.note)}</p>
      <h2>Top-Karten (Chase Cards)</h2><ul>${x.chase.map(c => `<li><strong>${esc(c[0])}</strong>${c[1] ? ` – ${esc(c[1])}` : ""}${c[2] ? `: ${esc(c[2])}` : ""}</li>`).join("")}</ul>
      ${x.chaseNote ? `<p>${esc(x.chaseNote)}${x.chaseSrc ? ` Quelle: <a href="${esc(x.chaseSrc[1])}" rel="nofollow noopener" target="_blank">${esc(x.chaseSrc[0])}</a>.` : ""}</p>` : ""}
      <h2>Was man pro Display realistisch erwarten kann</h2><p>${x.odds.sir ? `Bei einer Chance von etwa 1 zu ${String(x.odds.sir).replace(".", ",")} enthält ein 36er-Display in rund ${Math.round((1 - Math.pow(1 - 1 / x.odds.sir, 36)) * 100)} % der Fälle mindestens eine Special Illustration Rare.` : ""}${x.odds.mhr ? ` Eine Mega Hyper Rare steckt nur in etwa ${Math.round((1 - Math.pow(1 - 1 / x.odds.mhr, 36)) * 100)} % der Displays.` : ""} Wie der Erwartungswert funktioniert und wann sich Öffnen lohnt, erklärt unser Ratgeber <a href="/reseller/ratgeber/booster-oeffnen-oder-versiegelt-erwartungswert/">Booster öffnen oder versiegelt verkaufen?</a></p>
      <h2>EV-Rechner für ${esc(x.de)}</h2><p>Die Chancen sind mit den Werten oben vorbelegt. Trage den Displaypreis und die aktuellen Durchschnittspreise (z. B. Cardmarket) ein.</p>${evCalcHtml(x.odds)}
      <h2>Weitere Pokémon-Sets</h2><ul class="link-list">${PSETS.sets.filter(y => y !== x).map(y => `<li><a href="${B}${y.slug}/">${esc(y.de)} Pull-Rates (${esc(y.code)})</a></li>`).join("")}</ul>
      <p><a href="/reseller/pokemon/">Aktuelle Pokémon-Deals für Sammler und Reseller</a> · <a href="/reseller/release-kalender/">Release-Kalender</a> · <a href="/reseller/pokemon-preisindex/#${x.slug}">Preise der Top-Karten (Preisindex)</a> · <a href="/reseller/karten-ankauf/">Karten verkaufen</a></p></div>
      ${deals.length ? `<div class="wrap">${grid(deals, "de", "h2", `Aktuelle Angebote: ${x.de}`)}</div>` : ""}`;
    rsPage({path, active:"pokemon", trail:[["Pokémon-Sets", B], [x.de]], eyebrow:`Pokémon-Set ${x.code} · Stand ${day(PSETS.updated)}`, h1:`${x.de} Pull-Rates: Chancen, Top-Karten & Erwartungswert`, lead:esc(`${x.de} (${x.en}) im Überblick: Wie oft ziehst du eine Special Illustration Rare, was sind die teuersten Karten und lohnt sich ein Display?`),
      title:`${x.de} Pull-Rates, Top-Karten & EV (${x.en}) · perldeals`, desc:`${x.de} (${x.en}, ${x.code}): Pull-Rates pro Booster (SIR ${x.rates[0].sir}), teuerste Karten, Erwartungswert pro Display und EV-Rechner. Mit Quellen.`.slice(0, 158), body, faq,
      ld:[{"@context":"https://schema.org","@type":"Article","headline":`${x.de} Pull-Rates`,"inLanguage":"de","dateModified":PSETS.updated,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`}}]});
  }
  rsPage({path:B, active:"pokemon", trail:[["Pokémon-Sets"]], eyebrow:`Pokémon-Sets · Stand ${day(PSETS.updated)}`, h1:"Pokémon-Sets 2025/2026: Pull-Rates, Top-Karten & Erwartungswert", lead:"Alle aktuellen Sets der Mega-Entwicklung-Ära mit Chancen pro Booster, teuersten Karten und Erwartungswert – mit Quellen.",
    title:"Pokémon Pull-Rates 2026: alle Sets mit Chancen & Erwartungswert · perldeals", desc:"Pull-Rates aller aktuellen Pokémon-Sets (Delta-Herrschaft, Dunkelnacht, Wachsendes Chaos, Optimale Ordnung, Erhabene Helden, Fatale Flammen, Mega-Entwicklung): SIR-Chance, Top-Karten, EV.",
    body:`<div class="wrap legal wissen"><div class="tbl-wrap"><table class="ev-tbl ps-tbl"><thead><tr><th>Set</th><th>Erschienen</th><th>SIR pro Booster</th><th>Mega Hyper Rare</th></tr></thead><tbody>${PSETS.sets.map(x => `<tr><td><a href="${B}${x.slug}/"><strong>${esc(x.de)}</strong></a><br><small>${esc(x.en)} · ${esc(x.code)}</small></td><td>${day(x.releaseDe)}</td><td>${esc(x.rates[0].sir)}</td><td>${esc(x.rates[0].mhr)}</td></tr>`).join("")}</tbody></table></div><p class="note">${esc(PSETS.note)} Je Set nennen wir die Quelle mit Stichprobe; weichen Quellen ab, zeigen wir beide.</p><p>Wann sich das Öffnen lohnt: <a href="/reseller/ratgeber/booster-oeffnen-oder-versiegelt-erwartungswert/">Booster öffnen oder versiegelt verkaufen? (mit EV-Rechner)</a></p></div>`,
    faq:[["Welches Pokémon-Set hat die besten Pull-Rates?","Gemessen an der Chance auf eine Special Illustration Rare liegen die Spezialsets wie Erhabene Helden und die frühen Zählungen zu Delta-Herrschaft vorn; bei Delta-Herrschaft ist die Stichprobe aber noch sehr klein. Entscheidend ist am Ende der Erwartungswert, also Chancen mal Kartenwerte."],["Woher stammen die Pull-Rates?","Pokémon veröffentlicht keine offiziellen Werte. Die Zahlen stammen aus Zählungen großer Händler und Communities (z. B. TCGplayer, TCGTalk, PokéZentrum). Wir nennen bei jedem Set die Quelle und die Stichprobe."]]});
}
const RS_GUIDES = [
  {slug:"booster-oeffnen-oder-versiegelt-erwartungswert", title:"Booster öffnen oder versiegelt verkaufen? Erwartungswert (EV) von Displays berechnen", desc:"Lohnt sich das Öffnen von Pokémon-Displays? So berechnest du den Erwartungswert, was du pro Display realistisch ziehst und wie du aus geöffneten Packs das Maximum holst – mit Rechner.",
   lead:"Viele Displays sind versiegelt mehr wert als ihr Inhalt im Durchschnitt. Hier siehst du, wie man den Erwartungswert (EV) berechnet, was man pro Display realistisch erwarten kann und wann sich das Öffnen trotzdem lohnt.",
   sections:[
    ["Kurze Antwort", ["Im Durchschnitt verliert man beim Öffnen meistens Geld: Der Erwartungswert der Karten liegt bei vielen aktuellen Sets unter dem Displaypreis. Für das englische Mega-Evolution-Set schätzt PokemonPriceTracker den Erwartungswert eines 36er-Displays Anfang 2026 auf rund 133 US-Dollar – bei Marktpreisen von etwa 155 bis 180 US-Dollar für das Display. Wer Gewinn will, verkauft versiegelt oder öffnet nur, wenn er das Display deutlich günstiger gekauft hat oder einen Mehrwert durch Live-Openings und Einzelverkauf schafft."]],
    ["Was ist der Erwartungswert (EV)?", ["Der Erwartungswert ist der durchschnittliche Wert, den ein Booster oder Display bei sehr vielen Öffnungen bringt. Rechnung: Für jede Seltenheit Wahrscheinlichkeit pro Booster × durchschnittlicher Verkaufswert, alles addieren, dann mal Anzahl Booster. Dazu kommt der Wert der übrigen Karten (Bulk, Reverse Holos).", "Wichtig: Der EV ist ein Durchschnitt. Ein einzelnes Display kann deutlich darüber oder darunter liegen – siehe Abschnitt „Was man pro Display realistisch erwarten kann“."]],
    ["Pull-Rates am Beispiel Mega Evolution", ["Laut Auswertung von über 5.000 englischen Packs (TCGplayer-Daten, zusammengefasst von PokemonPriceTracker) gelten für das Set Mega Evolution ungefähr diese Chancen pro Booster: Double Rare etwa 1 zu 5, Illustration Rare etwa 1 zu 9, Ultra Rare etwa 1 zu 12, Special Illustration Rare (SIR) etwa 1 zu 101 und Mega Hyper Rare etwa 1 zu 1.260.", "Für ein 36er-Display ergibt das im Schnitt etwa 7 Double Rares, 4 Illustration Rares, 3 Ultra Rares und 0,36 Special Illustration Rares. Deutsche Displays haben dieselbe Seltenheitsstruktur; belastbare Zählungen für deutsche Drucke gibt es aber kaum. Andere Sets haben andere Raten – vor dem Kauf immer die Werte des konkreten Sets nachschlagen."]],
    ["Was man pro Display realistisch erwarten kann", ["Mit einer Chance von etwa 1 zu 101 pro Booster enthält ein 36er-Display nur in rund 30 % der Fälle mindestens eine Special Illustration Rare – in etwa 70 % der Displays ist keine dabei. Eine Mega Hyper Rare (etwa 1 zu 1.260) steckt nur in knapp 3 % der Displays.", "Genau diese Streuung macht das Öffnen zum Glücksspiel: Der Durchschnitt wird von wenigen sehr teuren Karten getragen. Ohne Top-Hit bleibt vom Display oft nur ein Bruchteil des Kaufpreises übrig."]],
    ["Warum versiegelt meist mehr bringt", ["Versiegelte Displays sind sofort verkäuflich, haben keine Streuung und steigen bei begehrten Sets nach dem Druckende oft im Wert. Beim Öffnen kommen dagegen Arbeit (sortieren, einstellen, versenden), Gebühren pro Einzelverkauf und Versandkosten dazu. Bei vielen günstigen Karten fressen Gebühren und Porto einen großen Teil des Werts auf.", "Dazu passt unser Vergleich der Verkaufsgebühren (/reseller/pokemon-haendler/verkaufen-gebuehren/) und der Reseller-Rechner (/reseller/rechner/)."]],
    ["Wann sich Öffnen trotzdem lohnen kann", ["Wenn du das Display deutlich unter Marktpreis eingekauft hast (z. B. über einen echten Deal), sinkt die Schwelle, ab der du Gewinn machst.", "Bei Live-Openings und Breaks zahlen Zuschauer für das Erlebnis – das kann mehr bringen als der reine Kartenwert.", "Wenn du Sammler bist und bestimmte Karten ohnehin willst, ist der Einzelkauf der Wunschkarte aber fast immer günstiger als das Ziehen."]],
    ["So holst du das Maximum aus geöffneten Packs", ["Hits sofort in Hülle und Toploader stecken, Zentrierung und Kanten prüfen. Wertvolle Karten einzeln anbieten und Preise mit Cardmarket und verkauften eBay-Angeboten vergleichen. Günstige Karten nicht einzeln verschicken, sondern als Lots oder Bulk verkaufen. Grading lohnt sich meist nur bei Karten, deren Wert deutlich über den Grading-Kosten liegt und die praktisch makellos sind.", "Ruhige Hände bei Hypes: Kurz nach Release fallen die Preise vieler Karten oft, weil viele Displays gleichzeitig geöffnet werden. Wer nicht sofort verkaufen muss, wartet ab.", "Sammlung oder Restbestände loswerden? Unser Ankauf macht dir ein kostenloses Angebot (/reseller/karten-ankauf/)."]]
   ],
   extra:`<h2>EV-Rechner: Lohnt sich dieses Display?</h2><p>Trage deine Werte ein – am besten mit aktuellen Preisen von Cardmarket. Vorbelegt sind die Chancen für Mega Evolution und Durchschnittswerte, die wir aus der EV-Schätzung von PokemonPriceTracker (Anfang 2026, US-Markt) grob in Euro umgerechnet haben – ersetze sie durch aktuelle Preise deines Sets.</p>
   <form class="ev-calc" id="ev-calc">
    <div class="rr-row"><label class="rr-f"><span>Displaypreis (€)</span><input id="ev-price" inputmode="decimal" value="150"></label><label class="rr-f"><span>Booster pro Display</span><input id="ev-packs" inputmode="numeric" value="36"></label><label class="rr-f"><span>Wert Rest pro Booster (€)</span><input id="ev-bulk" inputmode="decimal" value="0.20"><small>Bulk, Reverse Holos</small></label></div>
    <table class="ev-tbl"><thead><tr><th>Seltenheit</th><th>Chance 1 zu …</th><th>Ø Wert (€)</th></tr></thead><tbody>
     <tr><td>Double Rare</td><td><input inputmode="decimal" data-ev-odds value="5"></td><td><input inputmode="decimal" data-ev-val value="1.80"></td></tr>
     <tr><td>Illustration Rare</td><td><input inputmode="decimal" data-ev-odds value="9"></td><td><input inputmode="decimal" data-ev-val value="5.40"></td></tr>
     <tr><td>Ultra Rare</td><td><input inputmode="decimal" data-ev-odds value="12"></td><td><input inputmode="decimal" data-ev-val value="5.70"></td></tr>
     <tr><td>Special Illustration Rare</td><td><input inputmode="decimal" data-ev-odds value="101"></td><td><input inputmode="decimal" data-ev-val value="85"></td></tr>
     <tr><td>Mega Hyper Rare</td><td><input inputmode="decimal" data-ev-odds value="1260"></td><td><input inputmode="decimal" data-ev-val value="890"></td></tr>
    </tbody></table>
    <div class="ev-out" id="ev-out" aria-live="polite"></div>
   </form><p class="note">Der Rechner zeigt den Durchschnitt über viele Displays. Ein einzelnes Display kann stark abweichen. Gebühren und Versand beim Einzelverkauf sind nicht eingerechnet.</p>`,
   sources:[["PokemonPriceTracker: Mega Evolution Pull Rates & EV Guide 2026","https://www.pokemonpricetracker.com/blog/posts/mega-evolution-set-pull-rates-ev-guide-2026"]],
   faq:[["Lohnt es sich, Pokémon-Displays zu öffnen?","Im Durchschnitt meist nicht: Bei vielen Sets liegt der Erwartungswert der Karten unter dem Displaypreis. Öffnen lohnt sich eher, wenn du deutlich unter Marktpreis eingekauft hast oder über Live-Openings zusätzlichen Wert schaffst."],["Wie oft ist eine Special Illustration Rare in einem Display?","Bei einer Chance von etwa 1 zu 101 pro Booster (Mega Evolution) enthält ein 36er-Display nur in rund 30 % der Fälle mindestens eine SIR."],["Wie berechne ich den Erwartungswert?","Für jede Seltenheit Chance pro Booster mal Durchschnittswert, alles addieren, plus Wert der übrigen Karten, dann mal Anzahl der Booster. Unser EV-Rechner oben macht das automatisch."]]},
  {slug:"pokemon-produkte-erklaert", title:"Pokémon-Produkte erklärt: Booster, Display, Top-Trainer-Box, Blister", desc:"Was steckt in Booster, Display, Top-Trainer-Box, Boosterbundle, Blister und Kollektionen? Unterschiede, Inhalt und worauf Sammler und Reseller achten.",
   lead:"Wer Pokémon-Karten kauft, steht vor vielen Verpackungen. Hier siehst du, was in welcher steckt und welche für Sammler und Wiederverkäufer interessant sind.",
   sections:[
    ["Booster", ["Ein Booster ist die kleinste Einheit: ein Päckchen mit zufälligen Karten eines Sets. Bei aktuellen Sets sind es zehn Karten plus Energie- und Codekarte. Booster gibt es einzeln, im Blister oder in größeren Boxen."]],
    ["Display", ["Ein Display ist der versiegelte Karton mit mehreren Boostern desselben Sets, bei Pokémon meist 36 Stück, bei manchen Spezial-Sets weniger. Displays sind bei Sammlern beliebt, weil sie versiegelt gut lagerbar sind und pro Booster oft günstiger als Einzelbooster."]],
    ["Top-Trainer-Box (Elite Trainer Box)", ["Die Top-Trainer-Box enthält mehrere Booster (bei Delta-Herrschaft neun), eine Promokarte, Kartenhüllen, Energiekarten, Würfel und eine stabile Box. Vom Pokémon Center gibt es oft eine eigene Version mit zwei zusätzlichen Boostern und gestempelter Promokarte."]],
    ["Boosterbundle, Blister und Kollektionen", ["Ein Boosterbundle bündelt meist sechs Booster ohne Zubehör. Blister enthalten ein bis drei Booster und oft eine Promokarte. Kollektionen und Premium-Kollektionen kombinieren Booster mit Promokarten, Figuren oder Ordnern."]],
    ["Was ist für Reseller interessant?", ["Gefragt sind vor allem versiegelte Displays und Top-Trainer-Boxen beliebter Sets, exklusive Händlerversionen und Produkte mit begrenzter Auflage. Entscheidend ist der Einkaufspreis: Viele Sets fallen nach dem Erscheinen zunächst unter den Ladenpreis. Achte deshalb auf Rabattaktionen und Termine."]]],
   faq:[["Wie viele Booster hat ein Pokémon-Display?","Meist 36 Booster. Einige Spezial-Sets erscheinen ohne Display oder mit kleineren Boxen."],["Was ist der Unterschied zwischen Top-Trainer-Box und Pokémon-Center-Version?","Die Pokémon-Center-Version enthält zusätzliche Booster und eine gestempelte Promokarte und wird nur dort verkauft."]]},
  {slug:"amazon-einladungs-angebote", title:"Amazon Einladungs-Angebote: So bekommst du limitierte Produkte", desc:"Wie funktionieren Einladungs-Angebote bei Amazon? Einladung anfordern, 72 Stunden Kaufzeit, welche Produkte betroffen sind und wie du keine Einladung verpasst.",
   lead:"Bei sehr gefragten Produkten wie neuen Pokémon-Boxen oder Konsolen verkauft Amazon manchmal nur auf Einladung. So läuft das ab.",
   sections:[
    ["So funktioniert es", ["Auf der Produktseite steht statt „In den Einkaufswagen“ der Button „Einladung anfordern“. Amazon wählt aus den Anfragen Käufer aus. Wer ausgewählt wird, bekommt eine Nachricht und hat dann 72 Stunden Zeit, das Produkt zum angezeigten Preis zu kaufen."]],
    ["Tipps", ["Fordere die Einladung früh an, sie bleibt laut Amazon bis zu zwölf Monate gültig. Aktiviere Benachrichtigungen in der Amazon-App, damit du das 72-Stunden-Fenster nicht verpasst. Eine Einladung garantiert keinen Kauf, und Amazon kann die Menge pro Kunde begrenzen."]],
    ["Bei perldeals", ["Sobald wir von einem Einladungs-Angebot für Sammelkarten, LEGO oder Konsolen erfahren, tragen wir es bei den Aktionen ein. Mit dem Reseller-Deal-Alarm bekommst du dann eine E-Mail."]]],
   faq:[["Wie lange habe ich nach der Einladung Zeit?","72 Stunden ab der Benachrichtigung."],["Kostet die Einladung etwas?","Nein, die Anfrage ist kostenlos und unverbindlich."]]},
  {slug:"lego-eol-wertsteigerung", title:"LEGO EOL: Was passiert, wenn Sets auslaufen, und lohnt sich das?", desc:"LEGO End of Life erklärt: woran du auslaufende Sets erkennst, wie sich Preise nach dem EOL entwickeln und worauf du beim Einkauf zum Wiederverkauf achten solltest.",
   lead:"Jedes LEGO-Set wird irgendwann nicht mehr produziert. Danach verschwindet es aus dem Handel, und gefragte Sets werden oft teurer gehandelt.",
   sections:[
    ["Woran erkenne ich auslaufende Sets?", ["Im LEGO-Shop steht bei Sets kurz vor dem Ende der Hinweis „Bald nicht mehr erhältlich“. Fanseiten werten diese Hinweise aus und schätzen den Termin. Offiziell bestätigt LEGO EOL-Termine nicht, sie können sich verschieben."]],
    ["Wie entwickeln sich die Preise?", ["Kurz vor dem EOL räumen viele Händler ab, die Preise fallen oft auf den Tiefstand. Danach steigt der Preis versiegelter Sets im Mittel; eine Auswertung von Brickfact nennt rund 22 % Median-Wertsteigerung zwölf Monate nach EOL. Einzelne Sets steigen deutlich stärker, andere kaum oder gar nicht."]],
    ["Worauf Reseller achten sollten", ["Einkaufspreis klar unter UVP, versiegelte Verpackung ohne Schäden, trockene Lagerung ohne Sonne. Rechne Gebühren, Versand, Lagerkosten und Steuern ein. Große Sets binden viel Kapital und Platz, kleine Sets mit beliebten Figuren verkaufen sich oft schneller."]]],
   faq:[["Was bedeutet EOL bei LEGO?","End of Life: LEGO stellt die Produktion eines Sets ein."],["Steigen alle LEGO-Sets nach dem EOL im Wert?","Nein. Im Mittel ja, aber viele Sets bleiben nahe der UVP. Es gibt keine Garantie."]]},
  {slug:"reselling-steuern-gewerbe", title:"Reselling und Steuern: Ab wann ist der Wiederverkauf ein Gewerbe?", desc:"Sammelkarten, LEGO und Konsolen weiterverkaufen: Wann wird es gewerblich, was meldet eBay ans Finanzamt (30 Verkäufe oder 2.000 €) und was gilt für private Verkäufe?",
   lead:"Wer regelmäßig einkauft, um mit Gewinn weiterzuverkaufen, handelt schnell gewerblich. Hier die wichtigsten Punkte im Überblick. Das ersetzt keine Steuerberatung.",
   sections:[
    ["Privat oder gewerblich?", ["Gewerblich ist der Verkauf in der Regel, wenn du planmäßig und wiederholt Ware einkaufst, um sie mit Gewinn weiterzuverkaufen. Dann brauchst du eine Gewerbeanmeldung, und Gewinne sind einkommensteuerpflichtig. Als Händler gelten zudem Pflichten wie Impressum, Widerrufsbelehrung und Gewährleistung."]],
    ["Meldungen der Plattformen", ["Seit 2023 melden Plattformen wie eBay, Kleinanzeigen und Cardmarket Verkäufer an das Bundeszentralamt für Steuern, wenn sie im Jahr mehr als 30 Verkäufe oder mehr als 2.000 € Erlös haben (Plattformen-Steuertransparenzgesetz). Die Meldung selbst bedeutet noch keine Steuerpflicht, macht Verkäufe aber sichtbar."]],
    ["Private Verkäufe", ["Verkaufst du privat Dinge, die du weniger als ein Jahr besessen hast, kann ein privates Veräußerungsgeschäft vorliegen. Gewinne daraus sind steuerfrei, solange sie im Jahr insgesamt unter 1.000 € bleiben (Freigrenze seit 2024). Gegenstände des täglichen Gebrauchs sind ausgenommen; ob Sammlerstücke dazugehören, ist umstritten."]],
    ["Unser Rat", ["Führe eine einfache Liste mit Einkaufspreis, Verkaufspreis, Gebühren und Datum. Bei regelmäßigem Handel frag einen Steuerberater, bevor das Finanzamt fragt."]]],
   faq:[["Ab wie vielen Verkäufen meldet eBay ans Finanzamt?","Ab 30 Verkäufen oder mehr als 2.000 € Erlös im Kalenderjahr."],["Muss ich als Reseller ein Gewerbe anmelden?","Wenn du regelmäßig mit Gewinnabsicht einkaufst und weiterverkaufst, in der Regel ja. Im Zweifel klärt das ein Steuerberater."]]},
  {slug:"sammelkarten-versiegelt-lagern-verkaufen", title:"Sammelkarten und LEGO versiegelt lagern und verkaufen: 10 Tipps", desc:"So lagerst du Displays, Top-Trainer-Boxen und LEGO-Sets richtig, schützt die Verpackung und verkaufst später zum besten Preis.",
   lead:"Der Wert versiegelter Ware hängt stark vom Zustand der Verpackung ab. Mit diesen Tipps bleibt sie verkaufsfähig.",
   sections:[
    ["Lagerung", ["Trocken, dunkel und bei normaler Zimmertemperatur lagern, nicht im Keller oder auf dem Dachboden. Kein direktes Sonnenlicht, das bleicht Kartons aus. Displays und Boxen aufrecht oder flach stapeln, nicht zu hoch, damit nichts eindrückt. Für teure Boxen gibt es passende Acrylhüllen."]],
    ["Vor dem Verkauf", ["Folie und Siegel auf Risse prüfen und ehrlich beschreiben. Gute, echte Fotos von allen Seiten machen. Marktpreise vergleichen: bei Karten etwa auf Cardmarket, bei LEGO über verkaufte Angebote bei eBay."]],
    ["Versand", ["Doppelt verpacken, mit Polsterung an allen Seiten. Teure Ware versichert versenden. Bei Sammelkarten-Displays hilft ein stabiler Umkarton gegen Eckenschäden."]]],
   faq:[["Wie lagere ich Pokémon-Displays richtig?","Trocken, dunkel, bei Zimmertemperatur und geschützt vor Druck und Sonnenlicht."]]}
  ,{slug:"sammelkarten-zubehoer", title:"Sammelkarten-Zubehör: Hüllen, Toploader, Ordner und Versand richtig wählen", desc:"Welche Kartenhüllen, Toploader, Sammelordner und Boxen brauchst du für Pokémon-, One-Piece- und Yu-Gi-Oh-Karten? Größen, Unterschiede und eine Einkaufsliste für Sammler und Reseller.",
   lead:"Eine Karte verliert ihren Wert schon durch einen kleinen Knick oder Kratzer. Mit dem richtigen Zubehör schützt du Sammlung und Verkaufsware für wenig Geld. Hier siehst du, was du wirklich brauchst und worauf du beim Kauf achtest.",
   sections:[
    ["Die richtige Größe", ["Pokémon-, One-Piece- und Magic-Karten haben das Standardformat von etwa 63 × 88 mm. Dafür passen „Standard“-Hüllen (meist 66 × 91 mm). Yu-Gi-Oh-Karten sind kleiner (etwa 59 × 86 mm) und brauchen „Small“- oder „Japanese“-Hüllen. Kaufst du die falsche Größe, rutschen Karten heraus oder biegen sich."]],
    ["Hüllen (Sleeves): die erste Schutzschicht", ["Jede Karte mit Wert gehört sofort in eine Hülle. Günstige „Penny Sleeves“ reichen für die Sammlung und den Versand. Für wertvolle Karten nimmst du zusätzlich eine eng anliegende „Perfect Fit“-Innenhülle und darüber eine normale Hülle (Double-Sleeving). Achte auf säurefreie Hüllen ohne PVC, sonst können Karten mit der Zeit Schaden nehmen."]],
    ["Toploader und Semi-Rigid-Hüllen", ["Toploader sind feste Kunststoffhüllen, in die die Karte samt Sleeve geschoben wird. Für normale Karten passt die übliche Stärke (35 pt). Für das Einschicken zum Grading nutzen viele Sammler halbfeste Hüllen wie Card Saver, weil die Grading-Firmen die Karten daraus leichter entnehmen können. Für besonders wertvolle Karten gibt es magnetische One-Touch-Hüllen."]],
    ["Sammelordner und Boxen", ["Für die Sammlung eignen sich Ordner mit 9er-Seiten, bei denen die Karten seitlich eingesteckt werden (Side-Loading), damit nichts herausfällt. Ordner mit Reißverschluss schützen zusätzlich vor Staub. Ringordner mit Klarsichtfolien drücken auf die Karten am Ring, deshalb lieber gebundene Ordner. Für Verkaufsware und Doppelte sind stabile Kartenboxen (Storage Boxes) praktisch."]],
    ["Versiegelte Ware schützen", ["Displays, Top-Trainer-Boxen und Boosterbundles verlieren an Wert, wenn Ecken eingedrückt oder Folien beschädigt sind. Passende Acryl- oder Kunststoffschutzhüllen (Acrylic Cases) halten Staub und Druck ab. Lagere alles trocken, dunkel und bei Zimmertemperatur."]],
    ["Versandmaterial", ["Einzelkarten verschickst du in Sleeve plus Toploader, mit Klebeband verschlossen, zwischen zwei Pappstücken in einem Luftpolsterumschlag. Teure Karten gehören in ein Paket mit Sendungsverfolgung. Mehr dazu im Ratgeber Sammelkarten richtig versenden (/wissen/sammelkarten-versenden/)."]],
    ["Wo du sparst und wo nicht", ["Bei Penny Sleeves und Kartenboxen kannst du ruhig günstige Marken nehmen. Bei Toploadern, Perfect-Fit-Hüllen und Ordnern lohnen sich bekannte Hersteller, weil billige Ware oft zu eng, zu weich oder schief geschnitten ist. Kaufe Zubehör in größeren Packungen, das senkt den Stückpreis deutlich."]]],
   products:[
    ["Penny Sleeves (Standardgröße)", "Günstige Grundhülle für jede Karte mit Wert, auch für den Versand.", "penny sleeves sammelkarten standard", "/assets/illu/zub-1.svg"],
    ["Perfect-Fit-Innenhüllen", "Eng anliegende Innenhülle für wertvolle Karten (Double-Sleeving).", "perfect fit sleeves standard", "/assets/illu/zub-2.svg"],
    ["Toploader 35 pt (3 × 4 Zoll)", "Feste Hülle für einzelne Karten, Standard beim Versand.", "toploader 35pt sammelkarten", "/assets/illu/zub-3.svg"],
    ["Card Saver / Semi-Rigid-Hüllen", "Halbfeste Hüllen, die beim Einschicken zum Grading genutzt werden.", "card saver 1 semi rigid", "/assets/illu/zub-4.svg"],
    ["Magnetische One-Touch-Hüllen", "Für besonders wertvolle Karten zum Ausstellen.", "magnetic card holder 35pt one touch", "/assets/illu/zub-5.svg"],
    ["Sammelordner 9-Pocket mit Reißverschluss", "Side-Loading-Taschen, staubgeschützt, kein Ring-Druck.", "sammelkarten ordner 9 pocket reißverschluss side loading", "/assets/illu/zub-6.svg"],
    ["Kartenbox (Storage Box)", "Für Doppelte, Verkaufsware und Bulk.", "sammelkarten aufbewahrungsbox 800", "/assets/illu/zub-7.svg"],
    ["Acryl-Schutzbox für Top-Trainer-Box", "Schützt versiegelte Boxen vor Druck und Staub.", "acryl case elite trainer box", "/assets/illu/zub-8.svg"],
    ["Luftpolsterumschläge", "Für den Versand von Einzelkarten im Toploader.", "luftpolsterumschlag c6", "/assets/illu/zub-9.svg"]],
   faq:[["Welche Hüllengröße brauche ich für Pokémon-Karten?","Standardgröße, meist 66 × 91 mm für die normale Hülle und etwas kleiner für Perfect-Fit-Innenhüllen. Yu-Gi-Oh-Karten brauchen kleinere Hüllen."],["Brauche ich Toploader?","Für wertvolle Karten und den Versand ja: Sleeve plus Toploader schützt vor Knicken."],["Welche Hülle nutzt man fürs Grading?","Viele Sammler schicken Karten in halbfesten Hüllen wie Card Saver ein, weil die Grading-Firmen sie daraus leicht entnehmen können. Prüfe die aktuellen Vorgaben des Anbieters."],["Sind Ringordner schlecht für Karten?","Ringordner können Karten in der Nähe der Ringe eindrücken. Gebundene Ordner mit seitlich eingesteckten Karten sind schonender."]]}
  ,{slug:"reseller-ausruestung", title:"Reseller-Ausrüstung: Was du zum Verkaufen auf eBay, Kleinanzeigen und Cardmarket brauchst", desc:"Versandmaterial, Paketwaage, Etikettendrucker, Fotolicht und Lager: die Grundausstattung für Reseller und Sammler, die regelmäßig verkaufen. Mit Einkaufsliste.",
   lead:"Wer regelmäßig verkauft, spart mit der richtigen Ausrüstung viel Zeit und Ärger: weniger Transportschäden, bessere Fotos, schnellerer Versand. Hier ist die Grundausstattung, die sich schnell bezahlt macht.",
   sections:[
    ["Versand: Material auf Vorrat", ["Kartons in zwei, drei Standardgrößen, Luftpolsterumschläge, Füllmaterial und gutes Klebeband sparen dir den Weg zum Laden bei jedem Verkauf. Kartons sollten so groß sein, dass rundum Polsterung passt. Versiegelte Sammlerware immer doppelt verpacken."]],
    ["Paketwaage", ["Mit einer kleinen Paketwaage wählst du das richtige Porto und vermeidest Nachporto. Für Briefe reicht eine Briefwaage, für Pakete eine Waage bis 30 bis 50 kg."]],
    ["Etikettendrucker", ["Wer viele Pakete verschickt, spart mit einem Thermo-Etikettendrucker Zeit und Druckerpatronen. Die Versandlabels von DHL, Hermes und Co. lassen sich als Etikett ausdrucken und direkt aufkleben."]],
    ["Gute Fotos verkaufen besser", ["Ehrliche, scharfe Fotos bei gleichmäßigem Licht verkaufen schneller und verhindern Streit. Eine kleine Fotobox mit LED-Licht oder zwei Tageslichtlampen reichen. Bei Karten unbedingt Vorder- und Rückseite sowie Ecken zeigen."]],
    ["Lager und Übersicht", ["Stabile Regale, beschriftete Boxen und eine einfache Liste (Tabelle) mit Einkaufspreis, Datum und Lagerort helfen dir, den Überblick und deine Marge zu behalten. Den Verkaufspreis nach Gebühren berechnest du mit unserem Reseller-Rechner (/reseller/rechner/)."]],
    ["Steuern und Gewerbe im Blick", ["Wer regelmäßig mit Gewinnabsicht verkauft, handelt in der Regel gewerblich. Plattformen melden an das Bundeszentralamt für Steuern, wenn du im Jahr mehr als 30 Verkäufe oder mehr als 2.000 € Umsatz hast. Details im Ratgeber Reselling und Steuern (/reseller/ratgeber/reselling-steuern-gewerbe/). Das ist keine Steuerberatung."]]],
   products:[
    ["Paketwaage bis 40 kg", "Richtiges Porto, kein Nachporto.", "paketwaage digital 40kg", "/assets/illu/aus-1.svg"],
    ["Thermo-Etikettendrucker", "Versandlabels ohne Tinte direkt drucken.", "thermo etikettendrucker versandetiketten 100x150", "/assets/illu/aus-2.svg"],
    ["Versandkartons im Set", "Standardgrößen auf Vorrat.", "versandkartons set klein mittel", "/assets/illu/aus-3.svg"],
    ["Luftpolsterfolie und Füllmaterial", "Polsterung rundum gegen Transportschäden.", "luftpolsterfolie rolle", "/assets/illu/aus-4.svg"],
    ["Packband mit Abroller", "Schnell und sicher verschließen.", "packband abroller set", "/assets/illu/aus-5.svg"],
    ["Fotobox mit LED-Licht", "Gleichmäßige, ehrliche Produktfotos.", "fotobox led faltbar produktfotografie", "/assets/illu/aus-6.svg"],
    ["Schwerlastregal", "Ordnung im Lager, Ware geschützt vom Boden.", "schwerlastregal 180x90", "/assets/illu/aus-7.svg"]],
   faq:[["Was brauche ich als Reseller zuerst?","Versandmaterial auf Vorrat, eine Paketwaage und gutes Licht für Fotos. Der Rest lohnt sich, wenn du regelmäßig verkaufst."],["Lohnt sich ein Etikettendrucker?","Ab etwa ein paar Paketen pro Woche spart er Zeit und Druckkosten."],["Wie verpacke ich versiegelte Displays?","Doppelt: stabiler Innenkarton oder Schutzhülle, Polsterung rundum, fester Außenkarton."]]},
{slug:"ebay-verkaufsgebuehren-privat-gewerblich", title:"eBay-Verkaufsgebühren 2026: privat vs. gewerblich für Karten, Spiele, Konsolen und LEGO", desc:"Was kostet Verkaufen bei eBay.de 2026? Gebühren für private und gewerbliche Verkäufer bei Sammelkarten, Videospielen, Konsolen und Spielzeug – mit Rechenbeispielen und Quellen.",
   lead:"Privat ist Verkaufen bei eBay.de innerhalb Deutschlands kostenlos, gewerblich zahlst du Provision je Kategorie. Hier stehen die Sätze für die typischen Reseller-Kategorien laut eBay-Hilfe (Stand November 2026) und was am Ende übrig bleibt.",
   sections:[
    ["Kurze Antwort", ["Private Verkäufer zahlen laut eBay-Hilfe (Stand November 2026) für Verkäufe innerhalb Deutschlands keine Verkaufsprovision. Gewerbliche Verkäufer zahlen eine prozentuale Provision je Kategorie plus eine feste Gebühr pro Bestellung: 0,35 €, bei Bestellungen über 10 € 0,45 €.", "Welche Gruppe für dich gilt, entscheidet nicht die Plattform, sondern wie du verkaufst: Wer regelmäßig mit Gewinnabsicht einkauft und weiterverkauft, ist in der Regel gewerblich unterwegs. Mehr dazu im Ratgeber Reselling und Steuern (/reseller/ratgeber/reselling-steuern-gewerbe/)."]],
    ["Gebühren für private Verkäufer", ["Laut eBay-Hilfe (Stand November 2026) sind pro Monat 320 Angebote kostenlos, danach kostet jedes weitere Angebot 0,50 €. Zusätzlich gibt es ein Kontingent von 2.500 kostenlosen Auktionsangeboten pro Monat, für das eBay eigene Bedingungen nennt (unter anderem sind Auktionen mit 1 oder 3 Tagen Laufzeit ausgenommen).", "Kosten entstehen bei Zusatzoptionen: Galerie Plus 0,75 €, Untertitel 0,50 €, ein Mindestpreis kostet 3 % des Mindestpreises (höchstens 150 €), auch wenn der Artikel nicht verkauft wird. Bis zu 24 Fotos, Preisvorschlag und Sofort-Kaufen bei Auktionen sind kostenlos.", "Achtung beim Auslandsversand: Wer selbst ins Ausland verschickt (nicht über eBay Internationaler Versand bzw. eBay-Versand), zahlt laut eBay 5 % des Gesamtbetrags. Für Verkäufer mit deutscher Adresse fällt bei Währungsumrechnung 3 % an, ab dem 2. Dezember 2026 laut eBay 3,25 %."]],
    ["Gebühren für gewerbliche Verkäufer in Reseller-Kategorien", ["Die folgenden Sätze stehen in der eBay-Gebührenübersicht für gewerbliche Verkäufer (Stand November 2026) und gelten für Verkäufer mit Top-Bewertung oder überdurchschnittlichem Servicestatus:", "Trading Cards und Sammelkartenspiele (TCGs), also auch Pokémon, One Piece und Yu-Gi-Oh: 11 % bis 990 € Verkaufspreis, 3 % auf den Anteil darüber. Modellbau: ebenfalls 11 % bis 990 €, 3 % darüber.", "PC- und Videospiele: 12 % bis 990 €, 3 % darüber. Zubehör für PC und Videospiele: 12 %, bei bestimmten Artikelzuständen 5 %.", "Konsolen: 7 %, bei bestimmten Artikelzuständen 5 %. Den niedrigeren Satz nennt eBay unter anderem für „Gebraucht“, „Gebraucht – Hervorragend/Gut/Akzeptabel“, „Neu: Sonstige“ und Refurbished-Zustände. Laut Onlinemarktplatz.de gelten diese Pauschalsätze in Technik-Kategorien seit dem 1. Juli 2026.", "Spielzeug (darunter LEGO): Den genauen Satz für deine Unterkategorie prüfst du am besten direkt in der Gebührentabelle von eBay, bevor du kalkulierst – die Sätze unterscheiden sich je nach Kategorie.", "Ohne eBay-Shop kosten gewerbliche Angebote laut eBay 0,35 € (Festpreis) bzw. 0,50 € (Auktion). Bei Servicestatus „Unterdurchschnittlich“ gelten höhere Sätze; hält der Status vier Monate in Folge an, steigen die Provisionen laut eBay um einen weiteren Prozentpunkt."]],
    ["Rechenbeispiele (gewerblich, vereinfacht)", ["Die Beispiele rechnen nur mit dem Artikelpreis und den Sätzen oben (Stand November 2026); Versand, Werbung und Zusatzoptionen sind nicht enthalten.", "Gebrauchtes Videospiel für 40 €: 12 % = 4,80 € plus 0,45 € fixe Gebühr = 5,25 € Gebühren.", "Gebrauchte Konsole für 200 € im Zustand „Gebraucht“: 5 % = 10,00 € plus 0,45 € = 10,45 €.", "Sammelkarte für 1.200 €: 11 % auf 990 € = 108,90 € plus 3 % auf 210 € = 6,30 € plus 0,45 € = 115,65 €.", "Für die Gesamtrechnung mit Einkaufspreis und Versand hilft der Reseller-Rechner (/reseller/rechner/)."]],
    ["Meldegrenze für Plattformen", ["Unabhängig von den Gebühren melden Plattformen wie eBay Verkäufer an das Finanzamt, sobald im Jahr auf derselben Plattform 30 Verkäufe oder 2.000 € Einnahmen erreicht werden – nur wer beide Grenzen unterschreitet, wird grundsätzlich nicht gemeldet (Finanzamt NRW zum Plattformen-Steuertransparenzgesetz, Stand November 2026). Eine Meldung ist kein Steuerbescheid, und unter der Grenze zu bleiben befreit nicht von der Steuer. Das ersetzt keine Steuerberatung."]],
    ["Gebühren sparen oder ganz vermeiden", ["Bei vielen günstigen Artikeln fressen Fixgebühr, Porto und Verpackung einen großen Teil des Erlöses. Lots und Sammelangebote sind dann oft sinnvoller als Einzelverkäufe.", "Wer keine Lust auf Einstellen, Fragen beantworten und Versand hat: perldeals kauft Sammelkarten, LEGO, Videospiele und Retro-Konsolen an – ohne Plattformgebühren. Übersicht und kostenloses Angebot: /reseller/ankauf/"]]
   ],
   sources:[["eBay-Hilfe: Gebühren für gewerbliche Verkäufer","https://www.ebay.de/help/selling/fees-credits-invoices/gebhren-fr-gewerbliche-verkufer?id=4122"],["eBay-Hilfe: Gebühren für private Verkäufer","https://www.ebay.de/help/selling/fees-credits-invoices/selling-fees-managed-payments-sellers-without-ebay-store?id=4822"],["eBay-Hilfe: Verkaufsprovision bei Servicestatus unterdurchschnittlich","https://www.ebay.de/help/selling/fees-credits-invoices/verkaufsprovision-bei-servicestatus-unterdurchschnittlich?id=5103"],["Onlinemarktplatz.de: Neue eBay-Gebühren für gewerbliche Verkäufer ab 1. Juli 2026","https://onlinemarktplatz.de/267961/neue-ebay-gebuehren-fuer-gewebliche-verkaeufer-ab-1-juli-2026/"],["Finanzamt NRW: Plattformen-Steuertransparenzgesetz","https://finanzamt.nrw.de/steuerinfos/unternehmen/plattformen-steuertransparenzgesetz"]],
   faq:[["Ist Verkaufen bei eBay für Privatleute kostenlos?","Ja, innerhalb Deutschlands zahlen private Verkäufer laut eBay-Hilfe (Stand November 2026) keine Verkaufsprovision. Kosten entstehen nur bei Zusatzoptionen, mehr als 320 Angeboten im Monat oder selbst organisiertem Auslandsversand."],["Wie hoch ist die eBay-Provision für Sammelkarten gewerblich?","Laut eBay 11 % bis 990 € Verkaufspreis und 3 % auf den Anteil darüber, plus 0,35 € bzw. 0,45 € fixe Gebühr pro Bestellung (Stand November 2026)."],["Was kostet der Verkauf einer gebrauchten Konsole gewerblich?","Konsolen haben seit Juli 2026 einen Satz von 7 %, bei gebrauchten oder refurbished Zuständen 5 %, plus fixe Gebühr pro Bestellung."]]},
  {slug:"retro-spiele-repros-erkennen", title:"Retro-Spiele: Fälschungen und Repros erkennen bei Game Boy, GBA, SNES und N64", desc:"Gefälschte Game-Boy-, GBA-, SNES- und N64-Module erkennen: Schrauben, Etikett, Rückseite, Platine und Speicherbatterie prüfen – Checkliste vor dem Kauf.",
   lead:"Nachgemachte Module (Repros) sind bei beliebten Retro-Spielen weit verbreitet, besonders bei Pokémon-Editionen für Game Boy und GBA. Mit diesen Prüfungen erkennst du die meisten Fälschungen, oft schon ohne das Modul zu öffnen.",
   sections:[
    ["Warum Repros ein Problem sind", ["Repros sehen auf Fotos oft echt aus, haben aber für Sammler kaum Wert. Häufig speichern sie schlecht oder gar nicht. Wer ein Repro als Original kauft oder weiterverkauft, verliert Geld oder bekommt Ärger mit dem Käufer. Die Faustregel aller Prüfungen: Ein einzelnes Merkmal ist ein Hinweis, mehrere Auffälligkeiten zusammen sind ein klares Warnsignal. Alle Angaben unten stammen aus den genannten Quellen (Stand November 2026)."]],
    ["Game Boy und Game Boy Color: außen prüfen", ["Rückseite: Originale tragen laut Epilogue (Hersteller des GB Operator) das Nintendo-Logo und/oder „Made in Japan“. Fehlender Schriftzug, falscher Text oder fremde Hinweise sind Warnzeichen.", "Schraube: Originale Game-Boy- und Game-Boy-Color-Module haben unten eine Sicherheitsschraube, für die man einen 3,8-mm-Bit braucht (Epilogue, remysharp.com). Andere Schraubentypen oder eine andere Position deuten auf ein Repro hin.", "Etikett: Farben mit Fotos sicherer Originale vergleichen, auf Rechtschreibfehler und unscharfen Druck achten. Originaletiketten tragen laut Epilogue einen eingeprägten zweistelligen Code. Fehlt er, ist das ein Hinweis – aber kein Beweis, denn auch Originale können ein Ersatzetikett haben.", "Gehäuse: zu glänzender oder zu matter Kunststoff, ein ungewöhnliches Gewicht oder ein Ausschnitt unten im Gehäuse (für billigere Platinen) sind typische Repro-Merkmale."]],
    ["Game Boy Advance", ["GBA-Module werden laut Epilogue mit Tri-Wing-Schrauben verschlossen. Auch hier gilt: Rückseite mit Nintendo-Schriftzug, saubere Etikettfarben, kein fremder Text.", "Bei Pokémon Rubin, Saphir, Smaragd, Feuerrot und Blattgrün ist der Anteil an Fälschungen besonders hoch. Ein Preis deutlich unter verkauften Vergleichsangeboten ist allein schon ein Grund, genauer hinzusehen."]],
    ["SNES: Schrauben, Codes und Platine", ["Laut The Old School Game Vault sind originale Nintendo-Sicherheitsschrauben sauber rund, gefälschte wirken ausgestanzt und kantig. Originale Rücketiketten tragen einen eingeprägten Code aus zwei bis drei Zeichen; bei Fälschungen fehlt er oder ist kaum sichtbar.", "Innen sind bei Originalen über und unter dem Steckkontakt Codes ins Gehäuse eingegossen. Die Platine trägt „Nintendo“ und eine Jahreszahl und füllt den Großteil des Gehäuses aus – Fälschungen nutzen oft deutlich kleinere Platinen.", "Spiele mit Speicherstand wie EarthBound, Chrono Trigger oder Zelda haben im Original eine aufgelötete Knopfzelle im Format CR2032. Fehlt sie, ist das Modul laut derselben Quelle eine Fälschung."]],
    ["N64 und Module von innen", ["Für N64-, NES- und GBA-Module funktioniert laut The Old School Game Vault ebenfalls die Prüfung der eingegossenen Codes innen im Gehäuse. Beim Öffnen von Game-Boy- und GBA-Modulen nennt Epilogue weitere klare Fälschungsmerkmale: schwarze Epoxid-Tropfen statt Chips (bei Originalen sehr selten), gestapelte Platinen, Aufkleber im Inneren, zurechtgeschnittene Platinen, Löcher in den Kontakten und ein falsch geschriebenes „Nintendo“ auf der Platine.", "Öffnen nur mit passendem Werkzeug (3,8-mm-Bit für GB/GBC und SNES/N64, Tri-Wing für GBA), damit Schrauben und Gehäuse nicht beschädigt werden."]],
    ["Vor dem Kauf: Checkliste für Online-Angebote", ["Fotos von Vorder- und Rückseite und möglichst vom Etikett im Streiflicht verlangen. Preis mit abgeschlossenen Verkäufen vergleichen, nicht mit Angebotspreisen. Bei teuren Modulen um ein Foto der Platine bitten. Mit Käuferschutz zahlen. Ein fast neuwertiges Modul eines über 30 Jahre alten Spiels ist laut The Old School Game Vault ebenfalls ein Grund für Misstrauen."]],
    ["Retro-Spiele verkaufen statt prüfen", ["Du hast eine Kiste alter Module und willst nicht jedes einzeln prüfen und einstellen? perldeals kauft Retro-Spiele und Konsolen an und prüft die Echtheit selbst. Fotos schicken und kostenloses Angebot bekommen: /reseller/ankauf/videospiele/ und /reseller/ankauf/retro-konsolen/"]]
   ],
   sources:[["Epilogue: Spotting fakes (Game Boy, GBC, GBA)","https://www.epilogue.co/support/cartridges/spotting-fakes"],["Remy Sharp: How to quickly spot a fake Game Boy cartridge","https://remysharp.com/2023/01/04/how-to-quickly-spot-a-fake-game-boy-cartridge"],["The Old School Game Vault: SNES Games Real vs Fake","https://theoldschoolgamevault.com/blog/articles/how-to-spot-counterfeit-super-nintendo-games-snes"]],
   faq:[["Wie erkenne ich ein gefälschtes Game-Boy-Spiel?","Rückseite (Nintendo-Logo, „Made in Japan“), Sicherheitsschraube mit 3,8-mm-Bit, Etikettfarben und eingeprägter Code sowie Gehäuseform prüfen. Im Zweifel die Platine ansehen: Epoxid-Tropfen, gestapelte Platinen oder Aufkleber innen sind typische Repro-Merkmale."],["Speichern Repros?","Oft schlecht oder gar nicht. Ein Spiel, das nicht speichert, ist aber nicht automatisch ein Repro: Bei Originalen kann die Speicherbatterie leer sein."],["Was ist ein Repro?","Ein nachgebautes Modul mit kopierter Software und nachgedrucktem Etikett. Für Sammler hat es kaum Wert und darf nicht als Original verkauft werden."]]},
  {slug:"retro-spiele-zustand-cib-speicherbatterie", title:"Retro-Spiele bewerten: Loose, CIB, Neu und die Speicherbatterie prüfen", desc:"Was bedeuten Loose, CIB und Neu bei Retro-Spielen? So beschreibst du Zustand und Vollständigkeit richtig, vergleichst Preise passend und prüfst die Speicherbatterie im Modul.",
   lead:"Bei Retro-Spielen bestimmt vor allem die Vollständigkeit den Preis: Modul allein, mit Verpackung und Anleitung oder noch versiegelt. Hier die gängigen Begriffe, wie du Preise richtig vergleichst und warum du die Speicherbatterie testen solltest.",
   sections:[
    ["Die Begriffe: Loose, CIB, Neu", ["Die Preisdatenbank PriceCharting definiert (Stand November 2026): Loose ist das Modul oder die Disc allein, ohne weiteres Zubehör. Complete (CIB, „Complete in Box“) bedeutet Modul bzw. Disc mit Originalverpackung und Originalanleitung. Brand New heißt Spiel, Verpackung und Anleitung in der originalen Werksversiegelung. Graded steht für ein neues Spiel, das von einer Bewertungsagentur wie VGA benotet wurde.", "Daneben gibt es „Box Only“ (nur Verpackung) und „Manual Only“ (nur Anleitung). Diese Teile werden einzeln gehandelt, weil viele Sammler ihre Loose-Spiele zu CIB vervollständigen wollen."]],
    ["Preise richtig vergleichen", ["PriceCharting erfasst laut eigener FAQ verkaufte Spiele auf eBay und dem eigenen Marktplatz und bildet daraus einen Wert pro Spiel und Zustand. Vergleiche deshalb immer genau denselben Zustand: Ein Loose-Preis ist kein Maßstab für ein CIB-Spiel und umgekehrt.", "Für den deutschen Markt zusätzlich abgeschlossene Verkäufe bei eBay.de (Filter „Verkaufte Artikel“) ansehen. Wichtig ist auch die Region: PAL-Versionen (Europa) und NTSC-Versionen (USA, Japan) haben eigene Preise und Käufergruppen."]],
    ["Zustand ehrlich beschreiben", ["Beim Modul: Etikett (Risse, Verfärbungen, Aufkleber, Beschriftung), Gehäuse (Kratzer, Vergilbung) und Kontakte (Korrosion, Schmutz). Bei Verpackungen: Knicke, Risse, Eindrücke, fehlende Laschen, Preisaufkleber. Bei der Anleitung: Vollständigkeit, Knicke, Flecken. Auch Beilagen wie Poster, Karten oder Einleger gehören zu „vollständig“.", "Wer ehrlich und mit Fotos jedes Teils beschreibt, vermeidet Rücksendungen und schlechte Bewertungen."]],
    ["Speicherbatterie: der unterschätzte Wertfaktor", ["Viele ältere Module speichern Spielstände mit einer aufgelöteten Knopfzelle. Bei Game-Boy- und Game-Boy-Color-Modulen wird dafür meist der Typ CR2025 genannt, bei SNES-Spielen wie EarthBound, Chrono Trigger oder Zelda eine Zelle im Format CR2032 (iFixit-Community, The Old School Game Vault). Diese Batterien halten nicht ewig, und viele Module sind Jahrzehnte alt. Laut iFixit-Diskussion entleeren Pokémon Gold und Silber ihre Batterie wegen der eingebauten Uhr schneller.", "Typisches Symptom: Das Spiel läuft, aber der Spielstand ist nach dem Aus- und Einschalten weg. So testest du: Neues Spiel starten, speichern, Konsole ausschalten, nach einigen Minuten wieder einschalten und prüfen, ob der Spielstand noch da ist. Eine reine Spannungsmessung reicht laut iFixit-Diskussion nicht als Beweis.", "Der Austausch ist möglich, erfordert aber Löten und einen 3,8-mm-Bit zum Öffnen. Im Angebot solltest du angeben, ob das Spiel speichert oder die Batterie getauscht wurde."]],
    ["Echt oder Repro?", ["Bevor du Zustand und Preis bewertest, lohnt der Echtheits-Check, denn Repros sind bei beliebten Titeln weit verbreitet. Alle Prüfungen findest du im Ratgeber Retro-Spiele: Fälschungen und Repros erkennen (/reseller/ratgeber/retro-spiele-repros-erkennen/)."]],
    ["Spiele und Konsolen verkaufen", ["perldeals kauft Retro-Spiele loose, komplett oder versiegelt sowie Retro-Konsolen an. Schick Fotos von Modul, Verpackung und Anleitung und du bekommst ein kostenloses Angebot: /reseller/ankauf/videospiele/ und /reseller/ankauf/retro-konsolen/"]]
   ],
   sources:[["PriceCharting: FAQ und Zustandsdefinitionen","https://www.pricecharting.com/faq"],["PriceCharting: Methodik","https://www.pricecharting.com/page/methodology"],["iFixit Answers: Why won't my game save (Game Boy)","https://www.ifixit.com/Answers/View/323213/Why+won't+my+game+save"],["The Old School Game Vault: SNES Games Real vs Fake","https://theoldschoolgamevault.com/blog/articles/how-to-spot-counterfeit-super-nintendo-games-snes"]],
   faq:[["Was bedeutet CIB bei Videospielen?","Complete in Box: Modul oder Disc mit Originalverpackung und Originalanleitung, so definiert es zum Beispiel PriceCharting."],["Was bedeutet Loose?","Nur das Modul oder die Disc, ohne Verpackung und Anleitung."],["Warum speichert mein altes Game-Boy-Spiel nicht mehr?","Meist ist die aufgelötete Speicherbatterie leer. Sie lässt sich mit Lötkolben und passendem Werkzeug tauschen."]]},
  {slug:"lego-gebraucht-vollstaendigkeit-pruefen", title:"Gebrauchtes LEGO auf Vollständigkeit prüfen: Teilelisten, BrickLink und Rebrickable", desc:"So prüfst du gebrauchte LEGO-Sets auf Vollständigkeit: Setnummer finden, Teileliste bei BrickLink oder Rebrickable nutzen, Minifiguren prüfen und fehlende Teile nachkaufen.",
   lead:"Ob ein gebrauchtes LEGO-Set als „100 % vollständig“ oder „unvollständig“ verkauft wird, macht beim Preis einen großen Unterschied. Mit Teileliste und System ist die Prüfung auch bei großen Sets machbar.",
   sections:[
    ["1. Setnummer bestimmen", ["Die Setnummer steht auf Karton und Anleitung. Fehlen beide, helfen markante Teile, Minifiguren und Sticker: Über die Kataloge von BrickLink, Brickset oder Rebrickable findest du über Thema und Jahr das passende Set. Ohne Setnummer gibt es keine verlässliche Teileliste."]],
    ["2. Teileliste (Inventar) holen", ["BrickLink, der zur LEGO-Gruppe gehörende Marktplatz, führt zu fast jedem Set ein Inventar. Nach den BrickLink-Standards zählen Minifiguren als eigene Positionen; ihre Einzelteile stehen nicht in der normalen Teileliste. Ersatzteile, die LEGO zusätzlich in den Beutel legt, werden als Extra-Teile geführt. Anleitungen sind nicht Teil des Inventars, sondern werden beim „Part Out“ automatisch ergänzt.", "Rebrickable zeigt ebenfalls Teilelisten und kann laut Brickset mit der eigenen Sammlung abgleichen, ob du ein Set aus deinen Teilen bauen kannst und welche Teile fehlen."]],
    ["3. Sortieren und abhaken", ["Am schnellsten geht es nach Farbe, dann nach Form. Danach Position für Position mit der Teileliste vergleichen. Alternativ das Set nach Anleitung aufbauen: Das dauert länger, zeigt aber sicher, ob alles da ist und ob Teile beschädigt sind.", "Achte auf Teile mit Aufdruck und Sticker, verfärbte oder gebrochene Teile und Fremdteile anderer Hersteller. Extra-Teile fehlen bei gebrauchten Sets oft – das ist kein Mangel, sollte aber im Angebot stehen."]],
    ["4. Minifiguren, Anleitung und Karton", ["Minifiguren sind bei vielen Sets der wichtigste Wertfaktor: Kopf, Torso, Beine, Haare oder Helm und Zubehör prüfen. Fehlt eine Figur, sinkt der Wert meist deutlich stärker als bei einem fehlenden Standardstein.", "Anleitung und Karton beschreibst du getrennt: Ein vollständiges Set mit Anleitung, aber ohne Karton, ist für viele Käufer völlig in Ordnung, solange das klar im Angebot steht."]],
    ["5. Fehlende Teile nachkaufen", ["Für Teile, die in einem neu gekauften Set fehlen oder beschädigt sind, bietet LEGO einen Ersatzteilservice. Laut brickfact.com (Stand November 2026) gilt der kostenlose Ersatz für berechtigte Reklamationen bei neuen Sets, nicht für gebraucht oder unvollständig gekaufte Sets.", "Für gebrauchte Sets bleibt der Kauf: bei LEGO über Pick a Brick, sofern das Teil noch angeboten wird, oder bei BrickLink über einzelne Händler. Bei BrickLink lohnt laut brickfact.com eine „Wanted List“ und der Blick auf Mindestbestellwert und Versandkosten je Händler. Rechne vorher nach, ob sich das Nachkaufen gegenüber dem Verkauf als „unvollständig“ lohnt."]],
    ["6. Richtig im Angebot beschreiben", ["„Vollständig laut BrickLink-Inventar, inkl. aller Minifiguren und Anleitung, ohne Karton“ ist eine klare, prüfbare Angabe. Fehlende Teile mit Anzahl und Art nennen, statt nur „fast vollständig“ zu schreiben. Preise vergleichst du über abgeschlossene Verkäufe bei eBay und den Preisführer von BrickLink."]],
    ["Keine Lust aufs Zählen?", ["perldeals kauft LEGO an – vollständige Sets, versiegelte Sets und auch gemischte Kisten. Fotos schicken, kostenloses Angebot bekommen: /reseller/ankauf/lego/"]]
   ],
   sources:[["BrickLink: Standards for Inventorying a Set","https://www.bricklink.com/help.asp?helpID=199"],["Brickset: Tutorial – Synchronising your collection with Rebrickable","https://brickset.com/article/26571/tutorial-synchronising-your-collection-with-rebrickable"],["brickfact: LEGO-Steine nachbestellen – Anbieter-Vergleich","https://brickfact.com/de-de/blog/ratgeber/lego-steine-nachbestellen-der-anbieter-vergleich"],["Brick Fanatics: LEGO Customer Service offers bricks for sale again","https://www.brickfanatics.com/lego-customer-service-offers-bricks-for-sale-again"]],
   faq:[["Wie prüfe ich, ob ein LEGO-Set vollständig ist?","Setnummer bestimmen, Teileliste bei BrickLink oder Rebrickable aufrufen, Teile nach Farbe und Form sortieren und Position für Position abhaken. Minifiguren getrennt prüfen."],["Bekomme ich fehlende Teile für gebrauchte Sets kostenlos von LEGO?","Nein, der kostenlose Ersatz gilt für berechtigte Reklamationen bei neuen Sets. Für gebrauchte Sets kaufst du Teile über Pick a Brick oder bei BrickLink-Händlern."],["Zählen Extra-Teile zur Vollständigkeit?","Bei BrickLink werden sie als Extra-Teile geführt. Bei gebrauchten Sets fehlen sie oft; gib das im Angebot einfach an."]]},
  {slug:"pokemon-reseal-erkennen", title:"Versiegelte Pokémon-Produkte auf Reseal prüfen: Displays, Top-Trainer-Boxen und Booster", desc:"Resealed Pokémon-Displays, Top-Trainer-Boxen und Booster erkennen: Folie, Logos, Nähte, Crimp, Kleber und Kaufquelle prüfen – Checkliste für Sammler und Reseller.",
   lead:"Ein neu verschweißtes Display oder ein wieder verschlossener Booster sieht auf den ersten Blick originalverpackt aus. Mit diesen Prüfungen erkennst du typische Reseals, bevor du teuer einkaufst.",
   sections:[
    ["Was ist ein Reseal?", ["Beim Reseal wird versiegelte Ware geöffnet, Inhalt entnommen oder getauscht und dann neu verschlossen – bei Boxen mit neuer Folie, bei Boostern mit Kleber oder Hitze. Ein Fall, der auch große Händler betraf, war laut Geeky Domain der Hidden-Fates-Reseal von 2020: Auch ein Regal in einem großen Markt ist also kein Echtheitsbeweis.", "Wichtig für alle Prüfungen: Ein einzelnes Merkmal kann ein Fabrikfehler sein. Mehrere Auffälligkeiten zusammen sprechen laut Pokefolio fast immer für Manipulation. Alle Merkmale unten stammen aus den genannten Quellen (Stand November 2026)."]],
    ["Displays und Boxen: Folie prüfen", ["Laut Elite Fourum sitzt die Originalfolie straff um die Box und ist aus dickerem Material; dünne, knittrige Folie ist ein Warnsignal. Auf der Folie von Displays sind weiße Logos eingearbeitet – bei neueren Sets das Logo von The Pokémon Company. Geeky Domain betont, dass das Logo in der Folie selbst und nicht auf einem Aufkleber sitzt.", "Weitere Warnzeichen laut Geeky Domain: verbrannte Stellen von einer Heißluftpistole, aufgeblähte oder gebündelte Ecken, schief oder locker sitzende Folie, fehlende kleine Entlüftungslöcher und eine Naht, die nicht als T-Form mittig auf Ober- und Unterseite liegt. Gleichzeitig gilt: Eine straffe Folie allein beweist nichts."]],
    ["Displays und Boxen: Karton und Inhalt", ["Aufdruck und Gestaltung mit Referenzfotos vergleichen: falsche Schrift, Tippfehler oder fehlende TM- und ®-Zeichen sind Hinweise auf Fälschungen (Elite Fourum). Geeky Domain nennt außerdem einen fehlenden Produktcode über dem Barcode und denselben Los- oder Seriencode auf mehreren „versiegelten“ Boxen eines Verkäufers.", "Nach dem Öffnen: Booster in einem Display liegen ordentlich gestapelt, in dieselbe Richtung und richtig herum. Durcheinander liegende Booster deuten laut Elite Fourum auf eine manipulierte Box hin. Bei Top-Trainer-Boxen falsche Würfel, abweichende Kartenhüllen oder eine fehlende Promokarte prüfen (Geeky Domain)."]],
    ["Booster: Crimp, Kleber, Rückennaht", ["Laut Pokefolio haben echte Booster oben und unten eine scharfe, gleichmäßige Zickzack-Pressung (Crimp). Aufgeblähte, ungleichmäßige, geschmolzen wirkende oder flachgedrückte Stellen sind verdächtig, ebenso ein Crimp-Muster, das von den anderen Boostern derselben Box abweicht.", "Werkseitig wird kein flüssiger Kleber verwendet: weiße Rückstände an den Ecken, glänzende Sekundenkleber-Stellen oder klebrige Bereiche sind Warnzeichen. Die Rückennaht ist heißversiegelt; eine steif festgeklebte oder sich lösende Lasche ist verdächtig.", "Gewicht: Früher wurden schwere Booster gezielt herausgesucht. Bei aktuellen Sets ist Wiegen laut Pokefolio wegen Code- und Energiekarten nicht mehr zuverlässig – die Gefahr bei losen Boostern bleibt trotzdem."]],
    ["Wo das Risiko am größten ist", ["Lose Booster von Drittverkäufern haben laut Pokefolio das höchste Risiko. Sleeved Booster, Blister und 3er-Packs sind schwerer zu manipulieren. Vorsicht bei Preisen weit unter verkauften Vergleichsangeboten, Stockfotos statt eigener Bilder, Flohmärkten ohne Rückgabe und Verkäufern, die nicht sagen können, woher die Ware stammt (Elite Fourum, Geeky Domain).", "Bei teurer Ware: Fotos von allen Seiten und von der Naht verlangen, mit Käuferschutz zahlen und das Öffnen größerer Käufe filmen."]],
    ["Mehr zu Fälschungen und Lagerung", ["Gefälschte Einzelkarten erkennst du mit dem Ratgeber Fake-Pokémon-Karten erkennen (/wissen/pokemon-karten-fake-erkennen/). Wie du echte versiegelte Ware sicher aufbewahrst: /reseller/ratgeber/sammelkarten-versiegelt-lagern-verkaufen/"]],
    ["Versiegelte Ware verkaufen", ["perldeals kauft versiegelte Pokémon-Displays, Top-Trainer-Boxen und Booster sowie Einzelkarten an und prüft die Ware selbst. Fotos schicken, kostenloses Angebot bekommen: /reseller/ankauf/pokemon-karten/"]]
   ],
   sources:[["Elite Fourum: How To Tell if A Booster Box is Fake","https://www.elitefourum.com/t/how-to-tell-if-a-booster-box-is-fake/16035/1"],["Pokefolio: How to spot resealed Pokémon packs","https://www.pokefolio.eu/en/blog/how-to-spot-resealed-pokemon-packs/"],["Geeky Domain: Fake Sealed Product – Red Flags to Know","https://geekydomain.com/blogs/guides/fake-sealed-pokemon-product-red-flags-to-know"]],
   faq:[["Wie erkenne ich ein resealtes Pokémon-Display?","Folie prüfen (straff, dickes Material, eingearbeitete weiße Logos, T-förmige Naht, keine Hitzespuren), Aufdruck mit Referenzfotos vergleichen und auf Preis und Verkäufer achten. Nach dem Öffnen sollten die Booster ordentlich und gleich ausgerichtet liegen."],["Woran erkenne ich einen geöffneten Booster?","An ungleichmäßiger oder geschmolzen wirkender Zickzack-Pressung, Kleberresten und einer festgeklebten Rückennaht."],["Kann man Booster durch Wiegen prüfen?","Bei aktuellen Sets ist das laut Pokefolio nicht zuverlässig, weil Code- und Energiekarten das Gewicht verändern."]]},
  {slug:"konsole-verkaufen-zuruecksetzen", title:"Konsole verkaufen: Switch, PS5, PS4 und Xbox richtig zurücksetzen", desc:"Vor dem Konsolenverkauf: Daten sichern, primäre Konsole deaktivieren und auf Werkseinstellungen zurücksetzen – Schritte für Nintendo Switch, PS5, PS4 und Xbox mit offiziellen Quellen.",
   lead:"Wer eine Konsole verkauft, sollte vorher sein Konto lösen und alle Daten löschen. Sonst kann der Käufer im schlimmsten Fall auf dein Konto und deine Käufe zugreifen. Hier die Schritte für die gängigen Konsolen.",
   sections:[
    ["Die Reihenfolge", ["1. Spielstände und Daten sichern. 2. Konsole als primäre Konsole deaktivieren bzw. vom Konto lösen. 3. Auf Werkseinstellungen zurücksetzen. 4. Eigene Speicherkarten, USB-Laufwerke und Discs entfernen. Wer erst zurücksetzt und dann an das Konto denkt, muss die Deaktivierung später über die Website erledigen – und das geht bei Nintendo und PlayStation nur eingeschränkt."]],
    ["PlayStation 5 und PlayStation 4", ["PlayStation empfiehlt vor der Weitergabe (Support-Seite, Stand November 2026): Seriennummer notieren, Discs und USB-Geräte entfernen, Daten auf USB-Laufwerk oder in der Cloud (PS Plus) sichern, Trophäen synchronisieren und bei der PS5 eine eigene M.2-SSD ausbauen, wenn du sie behalten willst.", "Deaktivieren: PS5 unter Einstellungen > Benutzer und Konten > Andere > Konsolenfreigabe und Offline-Spiel > Deaktivieren. PS4 unter Einstellungen > Konto-Verwaltung > Als deine primäre PS4 aktivieren > Deaktivieren. Über die Website lassen sich laut PlayStation alle Konsolen auf einmal nur einmal alle sechs Monate deaktivieren.", "Zurücksetzen: PS5 unter Einstellungen > System > Systemsoftware > Optionen für das Zurücksetzen > Deine Konsole zurücksetzen. PS4 unter Einstellungen > Initialisierung > PS4 initialisieren > Vollständig. Dabei werden laut PlayStation alle Daten und Einstellungen endgültig gelöscht."]],
    ["Nintendo Switch", ["Primäre Konsole lösen: Nintendo eShop öffnen, den mit dem Nintendo-Account verknüpften Benutzer wählen, oben rechts auf das Profilbild, im Bereich zur primären Konsole die Registrierung aufheben (im englischen Menü „Deregister“) und zweimal bestätigen (Nintendo-Support). Ist die Konsole nicht mehr greifbar, geht das über accounts.nintendo.com – laut Nintendo aber nur einmal pro Jahr.", "Zurücksetzen: Systemeinstellungen > Konsole > Formatierungsoptionen > Auf Werkseinstellungen zurücksetzen (laut GIGA). Dabei werden Account-Daten, Spielstände, Spiele und Einstellungen gelöscht. Spielstände vorher in der Cloud sichern, sofern du Nintendo Switch Online nutzt, oder auf die neue Konsole übertragen.", "Bei der Nintendo Switch 2 sind die Menüs ähnlich; prüfe die genauen Schritte vor dem Zurücksetzen auf der Support-Seite von Nintendo."]],
    ["Xbox Series X|S und Xbox One", ["Laut GIGA: Xbox-Taste drücken, ganz rechts auf das Profilbild, Einstellungen > System > Konsoleninfo > Konsole zurücksetzen > Zurücksetzen und alles entfernen. Diese Option löscht Benutzerdaten, Konten, Spielstände, Einstellungen und installierte Spiele. Die Variante „Zurücksetzen und meine Spiele & Apps behalten“ ist nur zur Problembehandlung gedacht und für den Verkauf ungeeignet.", "Vorher die Konsole online schalten, damit Spielstände in die Cloud synchronisiert werden, und sicherstellen, dass du deine Zugangsdaten kennst."]],
    ["Was Käufer erwarten", ["Eine zurückgesetzte Konsole, die beim Einschalten die Ersteinrichtung zeigt, ist für Käufer ein Qualitätsmerkmal. Lege Kabel, Controller und, wenn vorhanden, Originalverpackung bei und beschreibe den Zustand ehrlich. Bei Retro-Konsolen ohne Online-Konto entfällt das Zurücksetzen; dort zählen Funktion, Vollständigkeit und Zustand."]],
    ["Konsole schnell verkaufen", ["perldeals kauft Konsolen, Videospiele und Retro-Konsolen an. Fotos schicken, kostenloses Angebot bekommen: /reseller/ankauf/videospiele/ und /reseller/ankauf/retro-konsolen/"]]
   ],
   sources:[["PlayStation-Support: Daten übertragen oder Konsole entsorgen","https://www.playstation.com/de-at/support/hardware/transfer-dispose-console/"],["PlayStation-Support: So deaktivierst du eine PlayStation-Konsole","https://www.playstation.com/de-at/support/account/deactivate-playstation-console/"],["Nintendo-Support: How to Deregister a Primary Nintendo Switch Console","https://www.nintendo.com.au/support/articles/how-to-deregister-a-primary-nintendo-switch-console"],["GIGA: Nintendo Switch zurücksetzen","https://www.giga.de/tipp/nintendo-switch-zuruecksetzen-hard-soft-reset-werkseinstellungen/"],["GIGA: Xbox Series X|S und One auf Werkseinstellungen zurücksetzen","https://www.giga.de/tipp/xbox-series-x-s-one-auf-werkseinstellungen-zuruecksetzen/"]],
   faq:[["Muss ich meine PS5 vor dem Verkauf deaktivieren?","Ja, sinnvoll ist es. Auf der Konsole geht das unter Einstellungen > Benutzer und Konten > Andere > Konsolenfreigabe und Offline-Spiel. Über die Website lassen sich alle Konsolen laut PlayStation nur einmal alle sechs Monate deaktivieren."],["Wie setze ich eine Nintendo Switch vor dem Verkauf zurück?","Zuerst im eShop die Registrierung als primäre Konsole aufheben, dann unter Systemeinstellungen > Konsole > Formatierungsoptionen auf Werkseinstellungen zurücksetzen."],["Was passiert, wenn ich vergesse, die Konsole zu deaktivieren?","Bei Nintendo lässt sich die primäre Konsole über die Website nur einmal pro Jahr lösen, bei PlayStation alle Konsolen nur einmal alle sechs Monate. Zusätzlich hilft es, dein Passwort zu ändern."]]}
];
const rsProductPages = [
  {path:"/reseller/pokemon-display-kaufen/", h:"Pokémon-Display kaufen", re:/display/i, game:"pokemon", kw:"Pokémon-Displays", intro:"Aktuelle und kommende Pokémon-Displays mit Erscheinungstermin, Preis und Händlern. Displays sind versiegelte Kartons mit meist 36 Boostern."},
  {path:"/reseller/top-trainer-box-kaufen/", h:"Pokémon Top-Trainer-Box kaufen", re:/top-trainer|elite trainer/i, game:"pokemon", kw:"Top-Trainer-Boxen", intro:"Alle aktuellen und kommenden Top-Trainer-Boxen (Elite Trainer Boxen) mit Termin, Preis und Händlern, auch Pokémon-Center-Versionen und Einladungs-Angebote."},
  {path:"/reseller/one-piece-display-kaufen/", h:"One Piece Display kaufen", re:/display|booster/i, game:"onepiece", kw:"One-Piece-Displays", intro:"Booster und Displays des One Piece Card Game (englische Edition) mit Termin, Preis und Händlern in Deutschland."}
];
const rsOwn = () => (RS && RS.own ? RS.own : []).filter(o => o.status !== "verkauft" || daysTo((o.sold||o.added).slice(0,10)) > -7);
const rsOwnCard = o => `<li class="rs-own" id="${o.id}">${o.img ? `<img src="${esc(o.img)}" alt="${esc(o.title)}" loading="lazy" width="320" height="240">` : ""}<div><div class="rs-promo-head"><strong>${esc(o.status === "verkauft" ? "Verkauft" : o.status === "reserviert" ? "Reserviert" : "Verfügbar")}</strong><span>${dayDe(o.added.slice(0,10))}</span></div><h3>${esc(o.title)}</h3>
  <p class="price"><span class="now">${eur(o.price,"de")}</span>${o.market ? ` <small>Marktwert ca. ${eur(o.market,"de")}${o.marketBasis ? ` (${esc(o.marketBasis)})` : ""}</small>` : ""}</p>
  <p>${esc(o.condition || "")}${o.qty ? ` · ${esc(String(o.qty))} Stück` : ""}${o.shipping ? ` · ${esc(o.shipping)}` : ""}</p>${o.desc ? `<p>${esc(o.desc)}</p>` : ""}
  ${o.status === "verkauft" ? "" : `<a class="btn btn-primary" href="https://wa.me/${WA_PHONE.slice(1)}?text=${encodeURIComponent(`Hallo perldeals, ich interessiere mich für: ${o.title} (${o.id})`)}" rel="noopener">Per WhatsApp anfragen</a>`}</div></li>`;
function buildResellerMore(){
  const relLink = r => `<a href="${RS_REL_PATH(r)}">${esc(r.name.split(" (")[0])}</a>`;
  // Termine je Set
  for (const r of RS.releases) {
    const gName = r.game === "pokemon" ? "Pokémon" : "One Piece", short = r.name.split(" (")[0], n = daysTo(r.date);
    const prices = r.products.filter(p => p.price);
    const others = RS.releases.filter(x => x.id !== r.id && x.game === r.game);
    rsPage({path:RS_REL_PATH(r), active:r.game, trail:[[gName, RS_T[r.game].path], [short]], eyebrow:`${gName} · ${r.date ? (n > 0 ? `erscheint in ${n} Tagen` : n === 0 ? "erscheint heute" : "erschienen") : "Termin offen"}`,
      h1:`${short}: Release${r.date ? " " + dayDe(r.date) : ""}, Preise und Händler`,
      lead:`${esc(short)}${r.code ? ` (${esc(r.code)})` : ""} ${r.date ? `erscheint am <strong>${dayDe(r.date)}</strong>${r.confirmed ? "" : " (noch nicht offiziell bestätigt)"}` : "hat noch keinen festen Termin"}. Hier findest du alle Produkte mit Ladenpreis und die Händler, die führen oder vorbestellen lassen.`,
      title:`${short} kaufen: Release ${r.date ? dayDe(r.date) : ""}, Preis & Händler · perldeals`.replace("  ", " "),
      desc:`${short}${r.date ? ` erscheint am ${dayDe(r.date)}` : ""}. ${prices.length ? `Preise: ${prices.slice(0,2).map(p => `${p.type.split(",")[0]} ${eur(p.price,"de")}`).join(", ")}. ` : ""}${r.retailers.length ? `Händler: ${r.retailers.slice(0,3).join(", ")}. ` : ""}Mit Deal-Alarm für Reseller.`,
      body: `<div class="wrap"><section class="section"><h2>Produkte und Ladenpreise</h2>${rsProducts(r)}<h2>Händler</h2><p>${r.retailers.length ? esc(r.retailers.join(", ")) : "Noch kein Händler bestätigt. Mit dem Deal-Alarm erfährst du es sofort."}</p><h2>Hinweise</h2><p>${esc(r.note)}</p><p><small>${rsSrc(r.sources)}</small></p></section>${rsAlarmBox("reseller-termin", [r.game])}
        <section class="section"><h2>Weitere ${gName}-Termine</h2><ul class="link-list">${others.map(x => `<li>${relLink(x)}: ${dayDe(x.date)}</li>`).join("")}</ul></section></div>`,
      faq:[[`Wann erscheint ${short}?`, r.date ? `Am ${dayDe(r.date)}${r.confirmed ? "." : ", der Termin ist aber noch nicht offiziell bestätigt."}` : "Ein Termin ist noch nicht bekannt."],
        ...(prices.length ? [[`Was kostet ${short}?`, prices.map(p => `${p.type}: ${eur(p.price,"de")}`).join("; ") + ". Das sind Händler- bzw. Vorbestellpreise, keine offizielle UVP."]] : []),
        [`Wo kann man ${short} kaufen?`, r.retailers.length ? `Bestätigt bei: ${r.retailers.join(", ")}.` : "Noch ist kein Händler bestätigt."]]});
  }
  // LEGO-Set-Seiten
  for (const s of RS.eol) {
    const amzOk = s.asin && s.best && /^Amazon\.de/.test(s.best.shop);
    rsPage({path:RS_EOL_PATH(s), active:"lego", trail:[["LEGO EOL", RS_T.lego.path], [`${s.num} ${s.name}`]], eyebrow:`LEGO ${s.theme} · EOL ${s.eol}`,
      h1:`LEGO ${s.num} ${s.name}: EOL, Bestpreis und Wertentwicklung`,
      lead:`Das LEGO-${esc(s.theme)}-Set ${s.num} „${esc(s.name)}“ geht voraussichtlich ${esc(s.eol)} aus dem Sortiment. UVP ${eur(s.uvp,"de")}${s.best ? `, aktueller Bestpreis <strong>${eur(s.best.price,"de")}</strong> bei ${esc(s.best.shop)} (${s.discountPct > 0 ? "−" + s.discountPct + " %" : "kein Rabatt"})` : ""}.`,
      title:`LEGO ${s.num} ${s.name} EOL: Bestpreis ${s.best ? eur(s.best.price,"de") : ""} · perldeals`,
      desc:`LEGO ${s.theme} ${s.num} ${s.name}: EOL ${s.eol}, UVP ${eur(s.uvp,"de")}${s.best ? `, Bestpreis ${eur(s.best.price,"de")} (−${s.discountPct} %)` : ""}, geschätzter Wert nach EOL und Marge für Sammler und Reseller.`,
      body: `<div class="wrap"><section class="section"><div class="rs-scroll"><table class="rs-table"><tbody>
        <tr><th>UVP</th><td>${eur(s.uvp,"de")}</td></tr>
        ${s.best ? `<tr><th>Bestpreis</th><td><strong>${eur(s.best.price,"de")}</strong> bei ${esc(s.best.shop)}, geprüft ${dayDe(s.best.checked)}</td></tr><tr><th>Rabatt auf UVP</th><td><span class="rs-pct">${s.discountPct > 0 ? "−" + s.discountPct : 0} %</span></td></tr>` : ""}
        <tr><th>Voraussichtliches EOL</th><td>${esc(s.eol)} · ${rsSrc([s.eolSource])}</td></tr>
        <tr><th>Wert nach EOL*</th><td>≈ ${eur(s.market.value,"de")}</td></tr>
        ${s.margin != null ? `<tr><th>Mögliche Marge*</th><td>≈ ${eur(s.margin,"de")} (${s.marginPct} %)</td></tr>` : ""}
        </tbody></table></div>
        <p>${s.deal ? `<a class="btn btn-primary" href="${R.deal.de(s.deal)}">Zum geprüften Deal</a> ` : ""}${amzOk ? `<a class="btn btn-primary" href="${amz(s.asin)}" ${AFF}>Bei Amazon ansehen <span class="ad-tag">Anzeige</span></a> ` : ""}<a href="${esc(s.best ? (s.best.url || s.sources[0]) : s.sources[0])}" rel="nofollow noopener" target="_blank">Preisvergleich</a></p>
        <p class="rs-foot">* Schätzung: UVP + ${Math.round(RS_UPLIFT*100)} % (Median-Wertsteigerung versiegelter Sets zwölf Monate nach EOL), vor Gebühren und Versand.</p></section>
        ${rsAlarmBox("reseller-lego-set", ["lego"])}
        <section class="section"><h2>Weitere auslaufende ${esc(s.theme)}-Sets</h2><ul class="link-list">${RS.eol.filter(x => x.num !== s.num && x.theme === s.theme).map(x => `<li><a href="${RS_EOL_PATH(x)}">LEGO ${x.num} ${esc(x.name)}</a>${x.best ? `: ${eur(x.best.price,"de")} (−${x.discountPct} %)` : ""}</li>`).join("") || "<li>Keine weiteren Sets dieser Reihe auf der Liste.</li>"}</ul><p><a href="${RS_T.lego.path}">Alle ${RS.eol.length} auslaufenden LEGO-Sets</a></p></section></div>`,
      faq:[[`Wann geht LEGO ${s.num} EOL?`, `Voraussichtlich ${s.eol}. LEGO bestätigt EOL-Termine nicht offiziell, sie können sich verschieben.`],
        [`Wo ist LEGO ${s.num} gerade am günstigsten?`, s.best ? `Am ${dayDe(s.best.checked)} bei ${s.best.shop} für ${eur(s.best.price,"de")}. Preise ändern sich schnell.` : "Gerade haben wir keinen geprüften Preis."],
        [`Steigt LEGO ${s.num} nach dem EOL im Wert?`, `Das ist nicht sicher. Im Mittel steigen versiegelte Sets nach dem EOL um rund ${Math.round(RS_UPLIFT*100)} % in zwölf Monaten, einzelne Sets deutlich mehr oder weniger.`]]});
  }
  // Release-Kalender gesamt
  rsPage({path:"/reseller/release-kalender/", active:"termine", trail:[["Release-Kalender"]], eyebrow:`Release-Kalender · ${MONTH_DE}`, h1:"Sammelkarten Release-Kalender 2026/2027: Pokémon & One Piece",
    lead:"Alle kommenden Pokémon- und One-Piece-Neuerscheinungen in einer Liste, mit Termin, Ladenpreis und Händlern.",
    title:"Release-Kalender Sammelkarten 2026/2027: Pokémon & One Piece · perldeals", desc:"Sammelkarten-Release-Kalender: alle neuen Pokémon- und One-Piece-Sets 2026/2027 mit Datum, Ladenpreis und Händlern. Mit Deal-Alarm für neue Termine.",
    body: `<div class="wrap">${rsAlarmBox("reseller-kalender", ["pokemon","onepiece"])}</div>` + rsSec("Alle Termine", rsReleaseTable(null)) + `<div class="wrap"><ul class="link-list">${RS.releases.map(r => `<li>${relLink(r)} (${r.game === "pokemon" ? "Pokémon" : "One Piece"}): ${dayDe(r.date)}</li>`).join("")}</ul></div>`});
  // Produktarten
  for (const P of rsProductPages) {
    const rel = RS.releases.filter(r => r.game === P.game && r.products.some(p => P.re.test(p.type)) && (!r.date || daysTo(r.date) >= -60)).sort((a,b) => (a.date||"9").localeCompare(b.date||"9"));
    const rows = rel.flatMap(r => r.products.filter(p => P.re.test(p.type)).map(p => `<tr><td data-l="Termin">${dayDe(r.date)}</td><td data-l="Set">${relLink(r)}</td><td data-l="Produkt">${esc(p.type)}</td><td data-l="Preis">${p.price ? `<strong>${eur(p.price,"de")}</strong>` : "noch offen"}</td><td data-l="Händler">${esc(r.retailers.join(", ") || "–")}</td></tr>`)).join("");
    rsPage({path:P.path, active:P.game, trail:[[P.h]], eyebrow:`${P.kw} · ${MONTH_DE}`, h1:`${P.h}: Termine, Preise, Händler ${MONTH_DE}`, lead:P.intro,
      title:`${P.h} ${MONTH_DE}: Preise & Termine · perldeals`, desc:`${P.intro} Mit Deal-Alarm per E-Mail.`,
      body: `<div class="wrap">${rsAlarmBox("reseller-produkt", [P.game])}</div>` + rsSec(`${P.kw} im Überblick`, rows ? `<div class="rs-scroll"><table class="rs-table"><thead><tr><th>Termin</th><th>Set</th><th>Produkt</th><th>Preis</th><th>Händler</th></tr></thead><tbody>${rows}</tbody></table></div><p class="rs-foot">Preise laut Händler bzw. Vorbestellung, keine offizielle UVP.</p>` : "<p>Gerade keine Einträge.</p>") + rsSec("Aktionen", rsPromoList(P.game))});
  }
  // Black Friday für Reseller (15.11., Nico: „Reseller anlocken, damit sie unsere besten Deals laufen“)
  {
    const poke = rsDeals("pokemon"), lego = rsDeals("lego"), kons = rsDeals("konsolen"), op = rsDeals("onepiece");
    const eolTop = RS.eol.filter(x => x.best && x.margin != null && x.margin > 0).sort((a,b) => b.marginPct - a.marginPct).slice(0, 12);
    const promos = (RS.promos || []).filter(p => !p.to || daysTo(p.to) >= 0);
    const n = daysTo("2026-11-27");
    rsPage({path:"/reseller/black-friday/", active:"angebote", trail:[["Black Friday für Reseller"]], eyebrow:`Black Friday 2026 · ${n > 0 ? `noch ${n} Tage` : "jetzt"}`,
      h1:"Black Friday 2026 für Reseller: Pokémon, LEGO & Konsolen mit Marge",
      lead:`Black Friday ist am <strong>27. November 2026</strong>, Cyber Monday am 30. November. Hier sammeln wir alle geprüften Deals, die sich für Wiederverkäufer und Sammler lohnen: Pokémon- und One-Piece-Produkte, LEGO-Sets kurz vor dem EOL mit geschätzter Marge und Konsolen. Jeder Preis ist gegen den Preisverlauf geprüft, Mondpreise lassen wir weg.`,
      title:"Black Friday 2026 für Reseller: Pokémon, LEGO EOL & Konsolen · perldeals",
      desc:"Black Friday 2026 für Reseller und Sammler: geprüfte Pokémon-, One-Piece-, LEGO-EOL- und Konsolen-Deals mit geschätzter Marge, Händleraktionen und Deal-Alarm.",
      body: `<div class="wrap">${rsAlarmBox("reseller-black-friday", ["pokemon","lego","konsolen"])}</div>`
        + (poke.length || op.length ? `<div class="wrap">${grid(poke.concat(op).slice(0,12), "de", "h2", "Pokémon & One Piece im Angebot")}</div>` : "")
        + (eolTop.length ? rsSec("LEGO kurz vor EOL: höchste geschätzte Marge", `<div class="rs-scroll"><table class="rs-table"><thead><tr><th>Set</th><th>EOL</th><th>Bestpreis</th><th>Wert nach EOL*</th><th>Marge*</th></tr></thead><tbody>${eolTop.map(x => `<tr><td data-l="Set"><a href="${RS_EOL_PATH(x)}">LEGO ${x.num} ${esc(x.name)}</a></td><td data-l="EOL">${esc(x.eol)}</td><td data-l="Bestpreis"><strong>${eur(x.best.price,"de")}</strong><br><small>${esc(x.best.shop)}</small></td><td data-l="Wert">≈ ${eur(x.market.value,"de")}</td><td data-l="Marge">≈ ${eur(x.margin,"de")} (${x.marginPct} %)</td></tr>`).join("")}</tbody></table></div><p class="rs-foot">* Schätzung: UVP + ${Math.round(RS_UPLIFT*100)} % nach EOL, vor Gebühren und Versand.</p>`) : "")
        + (lego.length ? `<div class="wrap">${grid(lego.slice(0,12), "de", "h2", "LEGO-Deals")}</div>` : "")
        + (kons.length ? `<div class="wrap">${grid(kons.slice(0,9), "de", "h2", "Konsolen-Deals")}</div>` : "")
        + (promos.length ? rsSec("Händleraktionen für Reseller", `<ul class="link-list">${promos.map(p => `<li><strong>${esc(p.retailer || p.shop || "")}:</strong> ${esc(p.title || "")}${p.code ? ` · Code <code>${esc(p.code)}</code>` : ""}${p.to ? ` · bis ${dayDe(p.to)}` : ""}</li>`).join("")}</ul><p><a class="more" href="/reseller/aktionen/">Alle Reseller-Aktionen</a></p>`) : "")
        + rsSec("So kaufst du am Black Friday als Reseller richtig ein", `<ul class="checklist"><li>Marge vorher rechnen: Verkaufspreis minus eBay- bzw. Cardmarket-Gebühren, Versand und Verpackung. Dafür gibt es unseren <a href="/reseller/rechner/">Reseller-Rechner</a>.</li><li>Nur versiegelte Ware mit intakter Folie kaufen, Displays und ETBs möglichst im Original-Umkarton.</li><li>Mengenlimits der Shops beachten; Bestellungen über mehrere Konten verstoßen oft gegen die AGB.</li><li>Rechnung aufheben: Als gewerblicher Verkäufer brauchst du sie für die Buchhaltung, bei Neuware mit ausgewiesener Umsatzsteuer.</li><li>LEGO: Nur Sets mit bestätigtem oder sehr wahrscheinlichem EOL einlagern, die Wertsteigerung ist nie garantiert.</li><li>Preise mit dem Preisverlauf vergleichen, nicht mit der UVP. Viele Black-Friday-Rabatte gab es vorher schon.</li></ul>`)
        + `<div class="wrap">${RS_NOTE}<section class="section"><h2>Weiter im Reseller-Bereich</h2><ul class="link-list"><li><a href="/reseller/lego-eol/">LEGO EOL-Liste 2026/2027</a></li><li><a href="/reseller/release-kalender/">Release-Kalender Pokémon & One Piece</a></li><li><a href="/reseller/pokemon-preisindex/">Pokémon-Preisindex</a></li><li><a href="/reseller/karten-ankauf/">Karten verkaufen: Ankauf</a></li><li><a href="/black-friday/">Black Friday 2026: alle Deals</a></li></ul></section></div>`,
      faq:[["Lohnt sich Black Friday für Reseller?", "Bei LEGO-Sets kurz vor dem EOL und bei Konsolen oft ja, weil die Preise dann unter das übliche Niveau fallen. Bei Pokémon- und One-Piece-Neuheiten gibt es am Black Friday selten echte Rabatte; hier lohnen sich eher Restocks zum Ladenpreis. Rechne die Marge immer nach Gebühren und Versand."],
        ["Wann ist Black Friday 2026?", "Am Freitag, 27. November 2026. Cyber Monday ist am Montag, 30. November 2026. Viele Shops starten ihre Black Week schon am Montag davor."],
        ["Wie erfahre ich sofort von neuen Reseller-Deals?", "Mit unserem kostenlosen Reseller-Deal-Alarm: Du wählst Pokémon, One Piece, LEGO oder Konsolen und bekommst neue Deals, Termine und Händleraktionen per E-Mail."]]});
  }
  // Pokémon-Händler: Hub + Leitfaden-Kapitel
  const PH = fs.existsSync(`${SRC}/data/pokemon-haendler.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/pokemon-haendler.json`, "utf8")) : null;
  if (PH) {
    const poke = rsDeals("pokemon");
    const PHP = s => `/reseller/pokemon-haendler/${s}/`;
    const phNav = cur => `<nav class="chips topic-chips" aria-label="Leitfaden-Kapitel"><a class="chip" href="/reseller/pokemon-haendler/"${!cur?' aria-current="page"':""}>Übersicht &amp; Deals</a>${PH.chapters.map(c => `<a class="chip" href="${PHP(c.slug)}"${cur===c.slug?' aria-current="page"':""}>${esc(c.short)}</a>`).join("")}</nav>`;
    const blk = b => `<h2>${esc(b.h)}</h2>${(b.table ? `<div class="rs-scroll"><table class="rs-table"><thead><tr>${b.table.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.table.rows.map(r => `<tr>${r.map((c,i) => `<td data-l="${esc(b.table.head[i])}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "")}${(b.list ? `<ul>${b.list.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "")}${(b.p || []).map(x => `<p>${esc(x)}</p>`).join("")}`;
    rsPage({path:"/reseller/pokemon-haendler/", active:"pokemon", trail:[["Pokémon", "/reseller/pokemon/"], ["Für Händler"]], eyebrow:`Pokémon für Händler · ${MONTH_DE}`, h1:PH.hub.title, lead:esc(PH.hub.lead),
      title:`Pokémon für Händler: Deals & Leitfaden ${MONTH_DE} · perldeals`, desc:PH.hub.desc,
      body:`<div class="wrap">${phNav(null)}</div>${akBanner()}<div class="wrap">${rsAlarmBox("reseller-pokemon", ["pokemon"])}</div>`
        + (poke.length ? grid(poke, "de", "h2", "Die besten Pokémon-Deals gerade") + rsMetricTable(poke) : rsSec("Die besten Pokémon-Deals gerade", "<p>Gerade kein geprüfter Pokémon-Deal. Mit dem Deal-Alarm verpasst du den nächsten nicht.</p>"))
        + rsSec("Aktionen mit Pokémon-Karten", rsPromoList("pokemon"))
        + rsSec("📘 Leitfaden: Karten finden und bewerten", `<ul class="link-list">${PH.chapters.map(c => `<li><a href="${PHP(c.slug)}"><strong>${esc(c.title)}</strong></a><br><span>${esc(c.desc)}</span></li>`).join("")}</ul>`)
        + rsSec("📅 Nächste Pokémon-Termine", rsReleaseTable("pokemon") + `<p><a href="/reseller/pokemon/">Alle Pokémon-Termine</a></p>`),
      faq:[["Wo finde ich die besten Pokémon-Deals für den Wiederverkauf?","Wir sammeln geprüfte Angebote auf Displays, Top-Trainer-Boxen und Booster aus allen Partnershops und markieren sie auf dieser Seite. Mit dem Reseller-Deal-Alarm bekommst du neue Deals per E-Mail."],["Wie bewerte ich Pokémon-Karten als Händler?","Set und Nummer bestimmen, Sprache und Zustand prüfen, Echtheit kontrollieren und den realistischen Verkaufspreis nach Gebühren ansetzen. Die einzelnen Schritte erklärt unser Leitfaden."]]});
    for (const c of PH.chapters) {
      rsPage({path:PHP(c.slug), active:"pokemon", trail:[["Pokémon für Händler", "/reseller/pokemon-haendler/"], [c.short]], eyebrow:`Pokémon-Händler-Leitfaden · Stand ${PH.updated.split("-").reverse().join(".")}`, h1:c.title, lead:esc(c.lead), title:`${c.title} · perldeals`, desc:c.desc,
        body:`<div class="wrap">${phNav(c.slug)}</div><div class="wrap legal wissen">${c.blocks.map(blk).join("")}${c.sources.length ? `<h2>Quellen</h2><ul class="link-list">${c.sources.map(([n,u]) => `<li><a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(n)}</a></li>`).join("")}</ul>` : ""}<h2>Weitere Kapitel</h2><ul class="link-list">${PH.chapters.filter(x => x.slug !== c.slug).map(x => `<li><a href="${PHP(x.slug)}">${esc(x.title)}</a></li>`).join("")}<li><a href="/reseller/pokemon-haendler/">Aktuelle Pokémon-Deals für Händler</a></li></ul>${rsAlarmBox("reseller-ratgeber")}</div>`,
        faq:c.faq, ld:[{"@context":"https://schema.org","@type":"Article","headline":c.title,"description":c.desc,"inLanguage":"de","dateModified":PH.updated,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`}}]});
    }
  }
  // Ratgeber
  for (const g of RS_GUIDES) {
    rsPage({path:`/reseller/ratgeber/${g.slug}/`, active:"ratgeber", trail:[["Ratgeber", "/reseller/ratgeber/"], [g.title.split(":")[0]]], eyebrow:"Reseller-Ratgeber", h1:g.title, lead:esc(g.lead), title:`${g.title} · perldeals`, desc:g.desc,
      body:`<div class="wrap legal wissen">${g.sections.map(([h, ps]) => `<h2>${esc(h)}</h2>${ps.map(p => `<p>${linkify(p)}</p>`).join("")}`).join("")}${g.extra || ""}${g.sources ? `<h2>Quellen</h2><ul class="link-list">${g.sources.map(([n,u]) => `<li><a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(n)}</a></li>`).join("")}</ul>` : ""}${g.products ? `<h2>Einkaufsliste</h2><ul class="rg-products">${g.products.map(([n, why, q, ic]) => `<li>${ic ? `<img class="rg-ic" src="${ic}" alt="" loading="lazy" width="96" height="96">` : ""}<div class="rg-txt"><strong>${esc(n)}</strong><span>${esc(why)}</span><span class="rg-links"><a class="btn btn-ghost" href="${amzSearch(q)}" ${AFF}>Bei Amazon ansehen <span class="ad-tag">Anzeige</span></a> <a class="more small" href="${ebaySearch(q)}" ${AFF}>bei eBay vergleichen</a></span></div></li>`).join("")}</ul><p class="note">Anzeige: Partnerlinks, für dich gleicher Preis. Preise siehst du im Shop.</p>` : ""}<h2>Weiterlesen</h2><ul class="link-list">${RS_GUIDES.filter(x => x.slug !== g.slug).map(x => `<li><a href="/reseller/ratgeber/${x.slug}/">${esc(x.title)}</a></li>`).join("")}</ul>${rsAlarmBox("reseller-ratgeber")}</div>`,
      faq:g.faq, ld:[{"@context":"https://schema.org","@type":"Article","headline":g.title,"description":g.desc,"inLanguage":"de","dateModified":RS.updated.slice(0,10),"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`}}]});
  }
  rsPage({path:"/reseller/ratgeber/", active:"ratgeber", trail:[["Ratgeber"]], eyebrow:"Reseller-Ratgeber", h1:"Ratgeber für Reseller und Sammler", lead:"Produkte verstehen, Fälschungen erkennen, richtig einkaufen, lagern, mit den richtigen Gebühren verkaufen und an Steuern denken.",
    title:"Reseller-Ratgeber: eBay-Gebühren, Fälschungen, LEGO EOL, Steuern · perldeals", desc:"Ratgeber für Reseller und Sammler: eBay-Gebühren 2026, Pokémon-Reseals und Retro-Repros erkennen, LEGO gebraucht prüfen, LEGO EOL, Konsole verkaufen, Reselling und Steuern.",
    body:`<div class="wrap"><ul class="link-list">${RS_GUIDES.map(g => `<li><a href="/reseller/ratgeber/${g.slug}/"><strong>${esc(g.title)}</strong></a><br><span>${esc(g.desc)}</span></li>`).join("")}</ul></div>`});
  // Reseller-Rechner (Ankauf/Verkauf)
  {
    const RR = "/reseller/rechner/";
    const opt = (v, l, sel) => `<option value="${v}"${sel?" selected":""}>${l}</option>`;
    const fld = (id, label, val, hint, cls="") => `<label class="rr-f ${cls}"><span>${label}</span><input id="${id}" inputmode="decimal" value="${val}">${hint?`<small>${hint}</small>`:""}</label>`;
    const form = `<div class="wrap"><div id="rr" class="rr">
      <div class="rr-in">
        <label class="rr-f"><span>Was möchtest du berechnen?</span><select id="rr-mode">${opt("vk","Nötigen Verkaufspreis berechnen",1)}${opt("ek","Maximalen Ankaufspreis berechnen")}</select></label>
        <label class="rr-f"><span>Plattform</span><select id="rr-platform">${opt("ebay-privat","eBay privat")}${opt("ebay-tcg","eBay gewerblich · Sammelkarten",1)}${opt("ebay-spielzeug","eBay gewerblich · Spielzeug/LEGO")}${opt("ebay-games","eBay gewerblich · Videospiele")}${opt("ebay-konsole","eBay gewerblich · Konsolen (gebraucht)")}${opt("amazon-spielzeug","Amazon · Spielzeug/LEGO")}${opt("amazon-games","Amazon · Videospiele")}${opt("amazon-konsole","Amazon · Konsolen")}${opt("cardmarket","Cardmarket privat")}${opt("cardmarket-pro","Cardmarket Professional")}${opt("kleinanzeigen","Kleinanzeigen")}${opt("paypal","Direktverkauf mit PayPal")}${opt("vinted","Vinted")}${opt("eigen","Eigene Werte")}</select></label>
        ${fld("rr-ek","Einkaufspreis (€)","20","", "only-vk")}${fld("rr-vk","Erwarteter Verkaufspreis (€)","50","z. B. Durchschnitt der verkauften Artikel bei eBay","only-ek")}
        <div class="rr-row"><label class="rr-f"><span>Ziel</span><input id="rr-target" inputmode="decimal" value="20"></label><label class="rr-f"><span>&nbsp;</span><select id="rr-tmode">${opt("vk","% Marge vom Umsatz",1)}${opt("ek","% Aufschlag auf den Einkauf")}${opt("eur","€ Gewinn pro Stück")}</select></label></div>
        <label class="rr-f"><span>Umsatzsteuer</span><select id="rr-tax">${opt("none","Keine (privat oder Kleinunternehmer)",1)}${opt("diff","Differenzbesteuerung (§ 25a UStG, Ankauf von Privat)")}${opt("regel","Regelbesteuerung 19 %")}</select></label>
        <div class="rr-row">${fld("rr-shipin","Versand, den der Käufer zahlt (€)","0")}${fld("rr-shipout","Deine Versandkosten (€)","1,95")}</div>
        <div class="rr-row">${fld("rr-pack","Verpackung, Hüllen (€)","0,30")}${fld("rr-other","Sonstiges (€)","0","z. B. Grading, FBA, Anzeige")}</div>
        <details class="rr-adv"><summary>Gebühren anpassen</summary>
          <div class="rr-row">${fld("rr-pct","Provision (%)","11")}${fld("rr-fix","Festgebühr je Verkauf (€)","0,45")}</div>
          <div class="rr-row">${fld("rr-thr","Schwelle (€, 0 = keine)","990")}${fld("rr-pct2","Provision über Schwelle (%)","3")}</div>
          <div class="rr-row">${fld("rr-min","Mindestgebühr (€)","0")}<label class="rr-f rr-chk"><input id="rr-feevat" type="checkbox"> <span>Gebühren zzgl. 19 % USt (nur ohne Vorsteuerabzug, z. B. Kleinunternehmer)</span></label></div>
        </details>
        <button type="button" id="rr-reset" class="btn btn-ghost">Zurücksetzen</button>
      </div>
      <div class="rr-res" id="rr-out" aria-live="polite"><noscript>Der Rechner braucht JavaScript.</noscript></div>
    </div></div>`;
    const feeTable = `<div class="rs-scroll"><table class="rs-table"><thead><tr><th>Plattform</th><th>Gebühr (Voreinstellung)</th><th>Hinweis</th></tr></thead><tbody>
      <tr><td data-l="Plattform">eBay privat</td><td data-l="Gebühr">0 % innerhalb Deutschlands</td><td data-l="Hinweis">5 % bei Versand ins Ausland; Zusatzoptionen kosten extra</td></tr>
      <tr><td data-l="Plattform">eBay gewerblich · Sammelkarten</td><td data-l="Gebühr">11 % bis 990 €, 3 % darüber, + 0,35 € (bis 10 €) bzw. 0,45 € je Bestellung</td><td data-l="Hinweis">auf den Gesamtbetrag inkl. Versand; ohne eBay-Shop, Top-/überdurchschnittlicher Verkäuferstatus</td></tr>
      <tr><td data-l="Plattform">eBay gewerblich · Spielzeug/LEGO, Videospiele</td><td data-l="Gebühr">12 % bis 990 €, 3 % darüber, + 0,35/0,45 €</td><td data-l="Hinweis">wie oben</td></tr>
      <tr><td data-l="Plattform">eBay gewerblich · Konsolen</td><td data-l="Gebühr">7 % neu, 5 % gebraucht, + 0,35/0,45 €</td><td data-l="Hinweis">ohne Schwelle</td></tr>
      <tr><td data-l="Plattform">Amazon (Profi-Tarif)</td><td data-l="Gebühr">Spielzeug 15 %, Videospiele 15 %, Konsolen 8 %, mind. 0,30 €</td><td data-l="Hinweis">dazu 39 € im Monat; Basis-Tarif 0,99 € pro Verkauf; FBA-Gebühren unter „Sonstiges“ eintragen</td></tr>
      <tr><td data-l="Plattform">Cardmarket</td><td data-l="Gebühr">privat 5 %, Professional 3 %, Powerseller 1,5 %</td><td data-l="Hinweis">Stufen nach Monatsumsatz; aktuelle Werte im Cardmarket-Konto prüfen</td></tr>
      <tr><td data-l="Plattform">Direktverkauf mit PayPal</td><td data-l="Gebühr">2,49 % + 0,35 €</td><td data-l="Hinweis">Waren und Dienstleistungen, Inland</td></tr>
      <tr><td data-l="Plattform">Kleinanzeigen, Vinted</td><td data-l="Gebühr">0 % für Verkäufer</td><td data-l="Hinweis">bei „Sicher bezahlen“ bzw. Käuferschutz zahlt der Käufer die Gebühr</td></tr>
    </tbody></table></div><p><small>Stand der Voreinstellungen: November 2026, laut Gebührenseiten von eBay, PayPal und Branchenübersichten. Gebühren ändern sich regelmäßig – alle Werte lassen sich im Rechner unter „Gebühren anpassen“ ändern. Keine Steuer- oder Rechtsberatung.</small></p>`;
    const faq = [
      ["Wie berechne ich den Verkaufspreis mit Gewinn?","Einkaufspreis, Versand, Verpackung, Plattformgebühren und gegebenenfalls Umsatzsteuer addieren und die gewünschte Marge aufschlagen. Weil die Gebühren vom Verkaufspreis abhängen, rechnet der perldeals-Rechner den Preis rückwärts aus, bei dem nach allen Kosten genau dein Ziel übrig bleibt."],
      ["Wie viel darf ich beim Ankauf höchstens zahlen?","Stell im Rechner „Maximalen Ankaufspreis“ ein und gib den realistischen Verkaufspreis ein, am besten den Durchschnitt tatsächlich verkaufter Artikel. Der Rechner zeigt, wie viel du höchstens zahlen kannst, damit deine Wunschmarge nach Gebühren und Versand erreicht wird."],
      ["Welche Gebühren nimmt eBay für Sammelkarten?","Privat verkaufen innerhalb Deutschlands ist kostenlos. Gewerbliche Verkäufer zahlen für Sammelkartenspiele laut eBay 11 % bis 990 € und 3 % darüber, plus 0,35 € bzw. 0,45 € pro Bestellung, berechnet auf den Gesamtbetrag inklusive Versand."],
      ["Was ist Differenzbesteuerung?","Wer als umsatzsteuerpflichtiger Händler Gebrauchtware von Privatleuten ohne Umsatzsteuer kauft, kann nach § 25a UStG nur die Differenz zwischen Verkaufs- und Einkaufspreis versteuern statt des ganzen Preises. Das macht den Wiederverkauf von Sammlerware oft deutlich rentabler. Ob das für dich passt, klärt eine Steuerberatung."],
      ["Ist Marge dasselbe wie Aufschlag?","Nein. 20 % Marge heißt: 20 % vom Verkaufspreis bleiben als Gewinn. 20 % Aufschlag heißt: Gewinn gleich 20 % vom Einkaufspreis. Bei gleichem Prozentwert ist der Aufschlag also weniger Gewinn. Im Rechner kannst du beides einstellen."]
    ];
    rsPage({path:RR, active:"rechner", trail:[["Gewinnrechner"]], eyebrow:"Rechner für Reseller · eBay, Amazon, Cardmarket",
      h1:"Reseller-Rechner: Verkaufspreis und Ankaufspreis nach Gebühren",
      lead:"Wie teuer musst du verkaufen, damit nach eBay-, Amazon- oder Cardmarket-Gebühren, Versand und Steuer deine Marge übrig bleibt? Und wie viel darfst du beim Ankauf höchstens zahlen? Einfach Werte eintragen.",
      title:"Reseller-Rechner: Verkaufspreis & Gewinn nach eBay-, Amazon-Gebühren",
      desc:"Kostenloser Reseller-Rechner: nötigen Verkaufspreis mit Wunschmarge oder maximalen Ankaufspreis berechnen – inkl. eBay-, Amazon-, Cardmarket- und PayPal-Gebühren, Versand und Differenzbesteuerung.",
      scripts:["rechner.js"],
      body: form + rsSec("Die Gebühren im Überblick", feeTable)
        + rsSec("So nutzt du den Rechner beim Ankauf", `<ol class="ak-steps"><li><strong>Marktpreis ermitteln.</strong> Bei eBay nach „Verkaufte Artikel“ filtern oder den Cardmarket-Trend in deiner Sprache und deinem Zustand nehmen. Nicht Angebotspreise, sondern echte Verkäufe zählen.</li><li><strong>Modus „Maximaler Ankaufspreis“</strong> wählen, den Marktpreis eintragen und deine Wunschmarge festlegen.</li><li><strong>Plattform vergleichen.</strong> Die Tabelle zeigt, wo dir bei gleichem Preis am meisten bleibt.</li><li><strong>Puffer einplanen.</strong> Preise schwanken, und nicht alles verkauft sich sofort. Bei Sammlungen lieber mit dem unteren Marktpreis rechnen.</li></ol><p>Du willst lieber verkaufen statt selbst zu handeln? <a href="/reseller/karten-ankauf/">perldeals kauft Karten, Konsolen und Spiele an</a>.</p>`)
        + rsSec("Weiterlesen", `<ul class="link-list"><li><a href="/reseller/pokemon-haendler/verkaufen-gebuehren/">Pokémon-Karten verkaufen: Gebühren im Vergleich</a></li><li><a href="/wissen/pokemon-karten-wert-ermitteln/">Pokémon-Karten Wert ermitteln</a></li><li><a href="/reseller/ratgeber/">Ratgeber für Reseller</a></li><li><a href="/reseller/karten-ankauf/">Karten, Konsolen und Spiele verkaufen: Ankauf</a></li></ul>`),
      faq,
      ld:[{"@context":"https://schema.org","@type":"WebApplication","name":"perldeals Reseller-Rechner","applicationCategory":"FinanceApplication","operatingSystem":"Web","url":BASE+RR,"offers":{"@type":"Offer","price":"0","priceCurrency":"EUR"},"description":"Berechnet den nötigen Verkaufspreis oder maximalen Ankaufspreis nach Plattformgebühren, Versand und Umsatzsteuer."}]});
  }
  // Ankauf: Karten an perldeals verkaufen
  {
    const AK = "/reseller/karten-ankauf/";
    const waTxt = "Hallo perldeals, ich möchte etwas verkaufen (über perldeals.com/reseller/karten-ankauf/).\n\nWas (Pokémon / One Piece / Yu-Gi-Oh / Retro-Konsole / Videospiele / anderes): \nGenauer (z. B. Einzelkarten, Sammlung, Bulk, versiegelt, Konsole mit Zubehör, Spiele mit OVP): \nUngefähre Anzahl: \nSprache: \nZustand: \nGegradete Karten (PSA/CGC/BGS)? \nPreisvorstellung (optional): \nPLZ / Ort: \n\nFotos schicke ich gleich mit.";
    const waUrl = `https://wa.me/${WA_PHONE.slice(1)}?text=${encodeURIComponent(waTxt)}`;
    const mailUrl = `mailto:kontakt@perldeals.com?subject=${encodeURIComponent("Ankauf: Angebot anfragen")}&body=${encodeURIComponent(waTxt.replace("Fotos schicke ich gleich mit.","Fotos hänge ich an."))}`;
    const cta = `<div class="ak-cta"><a class="btn btn-primary" href="${esc(waUrl)}" rel="noopener">📲 Per WhatsApp anbieten</a><a class="btn btn-ghost" href="${esc(mailUrl)}">✉️ Per E-Mail anbieten</a><a class="btn btn-ghost" href="/reseller/ankauf/auftrag/">📦 Ankauf-Auftrag: einschicken</a></div>`;
    const faq = [
      ["Welche Karten kauft perldeals an?","Wir kaufen Sammelkarten von Pokémon, One Piece und Yu-Gi-Oh an: einzelne wertvolle Karten, ganze Sammlungen, Bulk, gegradete Karten und versiegelte Produkte wie Displays, Booster und Top-Trainer-Boxen. Angekauft wird nur Originalware in gutem bis sehr gutem Zustand."],
      ["Wie verkaufe ich meine Pokémon-Karten an perldeals?","Schick uns per WhatsApp oder E-Mail ein paar Fotos und die wichtigsten Angaben: Spiel, Anzahl, Sprache und Zustand. Wir sehen uns die Karten an und melden uns mit einem Angebot. Wenn es für dich passt, sprechen wir Übergabe oder Versand und die Bezahlung ab."],
      ["Was kostet mich die Anfrage?","Nichts. Die Anfrage und unser Angebot sind kostenlos und unverbindlich. Du entscheidest danach, ob du verkaufen möchtest."],
      ["Wie wird der Preis bestimmt?","Grundlage sind die aktuellen Marktpreise, zum Beispiel tatsächlich erzielte Verkaufspreise bei eBay und Cardmarket. Dazu kommen Zustand, Sprache, Auflage und Nachfrage. Wie Händler Karten bewerten, erklärt unser Pokémon-Händler-Leitfaden."],
      ["Welche Fotos soll ich schicken?","Vorder- und Rückseite der wertvollsten Karten bei gutem Licht, Nahaufnahmen von Ecken und Kanten bei Karten mit Gebrauchsspuren, bei Sammlungen ein Übersichtsfoto und bei versiegelter Ware Fotos der Folie von allen Seiten."],
      ["Kauft ihr auch beschädigte oder gefälschte Karten?","Nein. Beschädigte Karten, Proxies und Fälschungen kaufen wir nicht an. Bei versiegelter Ware muss die Originalfolie unbeschädigt sein."],
      ["Kauft ihr auch Retro-Konsolen und alte Videospiele?","Ja. Wir kaufen Retro-Konsolen wie Nintendo 64, Super Nintendo, NES, GameCube, Game Boy (Classic, Pocket, Color, Advance, SP), Nintendo DS, Sega Mega Drive, Master System, Saturn, Dreamcast und Game Gear sowie PlayStation 1 und 2 an, dazu Spiele, Controller und Zubehör. Am liebsten funktionsfähig und mit Originalverpackung, aber auch lose Module und Konsolen in gutem Zustand."],
      ["Was muss ich bei Konsolen und Spielen beachten?","Die Konsole sollte funktionieren, Spiele und Module müssen Originale sein. Nachbauten, Repro-Module, gebrannte Discs und defekte Geräte kaufen wir nicht an. Hilfreich sind Fotos von Vorder- und Rückseite, dem Typenschild und, falls vorhanden, der Originalverpackung und Anleitung."],
      ["Kauft ihr auch LEGO?","Ja, auch LEGO-Sets in gutem Zustand, versiegelt oder vollständig gebaut mit Anleitung. Schreib uns einfach per WhatsApp, was du anbieten möchtest."]
    ];
    rsPage({path:AK, active:"ankauf", trail:[["Karten verkaufen"]], eyebrow:"Ankauf · Pokémon, One Piece, Yu-Gi-Oh, Retro-Konsolen",
      h1:"Pokémon-Karten & Retro-Konsolen verkaufen: Ankauf per WhatsApp",
      lead:"Du willst Sammelkarten oder alte Konsolen verkaufen? Wir kaufen Pokémon-, One-Piece- und Yu-Gi-Oh-Karten an, außerdem Retro-Konsolen und Videospiele von Nintendo, Sega und PlayStation, vom Game Boy bis zum Nintendo 64. Fotos per WhatsApp schicken, Angebot bekommen, fertig.",
      title:"Pokémon-Karten & Retro-Konsolen verkaufen: Ankauf · perldeals",
      desc:"Pokémon-, One-Piece- und Yu-Gi-Oh-Karten sowie Retro-Konsolen verkaufen: Wir kaufen Sammlungen, Displays, Nintendo 64, Super Nintendo, Game Boy, Sega und Spiele an. Fotos per WhatsApp schicken, kostenloses Angebot erhalten.",
      body:`<div class="wrap">${cta}</div>`
        + rsSec("So läuft der Ankauf", `<ol class="ak-steps"><li><strong>Fotos schicken.</strong> Per WhatsApp oder E-Mail, mit Spiel oder Konsole, Anzahl, Sprache und Zustand. Die Nachricht ist schon vorausgefüllt.</li><li><strong>Angebot bekommen.</strong> Wir prüfen deine Karten anhand aktueller Marktpreise und melden uns mit einem Preis.</li><li><strong>Entscheiden.</strong> Das Angebot ist kostenlos und unverbindlich. Passt es dir, sprechen wir Übergabe oder Versand ab.</li><li><strong>Geld erhalten.</strong> Die Bezahlung stimmen wir direkt mit dir ab.</li></ol>`)
        + rsSec("Was wir ankaufen", `<nav class="chips topic-chips ak-cats">${(fs.existsSync(`${SRC}/data/ankauf.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/ankauf.json`, "utf8")).pages : []).map(x => `<a class="chip" href="/reseller/ankauf/${x.slug}/">${esc(x.what)} verkaufen</a>`).join("")}</nav><ul class="tips"><li><strong>Pokémon-Karten</strong>: Einzelkarten (z. B. Illustration Rare, Special Illustration Rare, Hyper Rare, alte Holos), ganze Sammlungen und Bulk, Deutsch, Englisch und Japanisch</li><li><strong>One Piece Card Game</strong>: Alt-Arts, Manga-Rares, Leader-Parallels, Sammlungen</li><li><strong>Yu-Gi-Oh</strong>: seltene Karten, ältere Editionen, Sammlungen</li><li><strong>Gegradete Karten</strong>: PSA, CGC, BGS und andere</li><li><strong>Versiegelte Ware</strong>: Displays, Booster, Elite-Trainer-/Top-Trainer-Boxen, Kollektionen, mit unbeschädigter Originalfolie</li><li>Auch <strong>LEGO-Sets</strong> in gutem Zustand</li></ul>`)
        + rsSec("🎮 Retro-Konsolen und Videospiele", `<p>Wir erweitern unser Sortiment und kaufen alte Konsolen, Handhelds und Spiele an, einzeln oder als ganze Sammlung:</p><ul class="tips"><li><strong>Nintendo</strong>: NES, Super Nintendo (SNES), Nintendo 64, GameCube, Wii, Virtual Boy</li><li><strong>Game Boy</strong>: Game Boy Classic, Pocket, Color, Advance und Advance SP, Nintendo DS und 3DS</li><li><strong>Sega</strong>: Master System, Mega Drive, Saturn, Dreamcast, Game Gear</li><li><strong>PlayStation &amp; Co.</strong>: PlayStation 1 und 2, PSP, Xbox (Classic), Atari</li><li><strong>Spiele und Zubehör</strong>: Module, Discs, Controller, Memory Cards, Originalverpackungen, Anleitungen und Sammlereditionen</li></ul><p>Am meisten zahlen wir für <strong>funktionsfähige Geräte mit Originalverpackung</strong> und beliebte Klassiker wie Pokémon-, Zelda- oder Mario-Spiele. Lose Konsolen und Module in gutem Zustand nehmen wir aber genauso gern.</p>`, "retro")
        + rsSec("Unsere Ankauf-Bedingungen", `<ul class="tips"><li>Nur <strong>Originalware</strong>, keine Proxies, Fälschungen oder Fan-Made-Karten</li><li>Zustand <strong>gut bis sehr gut</strong>, keine beschädigten oder defekten Artikel</li><li>Konsolen <strong>funktionsfähig</strong>, Spiele nur als Original, keine Repro-Module oder gebrannten Discs</li><li>Versiegelte Ware nur mit <strong>unbeschädigter Originalfolie</strong></li><li>Angebot <strong>kostenlos und unverbindlich</strong></li></ul>`)
        + rsSec("Diese Angaben helfen uns", `<ul class="tips"><li>Spiel und, wenn bekannt, Set und Kartennummer (unten links bzw. rechts auf der Karte)</li><li>Bei Konsolen: Modell (steht auf dem Typenschild unten), Zubehör, Spiele und ob sie getestet sind</li><li>Sprache der Karten</li><li>Anzahl oder grobe Menge (z. B. „ca. 2.000 Karten Bulk“)</li><li>Zustand: ungespielt, leicht bespielt, deutliche Gebrauchsspuren</li><li>Fotos von Vorder- und Rückseite der wertvollsten Karten, bei Bulk ein Übersichtsfoto</li><li>Optional deine Preisvorstellung und deine PLZ</li></ul><p>Du weißt nicht, was deine Karten wert sind? Unser <a href="/reseller/pokemon-haendler/sets-und-top-karten/">Überblick über Sets und Top-Karten</a> und das Kapitel <a href="/reseller/pokemon-haendler/zustand-und-grading/">Zustand und Grading</a> helfen beim Einschätzen.</p>${cta}`)
        + akForm("Pokémon-Karten")
        + rsSec("Mehr zu Pokémon und Sammelkarten", `<ul class="link-list"><li><a href="/wissen/pokemon-karten-wert-ermitteln/">Pokémon-Karten Wert ermitteln</a></li><li><a href="/wissen/pokemon-karten-verkaufen/">Pokémon-Karten verkaufen: Wo bekommst du am meisten?</a></li><li><a href="/reseller/pokemon-haendler/">Pokémon für Händler: Deals &amp; Bewertungs-Leitfaden</a></li><li><a href="/reseller/pokemon-haendler/faelschungen-erkennen/">Fälschungen erkennen</a></li><li><a href="/reseller/pokemon-haendler/seltenheiten-ziehraten/">Seltenheiten und Ziehraten</a></li><li><a href="/reseller/angebote/">Sammlerware direkt von perldeals kaufen</a></li><li><a href="/reseller/ebay-shop/">Unser eBay-Shop & Live-Auktionen</a></li><li><a href="/reseller/release-kalender/">Release-Kalender Pokémon &amp; One Piece</a></li></ul>`),
      faq,
      ld:[{"@context":"https://schema.org","@type":"Service","name":"Ankauf von Sammelkarten und Retro-Konsolen (Pokémon, One Piece, Yu-Gi-Oh, Nintendo, Sega)","serviceType":"Ankauf von Sammelkarten und Retro-Konsolen","description":"Ankauf von Pokémon-, One-Piece- und Yu-Gi-Oh-Karten, Sammlungen, gegradeten Karten und versiegelten Produkten sowie Retro-Konsolen und Videospielen (Nintendo 64, Super Nintendo, Game Boy, Sega, PlayStation). Anfrage per WhatsApp oder E-Mail, Angebot kostenlos und unverbindlich.","provider":{"@id":`${BASE}/#org`},"areaServed":{"@type":"Country","name":"Deutschland"},"url":BASE+AK,"availableChannel":{"@type":"ServiceChannel","serviceUrl":BASE+AK,"servicePhone":{"@type":"ContactPoint","telephone":WA_PHONE,"contactType":"Ankauf","availableLanguage":["de","en"]}}}]});
  }
  // Ankauf-Unterseiten je Kategorie
  const AKD = fs.existsSync(`${SRC}/data/ankauf.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/ankauf.json`, "utf8")) : {pages:[]};
  for (const a of AKD.pages) {
    const path = `/reseller/ankauf/${a.slug}/`;
    const txt = `Hallo perldeals, ich möchte ${a.what} verkaufen (über perldeals.com${path}).\n\nWas genau: \nUngefähre Anzahl: \nZustand: \nPreisvorstellung (optional): \nPLZ / Ort: \n\nFotos schicke ich gleich mit.`;
    const cta = `<div class="ak-cta"><a class="btn btn-primary" href="${esc(`https://wa.me/${WA_PHONE.slice(1)}?text=${encodeURIComponent(txt)}`)}" rel="noopener">📲 ${esc(a.what)} per WhatsApp anbieten</a><a class="btn btn-ghost" href="${esc(`mailto:kontakt@perldeals.com?subject=${encodeURIComponent("Ankauf: "+a.what)}&body=${encodeURIComponent(txt.replace("Fotos schicke ich gleich mit.","Fotos hänge ich an."))}`)}">✉️ Per E-Mail anbieten</a><a class="btn btn-ghost" href="/reseller/ankauf/auftrag/">📦 Ankauf-Auftrag: einschicken</a></div>`;
    const others = AKD.pages.filter(x => x.slug !== a.slug);
    const faq = [...a.faq, ["Was kostet die Anfrage?","Nichts. Anfrage und Angebot sind kostenlos und unverbindlich. Du entscheidest danach, ob du verkaufst."], ["Wie läuft der Ankauf ab?","Fotos und Eckdaten per WhatsApp oder E-Mail schicken, wir prüfen anhand aktueller Marktpreise und melden uns mit einem Angebot. Passt es, sprechen wir Übergabe oder versicherten Versand und die Bezahlung ab."], ["Was kauft ihr nicht an?","Fälschungen, Proxies und Nachbauten sowie beschädigte oder defekte Ware."]];
    rsPage({path, active:"ankauf", trail:[["Ankauf", "/reseller/karten-ankauf/"], [a.what]], eyebrow:`Ankauf · ${a.what} · deutschlandweit`, h1:a.h1, lead:esc(a.lead), title:`${a.title} · perldeals`, desc:a.desc,
      body:`<div class="wrap">${cta}</div>`
        + rsSec(`Diese ${esc(a.what)} kaufen wir an`, `<ul class="tips">${a.buy.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`)
        + rsSec("So läuft der Ankauf", `<ol class="ak-steps"><li><strong>Fotos schicken</strong> per WhatsApp oder E-Mail – die Nachricht ist vorausgefüllt.</li><li><strong>Angebot bekommen.</strong> Wir bewerten nach aktuellen, tatsächlich erzielten Marktpreisen.</li><li><strong>Entscheiden.</strong> Kostenlos und unverbindlich.</li><li><strong>Übergabe oder Versand</strong> und Bezahlung stimmen wir direkt mit dir ab.</li></ol>`)
        + rsSec("Tipps für ein gutes Angebot", `<ul class="tips">${a.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>${cta}`)
        + akForm(({"pokemon-karten":"Pokémon-Karten","yugioh-karten":"Yu-Gi-Oh-Karten","one-piece-karten":"One-Piece-Karten","retro-konsolen":"Retro-Konsolen","videospiele":"Videospiele","lego":"LEGO"})[a.slug])
        + rsSec("Ankauf: weitere Kategorien", `<nav class="chips topic-chips">${others.map(x => `<a class="chip" href="/reseller/ankauf/${x.slug}/">${esc(x.what)}</a>`).join("")}<a class="chip" href="/reseller/karten-ankauf/">Alle Infos zum Ankauf</a><a class="chip" href="/reseller/ebay-shop/">🛒 Unser eBay-Shop</a></nav>${a.links.length ? `<ul class="link-list">${a.links.map(([u,n]) => `<li><a href="${u}">${esc(n)}</a></li>`).join("")}</ul>` : ""}`),
      faq,
      ld:[{"@context":"https://schema.org","@type":"Service","name":`Ankauf von ${a.what}`,"serviceType":`${a.what} Ankauf`,"description":a.desc,"provider":{"@id":`${BASE}/#org`},"areaServed":{"@type":"Country","name":"Deutschland"},"url":BASE+path}]});
  }
  /* Nico 08.11.: Einsende-Auftrag mit Ankaufbedingungen (Kunde schickt Ware ein, wir prüfen, machen ein verbindliches Angebot) */
  const AK_TERMS = "/reseller/ankauf/bedingungen/";
  const akSteps = `<ol class="ak-steps"><li><strong>Auftrag online erstellen.</strong> Du trägst ein, was du verkaufen möchtest, und bestätigst die <a href="${AK_TERMS}">Ankaufbedingungen</a>. Das ist noch kein Verkauf.</li><li><strong>Auftragsbestätigung per E-Mail.</strong> Darin stehen deine Auftragsnummer, unsere Versandadresse und ein Begleitzettel zum Ausdrucken.</li><li><strong>Gut verpackt einschicken.</strong> Karten in Hüllen und Toploadern, ab 50 € Warenwert versichert und mit Sendungsnummer. Den Versand zahlst du zunächst selbst, beim Ankauf erstatten wir ihn.</li><li><strong>Prüfung und verbindliches Angebot.</strong> Wir prüfen Echtheit und Zustand in der Regel innerhalb von 5 Werktagen nach Eingang und schicken dir ein Angebot per E-Mail, gültig für 7 Tage.</li><li><strong>Du entscheidest.</strong> Nimmst du an, überweisen wir innerhalb von 3 Werktagen. Lehnst du ab, senden wir alles versichert zurück; das Rückporto zahlst du.</li></ol>`;
  const akOrderForm = `<section class="wrap section" id="auftrag-formular"><h2>Ankauf-Auftrag erstellen</h2>
  <p class="ak-err" id="ak-err" hidden></p>
  <form class="ak-form" method="post" action="/api/auftrag.php">
    <div class="rr-row"><label class="rr-f"><span>Vor- und Nachname *</span><input name="name" required maxlength="80" autocomplete="name"></label><label class="rr-f"><span>E-Mail *</span><input name="email" type="email" required maxlength="254" autocomplete="email"></label></div>
    <div class="rr-row"><label class="rr-f"><span>Straße und Hausnummer *</span><input name="street" required maxlength="100" autocomplete="street-address"></label><label class="rr-f"><span>PLZ und Ort *</span><input name="city" required maxlength="80" placeholder="z. B. 49170 Hagen"></label></div>
    <div class="rr-row"><label class="rr-f"><span>Telefon/WhatsApp (optional)</span><input name="phone" maxlength="40" autocomplete="tel" inputmode="tel"></label><label class="rr-f"><span>Kategorie *</span><select name="kategorie"><option>Pokémon-Karten</option><option>One-Piece-Karten</option><option>Yu-Gi-Oh-Karten</option><option>Andere Sammelkarten</option><option>Retro-Konsolen</option><option>Videospiele</option><option>LEGO</option><option>Sonstiges</option></select></label></div>
    <label class="rr-f"><span>Was schickst du ein? * <small>(eine Position pro Zeile: Anzahl, Karte bzw. Produkt, Set, Sprache, Zustand)</small></span><textarea name="positionen" required minlength="10" maxlength="4000" rows="6" placeholder="1x Glurak ex 199/165, Karmesin &amp; Purpur 151, Deutsch, Near Mint&#10;1x Display Prismatische Entwicklungen, Englisch, versiegelt&#10;ca. 300 Bulk-Karten, Deutsch, gemischt"></textarea></label>
    <div class="rr-row"><label class="rr-f"><span>Preisvorstellung gesamt (optional)</span><input name="preis" maxlength="20" inputmode="decimal" placeholder="z. B. 250 €"></label><label class="rr-f"><span>Schon ein Angebot von uns? (optional)</span><input name="bezug" maxlength="80" placeholder="z. B. per WhatsApp am 07.11., 180 €"></label></div>
    <label class="rr-f rr-chk"><input type="checkbox" name="agb" value="1" required> <span>Ich habe die <a href="${AK_TERMS}" target="_blank">Ankaufbedingungen</a> gelesen und akzeptiere sie. Mir ist klar, dass erst mit meiner Annahme eures Angebots ein Kaufvertrag zustande kommt. *</span></label>
    <label class="rr-f rr-chk"><input type="checkbox" name="eigentum" value="1" required> <span>Ich bin mindestens 18 Jahre alt, Eigentümer der Ware und darf frei über sie verfügen. Es handelt sich nach meinem Wissen um Originalware. *</span></label>
    <p class="sub-legal">Wir verwenden deine Angaben nur, um den Auftrag abzuwickeln (Art. 6 Abs. 1 lit. b DSGVO). Mehr dazu in der <a href="/datenschutz/">Datenschutzerklärung</a>.</p>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn-primary" type="submit">Auftrag erstellen und Versandadresse erhalten</button>
  </form></section>`;
  rsPage({path:"/reseller/ankauf/auftrag/", active:"ankauf", trail:[["Ankauf", "/reseller/karten-ankauf/"], ["Ankauf-Auftrag"]], eyebrow:"Ankauf · Einsenden",
    h1:"Ankauf-Auftrag: Karten, Konsolen & LEGO einschicken",
    lead:"Du möchtest deine Sammlerstücke direkt zu uns schicken? Erstelle hier einen Ankauf-Auftrag. Du bekommst sofort eine Auftragsbestätigung mit Versandadresse und Begleitzettel. Wir prüfen die Ware und machen dir ein verbindliches Angebot. Verkauft wird erst nach deiner Zusage.",
    title:"Ankauf-Auftrag: Karten einschicken & verkaufen · perldeals", desc:"Sammelkarten, Retro-Konsolen und LEGO an perldeals verkaufen: Auftrag online erstellen, einschicken, verbindliches Angebot nach Prüfung, Auszahlung per Überweisung binnen 3 Werktagen.",
    body: rsSec("So funktioniert der Ankauf per Einsendung", akSteps) + akOrderForm
      + rsSec("Gut zu wissen", `<ul class="tips"><li>Bei wertvollen Einzelkarten schick uns vorher gern Fotos per WhatsApp. Dann bekommst du schon vor dem Versand eine Einschätzung.</li><li>Fälschungen, Proxies und beschädigte Ware kaufen wir nicht an. Sie gehen auf deine Kosten zurück.</li><li>Leg den Begleitzettel aus der E-Mail ins Paket oder schreib die Auftragsnummer gut lesbar auf einen Zettel.</li><li>Alle Details stehen in den <a href="${AK_TERMS}">Ankaufbedingungen</a>.</li></ul>`)});
  rsPage({path:"/reseller/ankauf/auftrag-danke/", active:"ankauf", trail:[["Ankauf", "/reseller/karten-ankauf/"], ["Auftrag erstellt"]], eyebrow:"Ankauf-Auftrag", h1:"Danke, dein Ankauf-Auftrag ist erstellt!",
    lead:"Wir haben dir eine Auftragsbestätigung per E-Mail geschickt. Darin findest du deine Auftragsnummer, unsere Versandadresse und einen Begleitzettel. Keine E-Mail da? Schau bitte im Spam-Ordner nach oder schreib uns an kontakt@perldeals.com.",
    title:"Ankauf-Auftrag erstellt · perldeals", desc:"Dein Ankauf-Auftrag bei perldeals ist erstellt.", noindex:true,
    body: rsSec("Wie geht es weiter?", akSteps) + `<div class="wrap"><p><a class="btn btn-primary" href="/reseller/">Zu den Reseller-Deals</a></p></div>`});
  const akT = [
    ["1. Geltungsbereich", "Diese Bedingungen gelten für den Ankauf von Sammelkarten, versiegelten Sammelkartenprodukten, Retro-Konsolen, Videospielen, LEGO und vergleichbarer Sammlerware durch perldeals (Anbieter siehe <a href=\"/impressum/\">Impressum</a>) im Wege der Einsendung. Verkäufer ist, wer über perldeals.com einen Ankauf-Auftrag erstellt."],
    ["2. Ankauf-Auftrag, noch kein Kaufvertrag", "Mit dem Ankauf-Auftrag bittet der Verkäufer perldeals, die eingesandte Ware zu prüfen und ein Angebot abzugeben. Der Auftrag ist für beide Seiten noch kein Kaufvertrag. Vorab per WhatsApp oder E-Mail genannte Preise sind unverbindliche Einschätzungen auf Grundlage von Fotos."],
    ["3. Versand an perldeals", "Der Verkäufer schickt die Ware gut verpackt an die Adresse aus der Auftragsbestätigung und legt den Begleitzettel oder die Auftragsnummer bei. Bis zum Eingang bei perldeals trägt der Verkäufer Versandkosten und Versandrisiko. Wir empfehlen ab einem Warenwert von 50 € einen versicherten Versand mit Sendungsnummer. Kommt ein Kaufvertrag zustande, erstattet perldeals die nachgewiesenen Kosten eines versicherten Standardversands innerhalb Deutschlands."],
    ["4. Prüfung und Angebot", "perldeals prüft Echtheit, Vollständigkeit und Zustand in der Regel innerhalb von 5 Werktagen nach Eingang und schickt dem Verkäufer ein verbindliches Ankaufangebot per E-Mail. Das Angebot kann sich auf einzelne Positionen beschränken. Es gilt 7 Tage ab Versand der E-Mail."],
    ["5. Vertragsschluss und Bezahlung", "Der Kaufvertrag kommt zustande, wenn der Verkäufer das Angebot innerhalb der Frist per E-Mail annimmt. perldeals überweist den Kaufpreis zuzüglich der zu erstattenden Versandkosten innerhalb von 3 Werktagen nach Annahme auf das vom Verkäufer genannte Konto. Das Eigentum an der Ware geht mit der Zahlung auf perldeals über."],
    ["6. Ablehnung, Teilankauf und Rücksendung", "Lehnt der Verkäufer das Angebot ab, lässt er die Frist verstreichen oder kauft perldeals einzelne Positionen nicht an, sendet perldeals die betroffene Ware versichert an die Adresse des Verkäufers zurück. Die Kosten der Rücksendung teilt perldeals vorher mit; sie trägt der Verkäufer und zahlt sie vor der Rücksendung. Bis dahin bewahrt perldeals die Ware sorgfältig auf."],
    ["7. Fälschungen und unzulässige Ware", "Fälschungen, Proxies, Nachbauten und Repro-Module kauft perldeals nicht an; sie werden nach Ziffer 6 zurückgesandt. Bei Ware, die erkennbar aus einer Straftat stammt, behält sich perldeals vor, die zuständigen Behörden zu informieren."],
    ["8. Zusicherungen des Verkäufers", "Der Verkäufer versichert, dass er mindestens 18 Jahre alt und Eigentümer der Ware ist, frei über sie verfügen darf und die Ware nach seinem Wissen Originalware ist. Bekannte Mängel gibt er im Auftrag an."],
    ["9. Haftung", "Für Verlust oder Beschädigung der Ware, solange sie sich bei perldeals befindet, haftet perldeals nach den gesetzlichen Vorschriften. Im Übrigen haftet perldeals nur für Vorsatz und grobe Fahrlässigkeit; das gilt nicht bei Verletzung von Leben, Körper oder Gesundheit und bei Verletzung wesentlicher Vertragspflichten."],
    ["10. Datenschutz", "perldeals verarbeitet die Angaben aus dem Ankauf-Auftrag nur zur Abwicklung des Auftrags und des Kaufvertrags. Einzelheiten stehen in der <a href=\"/datenschutz/\">Datenschutzerklärung</a>."],
    ["11. Schlussbestimmungen", "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Zwingende Verbraucherschutzvorschriften des Staates, in dem ein Verbraucher seinen gewöhnlichen Aufenthalt hat, bleiben unberührt."]
  ];
  rsPage({path:AK_TERMS, active:"ankauf", trail:[["Ankauf", "/reseller/karten-ankauf/"], ["Ankaufbedingungen"]], eyebrow:"Ankauf", h1:"Ankaufbedingungen für Einsendungen",
    lead:"So läuft der Ankauf ab, wenn du Ware an perldeals schickst: vom Auftrag über die Prüfung bis zur Bezahlung. Stand: 08.11.2026.",
    title:"Ankaufbedingungen · perldeals", desc:"Ankaufbedingungen von perldeals für eingesandte Sammelkarten, Konsolen und LEGO: Auftrag, Versand, Prüfung, Angebot, Bezahlung und Rücksendung.",
    body:`<div class="wrap prose">${akT.map(([h,t]) => `<h2>${h}</h2><p>${t}</p>`).join("")}<p><a class="btn btn-primary" href="/reseller/ankauf/auftrag/">Ankauf-Auftrag erstellen</a></p></div>`});
  rsPage({path:"/reseller/ankauf/danke/", active:"ankauf", trail:[["Ankauf", "/reseller/karten-ankauf/"], ["Danke"]], eyebrow:"Ankauf", h1:"Danke, deine Anfrage ist angekommen!", lead:"Wir sehen uns deine Angaben und Fotos an und melden uns per E-Mail oder WhatsApp mit einem kostenlosen, unverbindlichen Angebot.", title:"Anfrage gesendet · perldeals", desc:"Deine Ankauf-Anfrage bei perldeals ist angekommen.", noindex:true, body:`<div class="wrap"><p><a class="btn btn-primary" href="/reseller/">Zu den Reseller-Deals</a></p></div>`});
  // Eigener eBay-Shop + Live-Auktionen
  { const P = "/reseller/ebay-shop/";
    const btns = `<div class="ak-cta"><a class="btn btn-primary" href="${EBAY_SHOP}" target="_blank" rel="noopener">⭐ Auf eBay folgen & Shop ansehen</a><a class="btn btn-ghost" href="https://whatsapp.com/channel/0029VbDtsloHgZWfmyoCPe2q" target="_blank" rel="noopener">📲 Live-Termine per WhatsApp</a></div>`;
    rsPage({path:P, active:"ebay", trail:[["eBay-Shop & Live-Auktionen"]], eyebrow:"perldeals auf eBay · Shop & Live-Auktionen",
      h1:"Unser eBay-Shop: Sammelkarten, Konsolen & Live-Auktionen",
      lead:"Was wir ankaufen, landet geprüft in unserem eBay-Shop: Pokémon- und One-Piece-Karten, Retro-Konsolen, generalüberholte iPads, Laptops und PCs. Regelmäßig versteigern wir seltene Stücke live bei eBay Live. Folge uns, damit du keine Auktion verpasst.",
      title:"perldeals eBay-Shop: Pokémon-Karten, Konsolen & Live-Auktionen",
      desc:"Unser eBay-Shop mit Pokémon- und Sammelkarten, Retro-Konsolen, generalüberholter Technik und regelmäßigen Live-Auktionen bei eBay Live. Jetzt folgen und keine Auktion verpassen.",
      body:`<div class="wrap">${new Date() <= new Date("2026-11-28T23:59:59+01:00") ? `<p class="note"><strong>Shop-Pause bis 28.11.:</strong> Unsere Artikel sind bis dahin auf eBay ausgeblendet, ab 29.11. sind sie wieder da und werden verschickt. Folge uns jetzt, dann meldet eBay dir, sobald es weitergeht – auch die nächste Live-Auktion.</p>` : ""}${btns}</div>`
        + rsSec("Was du bei uns findest", `<ul class="tips"><li><strong>Sammelkarten</strong>: Pokémon, One Piece, Yu-Gi-Oh – Einzelkarten, Holos, gegradete Karten und versiegelte Produkte</li><li><strong>Konsolen & Retro-Games</strong>: Nintendo, Game Boy, PlayStation, Sega und Spiele</li><li><strong>Generalüberholte Technik</strong>: iPads, Laptops und PCs</li><li><strong>Sammlungen & Raritäten</strong>: besondere Stücke aus unserem Ankauf</li></ul>`)
        + rsSec("Live-Auktionen bei eBay Live", `<p>In unseren Live-Streams auf eBay Live zeigen wir seltene Artikel vor der Kamera und versteigern sie live – du siehst jedes Detail, kannst Fragen im Chat stellen und mitbieten. So geht’s:</p><ol class="ak-steps"><li><strong>Folgen:</strong> Öffne unser <a href="${EBAY_SHOP}" target="_blank" rel="noopener">eBay-Profil</a> und tippe auf „Folgen“. Dann informiert dich eBay, wenn wir live gehen oder neue Artikel einstellen.</li><li><strong>Erinnern lassen:</strong> Live-Termine kündigen wir zusätzlich im <a href="/whatsapp/">WhatsApp-Kanal</a> und auf <a href="/telegram/">Telegram</a> an.</li><li><strong>Mitbieten:</strong> In der eBay-App den Live-Stream öffnen und direkt im Stream bieten.</li></ol>`)
        + rsSec("Selbst etwas verkaufen?", `<p>Du hast Karten, Konsolen oder LEGO, die du loswerden möchtest? Wir kaufen an: <a href="/reseller/karten-ankauf/">Ankauf – kostenloses Angebot</a>. Und mit dem <a href="/reseller/rechner/">Reseller-Rechner</a> siehst du, was nach eBay-Gebühren übrig bleibt.</p>${btns}`),
      faq:[["Wo finde ich den perldeals eBay-Shop?","Unter ebay.de/usr/boekenkroeger_handelgesellschaft. Dort siehst du alle Artikel, unsere Bewertungen und kannst uns folgen."],["Was ist eBay Live?","eBay Live ist das Live-Shopping von eBay: Verkäufer zeigen Artikel im Video-Stream und versteigern oder verkaufen sie in Echtzeit. Zuschauer können im Chat Fragen stellen und direkt mitbieten."],["Wie verpasse ich keine Live-Auktion?","Folge uns auf eBay, dann bekommst du eine Benachrichtigung, sobald wir live gehen. Zusätzlich kündigen wir Termine im WhatsApp- und Telegram-Kanal an."],["Kauft ihr auch an?","Ja, wir kaufen Sammelkarten, Retro-Konsolen, Videospiele und LEGO an. Fotos per WhatsApp oder über das Ankauf-Formular schicken."]],
      ld:[{"@context":"https://schema.org","@type":"Store","name":"perldeals eBay-Shop","url":EBAY_SHOP,"sameAs":[EBAY_SHOP],"description":"Sammelkarten, Konsolen, generalüberholte Technik und Live-Auktionen bei eBay Live.","parentOrganization":{"@id":`${BASE}/#org`}}]});
  }
  // Eigene Angebote
  const own = rsOwn();
  rsPage({path:"/reseller/angebote/", active:"angebote", trail:[["perldeals-Angebote"]], eyebrow:"Direkt von perldeals", h1:"Sammlerware direkt von perldeals: Karten, LEGO, Konsolen",
    lead:"Hier bieten wir ausgewählte Ware aus unserem Netzwerk direkt an: versiegelte Sammelkarten, LEGO-Sets, Konsolen und mehr. Kein Affiliate-Link, du kaufst direkt bei uns.",
    title:"Sammlerware kaufen: Pokémon, LEGO, Konsolen direkt von perldeals", desc:"Ausgewählte Sammlerware direkt von perldeals: versiegelte Pokémon- und One-Piece-Produkte, LEGO-Sets und Konsolen zu fairen Preisen. Neue Angebote per Deal-Alarm.",
    body:`<div class="wrap">${own.length ? `<ul class="rs-promos">${own.map(rsOwnCard).join("")}</ul>` : `<section class="section"><p><strong>Gerade ist alles weg.</strong> Neue Angebote kommen unregelmäßig und sind oft schnell verkauft. Aktiviere den Deal-Alarm mit dem Thema „Angebote von perldeals“, dann bekommst du sie als Erstes.</p></section>`}
      <p><a class="btn btn-ghost" href="https://wa.me/${WA_PHONE.slice(1)}?text=${encodeURIComponent("Hallo perldeals, ich interessiere mich für eure Sammlerware-Angebote.")}" rel="noopener">Frage per WhatsApp</a></p>${rsAlarmBox("reseller-angebote", ["netzwerk"])}</div>`,
    faq:[["Wie kaufe ich ein Angebot von perldeals?","Schreib uns per WhatsApp mit dem Namen des Angebots. Wir bestätigen Verfügbarkeit, Preis und Versand oder Abholung."],["Sind das Affiliate-Angebote?","Nein. Diese Angebote verkaufen wir direkt. Alle anderen Deals auf perldeals führen über Partnerlinks zu den Shops."]],
    ld: own.length ? [{"@context":"https://schema.org","@type":"ItemList","itemListElement":own.map((o,i) => ({"@type":"ListItem","position":i+1,"item":{"@type":"Product","name":o.title,"offers":{"@type":"Offer","price":o.price,"priceCurrency":"EUR","availability":o.status === "verfügbar" ? "https://schema.org/InStock" : "https://schema.org/SoldOut","seller":{"@id":`${BASE}/#org`}}}}))}] : []});
}
/* ---------------- Englische Themen-, Marken- und Wissensseiten ---------------- */
const TOPICS_EN = fs.existsSync(`${SRC}/data/topics-en.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/topics-en.json`, "utf8")) : {};
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_EN = `${MONTHS_EN[NOW_D.getMonth()]} ${NOW_D.getFullYear()}`;
const TOPIC_EN_PATH = T => `/en/offers/${slugify(TOPICS_EN[T.slug].kw)}/`;
const BRAND_EN_PATH = k => `/en/brand/${k}/`;
const WISSEN_EN = fs.existsSync(`${SRC}/data/wissen-en.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/wissen-en.json`, "utf8")) : {};
const WISSEN_EN_PATH = slug => `/en/knowledge/${WISSEN_EN[slug].enSlug}/`;
const oldListEn = (list, n) => !list.length ? "" : `<section class="section"><h2>Recently expired deals</h2><p>These offers are over. They show which prices were possible lately.</p><ul class="link-list">${list.slice(0, n).map(a => `<li><a href="${R.deal.en(a.id)}">${esc((a.title.en||a.title.de))}</a>${NP(a) ? "" : `: last ${eur(a.now,"en")} instead of ${eur(a.was,"en")} (−${pct(a)}%)`}</li>`).join("")}</ul></section>`;
const topicChipsEn = list => `<nav class="chips topic-chips" aria-label="Topics">${list.map(T => `<a class="chip" href="${TOPIC_EN_PATH(T)}">${esc(TOPICS_EN[T.slug].h.replace(/ Deals$/,""))} <span class="n">${TOPIC_LIVE[T.slug].length}</span></a>`).join("")}</nav>`;
function buildTopicEn(T){
  const E = TOPICS_EN[T.slug]; if (!E) return;
  const live = TOPIC_LIVE[T.slug], old = TOPIC_OLD[T.slug], indexed = topicIndexed(T);
  const shops = [...new Set(live.map(shopName))].slice(0, 5);
  const priced = live.filter(d => !NP(d)), maxPct = priced.length ? Math.max(...priced.map(pct)) : 0, minPrice = priced.length ? Math.min(...priced.map(d=>d.now)) : 0;
  const cr = crumbs("en", [["Home", R.home.en], ["Deals by topic", "/en/offers/"], [E.h]]);
  const faq = [
    [`When are ${E.kw} deals cheapest in Germany?`, `Prices often drop around shopping events such as Black Friday (27 November 2026), Cyber Week and Prime Day, and when a successor model comes out. With a perldeals price alert you get an email as soon as a price falls.`],
    [`How many ${E.kw} deals are there right now?`, live.length ? `We currently list ${live.length} checked offers${maxPct?`, with up to ${maxPct}% off`:""}${minPrice?` and from ${eur(minPrice,"en")}`:""}. As of ${STAMP("en")}.` : `There is no checked deal right now. We look for new offers several times a day.`],
    [`How does perldeals check deals?`, `We compare the current price with the price history and other shops. Deals with fake discounts (an inflated strike-through price) are left out. Links are affiliate links; your price stays the same.`]
  ];
  const sib = TOPICS.filter(x => x.slug !== T.slug && x.group === T.group && topicIndexed(x) && TOPICS_EN[x.slug]).slice(0, 12);
  const ld = [{"@context":"https://schema.org", ...cr.ld}, faqLd(faq), {"@context":"https://schema.org","@type":"ItemList","name":E.h,"numberOfItems":live.length,"itemListElement":live.slice(0,20).map((d,i)=>({"@type":"ListItem","position":i+1,"url":BASE+R.deal.en(d.id),"name":d.title.en}))}];
  const body = `<div class="wrap">${cr.html}<div class="feed-head topic-head" style="display:block"><div class="eyebrow">Deals in Germany · ${esc(MONTH_EN)}</div><h1>${esc(E.h)} ${esc(MONTH_EN)}</h1>
    <p class="lead">${esc(E.intro)}</p>
    <p class="topic-facts">${live.length ? `<strong>${live.length} ${live.length===1?"deal":"deals"}</strong>${maxPct?` · up to −${maxPct}%`:""}${minPrice?` · from ${eur(minPrice,"en")}`:""}${shops.length?` · at ${esc(shops.join(", "))}`:""} · as of ${STAMP("en")}` : `No checked deal right now. Set a price alert so you don't miss the next one.`}</p></div></div>
    ${live.length ? grid(live, "en", "h2", `Current ${E.kw} deals`) : ""}
    <div class="wrap">
    <section class="section"><h2>What to look for when buying</h2><ul class="tips">${E.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>${T.best && BEST[T.best] ? `<ul class="link-list"><li><a href="${R.best.en(T.best)}">Best list: ${esc(BEST[T.best].en.h1 || BEST[T.best].en.title)}</a></li></ul>` : ""}</section>
    ${oldListEn(old, 8)}
    <section class="section faq"><h2>FAQ</h2>${faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>
    ${sib.length ? `<section class="section"><h2>Related deals</h2>${topicChipsEn(sib)}</section>` : ""}
    ${followBox("en")}</div>`;
  const desc = live.length ? `${live.length} checked ${E.kw} deals in Germany, ${MONTH_EN}${maxPct?`, up to ${maxPct}% off`:""}. With price history, price alerts and no fake discounts. Updated daily.` : `${E.kw} deals in Germany with price history and price alerts. ${E.intro}`;
  layout({lang:"en", pathFor:l => l === "de" ? TOPIC_PATH(T.slug) : TOPIC_EN_PATH(T), title:`${E.title} · perldeals`, description:desc, body, ld, noindex:!indexed,
    image: live[0] && fs.existsSync(`${SRC}/assets/og/deal/${live[0].id}.jpg`) ? `/assets/og/deal/${live[0].id}.jpg` : ""});
}
function buildTopicIndexEn(){
  const G = {haushalt:"Household", kueche:"Kitchen", tv:"TV & home cinema", audio:"Audio", computer:"Computers & gaming", phone:"Phones & wearables", smarthome:"Smart home & security", garten:"Garden", werkzeug:"Tools & e-mobility", sport:"Sport & mobility", spielzeug:"Toys & LEGO", vegan:"Vegan", preis:"By price"};
  const cr = crumbs("en", [["Home", R.home.en], ["Deals by topic"]]);
  const sec = Object.entries(G).map(([g, name]) => { const l = TOPICS.filter(T => T.group === g && topicIndexed(T) && TOPICS_EN[T.slug]); return l.length ? `<section class="section"><h2>${name}</h2>${topicChipsEn(l)}</section>` : ""; }).join("");
  const br = BRANDS.filter(b => brandLive(b.key).length).sort((a,b)=>a.name.localeCompare(b.name));
  const body = `<div class="wrap">${cr.html}<div class="feed-head" style="display:block"><h1>Deals in Germany by topic and brand</h1><p class="lead">All checked deals from German shops, sorted by product type, budget and brand. Every page shows only current offers with price history, updated daily.</p></div>${sec}
    <section class="section"><h2>By brand</h2><nav class="chips topic-chips" aria-label="Brands">${br.map(b => `<a class="chip" href="${BRAND_EN_PATH(b.key)}">${esc(b.name)} <span class="n">${brandLive(b.key).length}</span></a>`).join("")}</nav></section></div>`;
  layout({lang:"en", pathFor:l => l === "de" ? "/angebote/" : "/en/offers/", title:"Deals in Germany by topic and brand · perldeals", description:`All checked deals in Germany by product type, price and brand: robot vacuums, TVs, headphones, laptops, LEGO, vegan products and more. ${MONTH_EN}.`, body, ld:[{"@context":"https://schema.org", ...cr.ld}]});
}
function buildBrandEn(b){
  const live = brandLive(b.key), old = EXPIRED.filter(a => brandKeyOf(a) === b.key && a.now && a.was);
  const cats = [...new Set(live.concat(old).map(d => CATS[d.cat] ? CATS[d.cat].en[0] : null).filter(Boolean))];
  const shops = [...new Set(live.concat(old).map(shopName))];
  const maxPct = live.filter(d => !NP(d)).length ? Math.max(...live.filter(d => !NP(d)).map(pct)) : 0;
  const cr = crumbs("en", [["Home", R.home.en], ["Deals by topic", "/en/offers/"], [`${b.name} deals`]]);
  const faq = [
    [`Where are ${b.name} products cheap in Germany right now?`, live.length ? `We currently have ${live.length} checked ${b.name} deals at ${[...new Set(live.map(shopName))].join(", ")}${maxPct?`, with up to ${maxPct}% off`:""}.` : `There is no checked ${b.name} deal right now. So far we had offers at ${shops.join(", ")}.`],
    [`When is ${b.name} cheapest?`, `Around Black Friday (27 November 2026), Cyber Monday and Prime Day, and when new models launch, prices often drop noticeably. The price history on every deal page shows whether a price is really good.`]
  ];
  const body = `<div class="wrap">${cr.html}<div class="feed-head" style="display:block"><div class="eyebrow">Brand · ${esc(MONTH_EN)}</div><h1>${esc(b.name)} deals in Germany ${esc(MONTH_EN)}</h1>
    <p class="lead">All checked ${esc(b.name)} deals at a glance${cats.length?`: ${esc(cats.join(", "))}`:""}. We compare every price with its price history, fake discounts are left out.</p>
    <p class="topic-facts">${live.length ? `<strong>${live.length} ${live.length===1?"deal":"deals"}</strong>${maxPct?` · up to −${maxPct}%`:""} · as of ${STAMP("en")}` : "No checked deal right now."}</p></div></div>
    ${live.length ? grid(live, "en", "h2", `Current ${b.name} deals`) : ""}
    <div class="wrap">${oldListEn(old, 10)}
    <section class="section faq"><h2>FAQ</h2>${faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>${followBox("en")}</div>`;
  layout({lang:"en", pathFor:l => l === "de" ? BRAND_PATH(b.key) : BRAND_EN_PATH(b.key), title:`${b.name} deals in Germany ${MONTH_EN} · perldeals`, description: live.length ? `${live.length} checked ${b.name} deals in Germany${maxPct?` with up to ${maxPct}% off`:""}: ${cats.slice(0,4).join(", ")}. With price history and price alerts, updated daily.` : `${b.name} deals in Germany with price history and price alerts. Recently expired deals and prices.`, body, ld:[{"@context":"https://schema.org", ...cr.ld}, faqLd(faq)], noindex: !live.length});
}
function buildWissenEn(w){
  const E = WISSEN_EN[w.slug]; if (!E) return;
  const cr = crumbs("en", [["Home", R.home.en], ["Knowledge", "/en/knowledge/"], [E.title.split(":")[0]]]);
  const others = WISSEN.items.filter(x => x.slug !== w.slug && WISSEN_EN[x.slug]);
  const body = `<div class="wrap legal wissen">${cr.html}<div class="eyebrow">Knowledge · updated ${fmtDay(WISSEN.updated + "T12:00:00", "en")}</div><h1>${esc(E.title)}</h1><p class="lead">${esc(E.lead)}</p>
    ${E.sections.map(([h, ps]) => `<h2>${esc(h)}</h2>${ps.map(p => `<p>${esc(p)}</p>`).join("")}`).join("")}
    <section class="section faq"><h2>FAQ</h2>${E.faq.map(f => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}</section>
    <section class="section"><h2>Read more</h2><ul class="link-list"><li><a href="${R.bf.en}">Black Friday 2026 in Germany</a></li><li><a href="/en/offers/">Deals by topic</a></li>${others.slice(0,5).map(x => `<li><a href="${WISSEN_EN_PATH(x.slug)}">${esc(WISSEN_EN[x.slug].title)}</a></li>`).join("")}</ul></section>
    ${followBox("en")}</div>`;
  const ld = [{"@context":"https://schema.org", ...cr.ld}, faqLd(E.faq), {"@context":"https://schema.org","@type":"Article","headline":E.title,"description":E.desc,"inLanguage":"en","dateModified":WISSEN.updated,"datePublished":WISSEN.updated,"author":{"@type":"Organization","name":"perldeals","url":BASE+"/"},"publisher":{"@id":`${BASE}/#org`},"mainEntityOfPage":BASE+WISSEN_EN_PATH(w.slug)}];
  layout({lang:"en", pathFor:l => l === "de" ? `/wissen/${w.slug}/` : WISSEN_EN_PATH(w.slug), title:`${E.title} · perldeals`, description:E.desc, body, ld, type:"article"});
}
function buildWissenIndexEn(){
  const cr = crumbs("en", [["Home", R.home.en], ["Knowledge"]]);
  const body = `<div class="wrap legal">${cr.html}<h1>Shopping in Germany: knowledge to save money</h1><p class="lead">How to spot real deals, track prices and know your rights when buying online in Germany.</p><ul class="link-list">${WISSEN.items.filter(w => WISSEN_EN[w.slug]).map(w => `<li><a href="${WISSEN_EN_PATH(w.slug)}"><strong>${esc(WISSEN_EN[w.slug].title)}</strong></a><br><span>${esc(WISSEN_EN[w.slug].desc)}</span></li>`).join("")}</ul></div>`;
  layout({lang:"en", pathFor:l => l === "de" ? "/wissen/" : "/en/knowledge/", title:"Knowledge: fake discounts, price history, your rights · perldeals", description:"Guides for shopping in Germany: spot fake discounts, check Amazon price history, set price alerts, price errors, RRP, right of withdrawal and refurbished tech.", body, ld:[{"@context":"https://schema.org", ...cr.ld}]});
}
function buildShare(){
  const latest = [...DATA.deals].sort((a,b)=>b.added.localeCompare(a.added)).slice(0, 8);
  const line = d => `🔥 ${d.title.de}${isVegan(d)?" 🌱 vegan":""}\n💶 ${NP(d) ? `zuletzt gemeldet −${pct(d)} %` : `${eur(d.now,"de")} statt ${eur(d.was,"de")} (−${pct(d)} %)`} bei ${shopName(d)}${d.low?" · Bestpreis":""}\n👉 ${BASE}${R.deal.de(d.id)}?utm_source=whatsapp`;
  const digest = `💎 Die Perlen des Tages, ${fmtDay(DATA.updated,"de")}\n\n${latest.slice(0,5).map(line).join("\n\n")}\n\nAlle Deals: ${BASE}/?utm_source=whatsapp\n(Anzeige: Bei Käufen über die Links erhalten wir ggf. eine Provision. Preise vom ${STAMP("de")}, können sich ändern.)`;
  const box = (t, label, id) => `<div class="share-item"${id?` id="${id}"`:""}><textarea readonly rows="${t.split("\n").length+1}">${esc(t)}</textarea><button class="btn btn-primary" type="button" data-copy>${label}</button></div>`;
  // posting slots of the daily social task (Berlin time): each block lists the best deals added since the previous slot
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const yest = new Date(Date.now() - 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const SL = [["08:23", berlinDate(yest,19,23), berlinDate(today,8,23)], ["13:23", berlinDate(today,8,23), berlinDate(today,13,23)], ["19:23", berlinDate(today,13,23), berlinDate(today,19,23)]];
  const slotBlocks = SL.map(([label, from, to]) => {
    const top = DATA.deals.filter(d => { const t = new Date(d.added); return t >= from && t < to && pct(d) >= 15; }).sort((a,b) => dealScore(b) - dealScore(a)).slice(0, 3);
    const txt = top.length ? `🔥 Neue Top-Deals (${label.slice(0,2)} Uhr)\n\n${top.map(line).join("\n\n")}\n\nAlle Deals: ${BASE}/?utm_source=social\n(Anzeige: Bei Käufen über die Links erhalten wir ggf. eine Provision. Preise vom ${STAMP("de")}, können sich ändern.)` : "";
    return `<h3>Post ${label} Uhr (${today}): neu seit ${from.toLocaleString("de-DE",{timeZone:"Europe/Berlin",dateStyle:"short",timeStyle:"short"})}</h3>${txt ? box(txt, "Kopieren", "slot-"+label.slice(0,2)) : `<p id="slot-${label.slice(0,2)}">KEINE NEUEN TOP-DEALS – nichts posten.</p>`}`;
  }).join("");
  const body = `<div class="wrap legal"><div class="eyebrow">Intern</div><h1>Texte für WhatsApp</h1>
    <p>Kopieren, in WhatsApp im Kanal einfügen, senden. Stand: ${STAMP("de")}.</p>
    <h2>Neue Top-Deals je Post-Termin</h2><p>Die besten (höchstens 3) neuen Deals seit dem vorherigen Termin. Für WhatsApp-Kanal und Facebook-Gruppe.</p>${slotBlocks}
    <h2>Tageszusammenfassung (Top 5)</h2>${box(digest, "Zusammenfassung kopieren")}
    <h2>Einzelne Deals (neueste zuerst)</h2>${latest.map(d => box(line(d)+"\n(Anzeige)", "Kopieren")).join("")}</div>`;
  layout({lang:"de", pathFor:l=>"/teilen/", title:"Texte für WhatsApp · perldeals", description:"Interne Seite", body, noindex:true});
}

function buildAccount(lang){
  const de = lang==="de";
  const catNames = Object.fromEntries(Object.keys(CATS).map(k=>[k, CATS[k][lang][0]]));
  const L = de ? {
    h1:"Preisalarme und Konto", lead:"Lass dich per E-Mail benachrichtigen, sobald ein passender Deal auf perldeals erscheint. Kostenlos, jederzeit abbestellbar.",
    loginH:"Anmelden oder registrieren", loginP:"Gib deine E-Mail-Adresse ein. Wir schicken dir einen Anmeldelink, ein Passwort brauchst du nicht.", email:"E-Mail-Adresse", send:"Anmeldelink senden",
    loginLegal:`Mit der Anmeldung legst du ein Konto an. Wir speichern deine E-Mail-Adresse und deine Preisalarme. Details in der <a href="${R.privacy.de}">Datenschutzerklärung</a>.`,
    loggedAs:"Angemeldet als", logout:"Abmelden",
    alertH:"Neuer Preisalarm", kw:"Suchbegriff", kwPh:"z. B. AirPods Pro", cat:"Kategorie", anyCat:"Alle Kategorien", max:"Höchstpreis in € (optional)", create:"Alarm anlegen",
    alertHint:"Du bekommst eine E-Mail, sobald ein neuer Deal erscheint, der zu deinem Suchbegriff, der Kategorie und dem Höchstpreis passt.",
    listH:"Deine Preisalarme",
    prefsH:"E-Mail-Einstellungen", alerts:"Preisalarm-E-Mails erhalten", freq:"Wie oft?", instant:"Sofort, wenn ein passender Deal erscheint", daily:"Einmal täglich um 8 Uhr gesammelt",
    news:"Newsletter „Perlen des Tages“: die besten Deals einmal täglich per E-Mail (freiwillig, jederzeit abbestellbar)", save:"Einstellungen speichern",
    prefsNote:"In jeder E-Mail findest du unten einen Link zum Abbestellen. Er funktioniert mit einem Klick, auch ohne Anmeldung.",
    delH:"Konto löschen", delP:"Löscht dein Konto, alle Preisalarme und Einstellungen sofort und endgültig.", delBtn:"Konto löschen", delConfirm:"Wirklich löschen? Das lässt sich nicht rückgängig machen.", delYes:"Ja, endgültig löschen", delNo:"Abbrechen",
    loading:"Lädt …", title:"Preisalarme und Konto · perldeals", desc:"Preisalarme für Deals auf perldeals: Benachrichtigung per E-Mail, sobald ein passender Deal erscheint."
  } : {
    h1:"Price alerts and account", lead:"Get an email as soon as a matching deal appears on perldeals. Free, unsubscribe anytime.",
    loginH:"Sign in or register", loginP:"Enter your email address. We will send you a sign-in link, no password needed.", email:"Email address", send:"Send sign-in link",
    loginLegal:`Signing in creates an account. We store your email address and your price alerts. See our <a href="${R.privacy.en}">privacy policy</a>.`,
    loggedAs:"Signed in as", logout:"Sign out",
    alertH:"New price alert", kw:"Search term", kwPh:"e.g. AirPods Pro", cat:"Category", anyCat:"All categories", max:"Maximum price in € (optional)", create:"Create alert",
    alertHint:"You will get an email as soon as a new deal matches your search term, category and maximum price.",
    listH:"Your price alerts",
    prefsH:"Email settings", alerts:"Receive price alert emails", freq:"How often?", instant:"Immediately when a matching deal appears", daily:"Once a day at 8 am as a summary",
    news:"“Pearls of the day” newsletter: the best deals once a day by email (optional, unsubscribe anytime)", save:"Save settings",
    prefsNote:"Every email has an unsubscribe link at the bottom. It works with one click, even without signing in.",
    delH:"Delete account", delP:"Deletes your account, all price alerts and settings immediately and permanently.", delBtn:"Delete account", delConfirm:"Really delete? This cannot be undone.", delYes:"Yes, delete permanently", delNo:"Cancel",
    loading:"Loading …", title:"Price alerts and account · perldeals", desc:"Price alerts for deals on perldeals: get an email as soon as a matching deal appears."
  };
  const body = `<div class="wrap account" id="account" data-cats="${esc(JSON.stringify(catNames))}">
    <div class="feed-head" style="display:block"><h1>${L.h1}</h1><p class="lead">${L.lead}</p></div>
    <p id="acc-loading" class="note">${L.loading}</p>
    <section id="acc-login" class="panel" hidden>
      <h2>${L.loginH}</h2><p>${L.loginP}</p>
      <form id="login-form" class="row-form" novalidate>
        <label class="sr" for="login-email">${L.email}</label>
        <input id="login-email" type="email" autocomplete="email" required maxlength="254" placeholder="${L.email}">
        <div class="hp" aria-hidden="true"><label for="login-website">Website</label><input id="login-website" type="text" tabindex="-1" autocomplete="off"></div>
        <button class="btn btn-primary" type="submit">${L.send}</button>
      </form>
      <p id="login-note" class="form-note" role="status" hidden></p>
      <p class="small">${L.loginLegal}</p>
    </section>
    <div id="acc-app" hidden>
      <div class="acc-bar"><span>${L.loggedAs} <b id="acc-email"></b></span><button id="logout" class="btn btn-ghost" type="button">${L.logout}</button></div>
      <section class="panel"><h2>${L.alertH}</h2><p class="small">${L.alertHint}</p>
        <form id="alert-form" class="grid-form" novalidate>
          <div><label for="alert-kw">${L.kw}</label><input id="alert-kw" type="text" maxlength="80" placeholder="${L.kwPh}"></div>
          <div><label for="alert-cat">${L.cat}</label><select id="alert-cat"><option value="">${L.anyCat}</option>${Object.keys(CATS).map(k=>`<option value="${k}">${esc(CATS[k][lang][0])}</option>`).join("")}</select></div>
          <div><label for="alert-max">${L.max}</label><input id="alert-max" type="number" min="1" step="0.01" inputmode="decimal"></div>
          <div class="grid-form-btn"><button class="btn btn-primary" type="submit">${L.create}</button></div>
        </form>
        <p id="alert-note" class="form-note" role="status" hidden></p>
      </section>
      <section class="panel"><h2>${L.listH}</h2><ul id="alert-list" class="alert-list"></ul></section>
      <section class="panel"><h2>${L.prefsH}</h2>
        <form id="prefs-form" class="prefs">
          <label class="check"><input id="pref-alerts" type="checkbox"> ${L.alerts}</label>
          <fieldset><legend>${L.freq}</legend>
            <label class="check"><input id="pref-freq-instant" name="freq" type="radio" value="instant"> ${L.instant}</label>
            <label class="check"><input id="pref-freq-daily" name="freq" type="radio" value="daily"> ${L.daily}</label>
          </fieldset>
          <label class="check"><input id="pref-news" type="checkbox"> ${L.news}</label>
          <div><button class="btn btn-primary" type="submit">${L.save}</button></div>
          <p class="small">${L.prefsNote}</p>
        </form>
      </section>
      <section class="panel danger"><h2>${L.delH}</h2><p class="small">${L.delP}</p>
        <button id="delete-start" class="btn btn-ghost" type="button">${L.delBtn}</button>
        <div id="delete-confirm" hidden><p><b>${L.delConfirm}</b></p><button id="delete-go" class="btn btn-danger" type="button">${L.delYes}</button> <button id="delete-cancel" class="btn btn-ghost" type="button">${L.delNo}</button></div>
      </section>
    </div>
  </div>`;
  layout({lang, pathFor:l=>R.account[l], title:L.title, description:L.desc, body, noindex:true, scripts:["account.js"]});
}

/* Legal pages */
const addr = l => `${esc(SITE.operator)}<br>${esc(SITE.street)}<br>${esc(SITE.zip)} ${esc(SITE.city)}<br>${esc(SITE.country[l])}`;
const LEGAL = {
  imprint:{
    de:{title:"Impressum", html:`
      <div class="eyebrow">Angaben gemäß § 5 DDG</div><h1>Impressum</h1>
      <h2>Anbieter</h2><address>perldeals ist ein Angebot von<br><b>${addr("de")}</b></address>
      <h2>Kontakt</h2><p>E-Mail: ${esc(SITE.email)}${SITE.phone?`<br>Telefon: ${esc(SITE.phone)}`:""}</p>
      <h2>Umsatzsteuer</h2><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${esc(SITE.vatId)}</p>
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2><address>${addr("de")}</address>
      <h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      <h2>Haftung für Links</h2><p>Unsere Seiten enthalten Links zu Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese Inhalte ist der jeweilige Anbieter verantwortlich. Werden uns Rechtsverletzungen bekannt, entfernen wir die betroffenen Links umgehend.</p>
      <h2>Preise</h2><p>Alle Preise wurden zum angegebenen Zeitpunkt beim jeweiligen Shop abgerufen. Preise und Verfügbarkeit können sich jederzeit ändern. Maßgeblich ist der Preis im Shop zum Zeitpunkt des Kaufs.</p>`},
    en:{title:"Legal notice", html:`
      <div class="eyebrow">Information pursuant to § 5 DDG (German Digital Services Act)</div><h1>Legal notice</h1>
      <h2>Provider</h2><address>perldeals is operated by<br><b>${addr("en")}</b></address>
      <h2>Contact</h2><p>Email: ${esc(SITE.email)}${SITE.phone?`<br>Phone: ${esc(SITE.phone)}`:""}</p>
      <h2>VAT</h2><p>VAT identification number under § 27a UStG: ${esc(SITE.vatId)}</p>
      <h2>Responsible for content under § 18 (2) MStV</h2><address>${addr("en")}</address>
      <h2>Consumer dispute resolution</h2><p>We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.</p>
      <h2>Liability for links</h2><p>Our pages contain links to third-party websites whose content we do not control. The respective provider is responsible for that content. If we become aware of any legal violation, we will remove the link immediately.</p>
      <h2>Prices</h2><p>All prices were retrieved from the respective shop at the time shown. Prices and availability may change at any time. The price in the shop at the time of purchase applies.</p>
      <p><i>The German version of this page is legally binding.</i></p>`}
  },
  money:{
    de:{title:"So finanzieren wir uns", html:`
      <div class="eyebrow">Transparenz</div><h1>So finanziert sich perldeals</h1>
      <p>perldeals ist kostenlos. Wir verdienen Geld über Provisionen: Kaufst du über einen mit <b>„Anzeige“</b> markierten Link ein, zahlt uns der Shop einen kleinen Anteil am Kaufpreis. Für dich ändert sich der Preis dadurch nicht.</p>
      <h2>Amazon</h2><p>Als Amazon-Partner verdienen wir an qualifizierten Verkäufen. Preise und Verfügbarkeit stammen von Amazon.de und gelten zu dem Zeitpunkt, der beim Deal steht.</p>
      <h2>eBay</h2><p>perldeals nimmt am eBay Partner Network teil. Links zu eBay enthalten eine Kennung, über die eBay Käufe nach einem Klick uns zuordnen kann. Wir erhalten dafür eine Provision, der Preis für dich ändert sich nicht.</p>
      <h2>Weitere Shops</h2><p>Links zu anderen Shops wie OTTO, Alternate, SharkNinja, Myprotein, Imou, ANTHBOT oder Autofull laufen über das Partnernetzwerk Awin. Produktbilder dieser Shops speichern wir auf unserem eigenen Server, damit beim Aufruf unserer Seite keine Daten an die Shops fließen. Auch hier erhalten wir bei einem Kauf eine Provision, der Preis für dich bleibt gleich.</p>
      <h2>Wie wir Deals auswählen</h2><ul>
        <li>Ein Deal landet nur hier, wenn der Preis im Vergleich zum Preisverlauf und zu anderen Händlern wirklich günstig ist.</li>
        <li>Die Höhe der Provision spielt bei der Auswahl keine Rolle.</li>
        <li>Wir verkaufen keine Platzierungen. Bezahlte Platzierungen würden wir deutlich als solche kennzeichnen.</li></ul>
      <h2>Kaufberatungen</h2><p>Unsere Kaufberatungen beruhen auf Herstellerangaben, Preisdaten und – sobald die Community-Funktion startet – auf Kommentaren von Nutzern, die das Produkt gekauft haben. Wir erfinden keine Bewertungen und übernehmen keine Rezensionen aus Shops.</p>`},
    en:{title:"How we make money", html:`
      <div class="eyebrow">Transparency</div><h1>How perldeals makes money</h1>
      <p>perldeals is free. We earn commissions: if you buy through a link marked <b>“Ad”</b>, the shop pays us a small share of the price. Your price stays the same.</p>
      <h2>Amazon</h2><p>As an Amazon Associate we earn from qualifying purchases. Prices and availability come from Amazon.de and apply at the time shown with each deal.</p>
      <h2>eBay</h2><p>perldeals participates in the eBay Partner Network. Links to eBay carry an ID that lets eBay attribute purchases after a click to us. We earn a commission; your price stays the same.</p>
      <h2>Other shops</h2><p>Links to other shops such as OTTO, Alternate, SharkNinja, Myprotein, Imou, ANTHBOT or Autofull run through the Awin affiliate network. We store these shops' product images on our own server, so no data flows to the shops when you view our site. Here too we earn a commission on purchases at no extra cost to you.</p>
      <h2>How we pick deals</h2><ul>
        <li>A deal only appears here if the price is genuinely low compared with price history and other retailers.</li>
        <li>The commission rate plays no part in our selection.</li>
        <li>We do not sell placements. Any paid placement would be clearly labelled.</li></ul>
      <h2>Buying guides</h2><p>Our buying guides are based on manufacturer specifications, price data and, once community features launch, comments from people who bought the product. We never invent reviews or copy reviews from shops.</p>`}
  },
  privacy:{
    de:{title:"Datenschutz", html:`
      <div class="eyebrow">DSGVO</div><h1>Datenschutzerklärung</h1>
      <p>Stand: ${fmtDay(DATA.updated,"de")}</p>
      <h2>1. Verantwortlicher</h2><address>${addr("de")}<br>E-Mail: ${esc(SITE.email)}</address>
      <h2>2. Hosting und Server-Logs</h2><p>Diese Website wird bei ${esc(SITE.host.name)}, ${esc(SITE.host.address)}, gehostet. Beim Aufruf verarbeitet der Server technisch notwendige Daten: IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Referrer und Browser-Kennung. Das ist nötig, um die Website sicher auszuliefern (Art. 6 Abs. 1 lit. f DSGVO). Die Daten werden nicht mit anderen Daten zusammengeführt und nach kurzer Zeit gelöscht. Mit dem Hoster besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.</p>
      <h2>3. Cookies und Speicher im Browser, keine Analyse-Tools</h2><p>Wir setzen keine Analyse- oder Werbe-Tools von Drittanbietern ein. Wir zählen lediglich anonym, wie oft unsere Seiten pro Tag aufgerufen werden und über welche Art von Quelle (z. B. Google, ChatGPT, Pinterest, direkter Aufruf) sowie welcher Seitentyp (z. B. Deal, Kaufberatung). Außerdem zählen wir je Unterseite, wie oft sie aufgerufen wurde und wie oft von dort ein Link zu einem Shop angeklickt wurde. Dafür sendet der Browser beim Aufruf nur den Namen der verweisenden Website, den Seitentyp und den Pfad der aufgerufenen Seite (z. B. /deals/…) an unseren eigenen Server. Wir speichern keine IP-Adressen, keine Cookies, keine Geräte- oder Nutzerkennungen und keine Suchbegriffe oder Parameter; gespeichert wird nur eine Tagessumme je Quelle, Seitentyp und Seite. Ein Personenbezug ist damit nicht möglich. Rechtsgrundlage ist unser berechtigtes Interesse an der Verbesserung unseres Angebots (Art. 6 Abs. 1 lit. f DSGVO); da nichts auf deinem Gerät gespeichert oder ausgelesen wird, ist keine Einwilligung nötig. Nur wenn du dich anmeldest, setzen wir ein technisch notwendiges Sitzungs-Cookie, das dich angemeldet hält (Laufzeit 30 Tage, nur über HTTPS, für Skripte nicht lesbar). Deine Einstellungen für Hell- oder Dunkelmodus und Sortierung speichern wir lokal in deinem Browser (Local Storage). Diese Daten verlassen dein Gerät nicht. Rechtsgrundlage ist jeweils § 25 Abs. 2 Nr. 2 TDDDG.</p>
      <h2>KI-Kaufberater</h2><p>Auf der Seite „KI-Berater“ kannst du eine Frage eingeben. Ist die KI-Funktion aktiv, senden wir nur den Text deiner Frage zusammen mit unseren eigenen Deal- und Ratgeber-Inhalten an Anthropic PBC (USA), die daraus eine Antwort erzeugen. Anthropic verarbeitet die Daten als Auftragsverarbeiter auf Grundlage von EU-Standardvertragsklauseln und nutzt sie nach eigenen Angaben nicht zum Training. Wir speichern deine Frage nicht und legen keine Protokolle mit Fragen an; zur Missbrauchsabwehr zählen wir lediglich Anfragen pro pseudonymisierter (verschlüsselt gehashter) IP-Adresse und löschen diese Zähler nach spätestens einem Tag. Bitte gib keine persönlichen Daten in das Fragefeld ein. Ist die KI-Funktion nicht aktiv, läuft die Suche vollständig in deinem Browser und es werden keine Daten übertragen. Rechtsgrundlage ist dein Interesse an einer Antwort und unser berechtigtes Interesse an einem hilfreichen Angebot (Art. 6 Abs. 1 lit. b und f DSGVO).</p>
      <h2>4. Schriftarten</h2><p>Alle Schriftarten werden von unserem eigenen Server geladen. Es besteht keine Verbindung zu Google oder anderen Schrift-Anbietern.</p><p><strong>Produktbilder von Amazon:</strong> Produktbilder zu Amazon-Deals laden wir über die Schnittstelle des Amazon-Partnerprogramms direkt von Servern der Amazon EU S.à r.l. (m.media-amazon.com). Dabei erhält Amazon technisch bedingt deine IP-Adresse und Browserdaten, so wie bei jedem Bildabruf. Cookies werden dabei von uns nicht gesetzt, eine Auswertung durch uns findet nicht statt. Rechtsgrundlage ist unser berechtigtes Interesse an einer korrekten und vom Partnerprogramm vorgeschriebenen Produktdarstellung (Art. 6 Abs. 1 lit. f DSGVO). Datenschutzhinweise von Amazon: <a href="https://www.amazon.de/gp/help/customer/display.html?nodeId=201909010" target="_blank" rel="noopener">amazon.de/datenschutz</a>.</p>
      <h2>5. Links zu Shops (Affiliate-Links)</h2><p>Klickst du auf einen mit „Anzeige“ markierten Link, verlässt du perldeals und gelangst direkt zum Shop, zum Beispiel Amazon.de. Der Link enthält unsere Partner-Kennung, damit der Shop einen Kauf uns zuordnen kann. Ab diesem Moment ist der Shop für die Datenverarbeitung verantwortlich, etwa für Cookies auf seiner Website. Informationen dazu findest du in der Datenschutzerklärung des Shops. Wir erhalten vom Shop nur Provisionsberichte ohne Angaben zu deiner Person.</p>
      <h2>6. Nutzerkonto, Preisalarme und E-Mails</h2><p>Für ein Konto speichern wir deine E-Mail-Adresse, deine Spracheinstellung, deine Preisalarme (Suchbegriff, Kategorie, Höchstpreis), beim Gutschein-Alarm die ausgewählten Shops und deine E-Mail-Einstellungen. Die Anmeldung erfolgt per Link an deine E-Mail-Adresse; erst mit dem Klick auf diesen Link wird das Konto aktiviert. Preisalarm-E-Mails schicken wir, weil du sie in deinem Konto angelegt hast (Art. 6 Abs. 1 lit. b DSGVO). Den Newsletter „Perlen des Tages“ erhältst du nur, wenn du ihn ausdrücklich aktivierst (Art. 6 Abs. 1 lit. a DSGVO); den Zeitpunkt deiner Einwilligung protokollieren wir. Den Newsletter mit Black-Friday-Deal-Alarm und einzelne Preisalarme kannst du auch ohne Konto direkt auf der Website bestellen. Auch dann senden wir zuerst eine Bestätigungs-E-Mail (Double-Opt-in) und schicken erst nach deinem Klick weitere E-Mails. Bestätigst du nicht, schicken wir nach etwa 24 Stunden einmalig eine Erinnerung mit neuem Bestätigungslink. Unbestätigte Anfragen verfallen nach 3 Tagen, nie bestätigte E-Mail-Adressen löschen wir nach 7 Tagen. Zu Deal-Alarmen und zum Reseller-Deal-Alarm erhältst du zusätzlich sonntags einen Wochen-Überblick mit passenden Deals und Terminen zu deinen gewählten Themen; er lässt sich mit demselben Link wie der jeweilige Alarm abbestellen. Jede E-Mail enthält einen Link, mit dem du sie mit einem Klick abbestellen kannst. Dein Konto kannst du jederzeit selbst löschen; dann entfernen wir alle zugehörigen Daten sofort aus der Datenbank. In unseren geschützt abgelegten Sicherungskopien sind sie noch höchstens 14 Tage enthalten. Als Nachweis über erteilte und widerrufene Einwilligungen bewahren wir nur einen nicht umkehrbaren Hashwert der E-Mail-Adresse mit Zeitpunkt auf (Art. 6 Abs. 1 lit. c und f DSGVO). Zum Schutz vor Missbrauch begrenzen wir Anmeldeversuche und speichern dafür kurzzeitig einen verschlüsselten Wert deiner IP-Adresse (Art. 6 Abs. 1 lit. f DSGVO). Datenbank und E-Mail-Versand laufen bei ${esc(SITE.host.name)} in Deutschland. Für den Reseller-Deal-Alarm speichern wir zusätzlich deine gewählten Themen sowie optional Mindestrabatt und Mindestmarge; die Anmeldung erfolgt ebenfalls per Double-Opt-in, jede E-Mail enthält einen Abmeldelink. Den Newsletter (Deals, Aktionen, Neuigkeiten von perldeals) schicken wir nur, wenn du ihn ausdrücklich bestellst, entweder direkt oder über das freiwillige Häkchen bei einem Alarm, und die Bestellung per E-Mail bestätigst (Art. 6 Abs. 1 lit. a DSGVO). Die Einwilligung protokollieren wir mit Zeitpunkt und Quelle; du kannst sie jederzeit über den Link in jeder E-Mail widerrufen.</p>
      <h2>Bewerbungen</h2><p>Über das Bewerbungsformular auf /karriere/ kannst du uns Name, Telefonnummer und/oder E-Mail-Adresse, eine Nachricht und freiwillig einen Lebenslauf senden. Wir erhalten diese Angaben per E-Mail und nutzen sie nur für das Bewerbungsverfahren (§ 26 BDSG, Art. 6 Abs. 1 lit. b DSGVO). Auf dem Webserver wird nichts gespeichert. Kommt keine Zusammenarbeit zustande, löschen wir deine Unterlagen spätestens 6 Monate nach Abschluss des Verfahrens. Bewirbst du dich per WhatsApp, gelten zusätzlich die Datenschutzhinweise von WhatsApp (Meta).</p>
      <h2>Ankauf-Anfragen</h2><p>Über das Ankauf-Formular kannst du uns Name, E-Mail-Adresse, optional Telefonnummer und Postleitzahl, eine Beschreibung und Fotos senden. Wir erhalten diese Angaben per E-Mail und nutzen sie nur, um dir ein Ankaufsangebot zu machen und den Ankauf abzuwickeln (Art. 6 Abs. 1 lit. b DSGVO). Auf dem Webserver wird nichts gespeichert. Nicht zustande gekommene Anfragen löschen wir spätestens nach 6 Monaten.</p><h2>Ankauf-Aufträge (Einsendung)</h2><p>Erstellst du einen Ankauf-Auftrag, erhalten wir per E-Mail deinen Namen, deine Anschrift, E-Mail-Adresse, optional deine Telefonnummer sowie deine Angaben zur Ware. Nach Annahme unseres Angebots kommt deine Bankverbindung für die Auszahlung hinzu. Wir verarbeiten diese Daten zur Durchführung des Auftrags und des Kaufvertrags (Art. 6 Abs. 1 lit. b DSGVO); eine gesonderte Einwilligung ist dafür nicht nötig. Auf dem Webserver wird nichts gespeichert. Unterlagen zu abgeschlossenen Ankäufen bewahren wir wegen handels- und steuerrechtlicher Pflichten auf (§ 257 HGB, § 147 AO), Aufträge ohne Kaufvertrag löschen wir spätestens 6 Monate nach Rücksendung der Ware. Schreibst du uns per WhatsApp, gelten zusätzlich die Datenschutzhinweise von WhatsApp (Meta).</p>
      <h2>7. Kontakt per E-Mail</h2><p>Schreibst du uns eine E-Mail, verarbeiten wir deine Angaben, um die Anfrage zu beantworten (Art. 6 Abs. 1 lit. b oder f DSGVO), und löschen sie, wenn sie nicht mehr benötigt werden und keine Aufbewahrungspflichten bestehen.</p>
      <h2>8. Deine Rechte</h2><p>Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der Landesbeauftragten für den Datenschutz Niedersachsen.</p>
      <h2>9. Änderungen</h2><p>Wenn wir neue Funktionen einführen, passen wir diese Erklärung vorher an.</p>`},
    en:{title:"Privacy", html:`
      <div class="eyebrow">GDPR</div><h1>Privacy policy</h1>
      <p>As of ${fmtDay(DATA.updated,"en")}</p>
      <h2>1. Controller</h2><address>${addr("en")}<br>Email: ${esc(SITE.email)}</address>
      <h2>2. Hosting and server logs</h2><p>This website is hosted by ${esc(SITE.host.name)}, ${esc(SITE.host.address)}, Germany. When you visit, the server processes technically necessary data: IP address, date and time, page requested, referrer and browser identifier. This is required to deliver the website securely (Art. 6(1)(f) GDPR). The data is not combined with other data and is deleted after a short period. A data processing agreement under Art. 28 GDPR is in place with the host.</p>
      <h2>3. Cookies and browser storage, no analytics tools</h2><p>We use no third-party analytics or advertising tools. We only count anonymously how often our pages are viewed per day, from which kind of source (e.g. Google, ChatGPT, Pinterest, direct visit) and which page type (e.g. deal, buying guide). For this, your browser sends only the name of the referring website and the page type to our own server. We store no IP addresses, no cookies, no device or user identifiers and no full URLs; only a daily total per source and page type is kept, so no one can be identified. The legal basis is our legitimate interest in improving our service (Art. 6(1)(f) GDPR); since nothing is stored on or read from your device, no consent is needed. Only when you sign in do we set a strictly necessary session cookie that keeps you signed in (valid for 30 days, HTTPS only, not readable by scripts). Your light/dark mode and sort preferences are stored locally in your browser (local storage) and never leave your device. The legal basis is § 25(2) no. 2 TDDDG.</p>
      <h2>AI shopping advisor</h2><p>On the “AI advisor” page you can enter a question. When the AI feature is active, we send only the text of your question together with our own deal and guide content to Anthropic PBC (USA), which generates an answer. Anthropic processes the data as a processor under EU standard contractual clauses and, according to Anthropic, does not use it for training. We do not store your question or keep logs of questions; to prevent abuse we only count requests per pseudonymised (cryptographically hashed) IP address and delete these counters after one day at most. Please do not enter personal data in the question field. When the AI feature is not active, the search runs entirely in your browser and no data is transmitted. Legal basis: Art. 6(1)(b) and (f) GDPR.</p>
      <h2>4. Fonts</h2><p>All fonts are served from our own server. There is no connection to Google or any other font provider.</p><p><strong>Product images from Amazon:</strong> Images for Amazon deals are loaded through the Amazon Associates interface directly from servers of Amazon EU S.à r.l. (m.media-amazon.com). For technical reasons Amazon receives your IP address and browser data, as with any image request. We set no cookies for this and do not analyse it. The legal basis is our legitimate interest in an accurate product display as required by the associates programme (Art. 6(1)(f) GDPR). Amazon's privacy notice: <a href="https://www.amazon.de/gp/help/customer/display.html?nodeId=201909010" target="_blank" rel="noopener">amazon.de privacy notice</a>.</p>
      <h2>5. Links to shops (affiliate links)</h2><p>When you click a link marked “Ad”, you leave perldeals and go straight to the shop, for example Amazon.de. The link contains our partner ID so the shop can attribute a purchase to us. From that moment the shop is responsible for data processing, such as cookies on its website; see the shop's privacy policy. We only receive commission reports that contain no personal data about you.</p>
      <h2>6. User account, price alerts and emails</h2><p>For an account we store your email address, language, price alerts (search term, category, maximum price) and email settings. You sign in via a link sent to your email address; the account is only activated when you click it. We send price alert emails because you set them up in your account (Art. 6(1)(b) GDPR). You only receive the “Pearls of the day” newsletter if you explicitly switch it on (Art. 6(1)(a) GDPR); we log when you gave consent. You can also sign up for the newsletter with the Black Friday deal alarm or for single price alerts directly on the website without an account. In that case we first send a confirmation email (double opt-in) and only send further emails after you click it. Unconfirmed requests expire after 3 days, and email addresses that were never confirmed are deleted after 7 days. Every email contains a one-click unsubscribe link. You can delete your account yourself at any time; all related data is then removed from the database immediately. It remains in our protected backups for at most 14 days. As proof of consent given and withdrawn we only keep an irreversible hash of the email address with the time (Art. 6(1)(c) and (f) GDPR). To prevent abuse we limit sign-in attempts and briefly store an encrypted value derived from your IP address (Art. 6(1)(f) GDPR). Database and email sending run at ${esc(SITE.host.name)} in Germany.</p>
      <h2>7. Contact by email</h2><p>If you email us, we process your details to answer your request (Art. 6(1)(b) or (f) GDPR) and delete them once they are no longer needed and no retention obligations apply.</p>
      <h2>8. Your rights</h2><p>You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and objection (Art. 21 GDPR). You can also lodge a complaint with a supervisory authority, for example the State Commissioner for Data Protection of Lower Saxony.</p>
      <h2>9. Changes</h2><p>Before we introduce new features, we will update this policy.</p>
      <p><i>The German version of this page is legally binding.</i></p>`}
  }
};
function buildLegal(lang, key){
  const p = LEGAL[key][lang], u = UI[lang];
  const cr = crumbs(lang, [[u.home, R.home[lang]], [p.title]]);
  layout({lang, pathFor:l=>R[key][l], title:`${p.title} · perldeals`, description:`${p.title} – perldeals`, body:`<div class="wrap">${cr.html}<article class="legal">${p.html}</article></div>`, ld:[{"@context":"https://schema.org", ...cr.ld}]});
}

/* ---------------- run ---------------- */
fs.rmSync(OUT, {recursive:true, force:true});
fs.cpSync(`${SRC}/assets`, `${OUT}/assets`, {recursive:true});
fs.cpSync(`${SRC}/api`, `${OUT}/api`, {recursive:true});
fs.mkdirSync(`${OUT}/data`, {recursive:true});
if (fs.existsSync(`${SRC}/data/amazon-status.json`)) fs.copyFileSync(`${SRC}/data/amazon-status.json`, `${OUT}/data/amazon-status.json`);
if (fs.existsSync(`${SRC}/data/awin-candidates.json`)) fs.copyFileSync(`${SRC}/data/awin-candidates.json`, `${OUT}/data/awin-kandidaten.json`);
fs.writeFileSync(`${OUT}/data/codes-live.json`, JSON.stringify({updated: DATA.updated, codes: activeCodes().map(c => ({id: codeId(c), shop: c.shop, shopName: c.shopName, code: c.code || null, title: c.title.de, conditions: c.conditions && c.conditions.de || "", validUntil: c.validUntil || null, url: BASE + R.coupon.de(c.shop)}))}));
fs.writeFileSync(`${OUT}/data/auto-archive.json`, JSON.stringify(AUTO_ARCH));
fs.writeFileSync(`${OUT}/data/deals-live.json`, JSON.stringify({updated: DATA.updated, deals: sorted.filter(d => !NP(d)).slice(0, 60).map(d => ({id:d.id, title:d.title.de, now:d.now, was:d.was, shop:d.shopName || shopName(d), low:!!d.low, added:d.added, auto:!!d.auto}))}));
for (const [a, b] of [["awin-promotions.json","awin-aktionen.json"],["awin-programme.json","awin-programme.json"],["awin-api-status.json","awin-api-status.json"]]) if (fs.existsSync(`${SRC}/data/${a}`)) fs.copyFileSync(`${SRC}/data/${a}`, `${OUT}/data/${b}`);
if (fs.existsSync(`${SRC}/data/awin-history.json`)) fs.writeFileSync(`${OUT}/data/awin-history.json.gz`, (await import("node:zlib")).gzipSync(fs.readFileSync(`${SRC}/data/awin-history.json`)));
if (fs.existsSync(`${SRC}/data/amazon-candidates.json`)) fs.copyFileSync(`${SRC}/data/amazon-candidates.json`, `${OUT}/data/amazon-kandidaten.json`);
fs.writeFileSync(`${OUT}/data/price-history.json`, JSON.stringify(HIST));
const firstSentence = t => (t || "").split(/(?<=[.!?])\s+/)[0].slice(0, 220);
fs.writeFileSync(`${OUT}/data/ai-index.json`, JSON.stringify({
  updated: DATA.updated,
  deals: DATA.deals.map(d => ({ id:d.id, t:d.title.de, te:d.title.en, b:d.brand, c:d.cat, p:NP(d)?null:d.now, w:NP(d)?null:d.was, s:shopName(d), l:!!d.low, n:d.note?d.note.de.slice(0,160):undefined, u:R.deal.de(d.id), ue:R.deal.en(d.id) })),
  guides: Object.keys(GUIDES).filter(id => DATA.deals.some(d => d.id === id)).map(id => ({ id, t:GUIDES[id].de.h1, te:GUIDES[id].en.h1, a:firstSentence(GUIDES[id].de.answer), c:(DATA.deals.find(d=>d.id===id)||{}).cat, p:(DATA.deals.find(d=>d.id===id)||{}).now, u:R.guide.de(id), ue:R.guide.en(id) })),
  best: Object.keys(BEST).map(k => ({ id:k, t:BEST[k].de.h1, te:BEST[k].en.h1, k:BEST[k].keyword, c:BEST[k].cat, i:BEST[k].de.items.map(it => `${it.label}: ${it.name}`), u:R.best.de(k), ue:R.best.en(k) }))
}));
/* client search index (search.js): like ai-index plus picture and vegan flag */
fs.writeFileSync(`${OUT}/data/search-index.json`, JSON.stringify({
  icons: Object.fromEntries(Object.keys(CATS).map(k => [k, CATS[k].icon])),
  deals: DATA.deals.map(d => ({ id:d.id, t:d.title.de, te:d.title.en, b:d.brand, c:d.cat, p:NP(d)?null:d.now, w:NP(d)?null:d.was, s:shopName(d), l:!!d.low, v:!!(d.vegan || d.cat === "vegan"), i:d.img ? d.img.src : undefined, u:R.deal.de(d.id), ue:R.deal.en(d.id) })),
  guides: Object.keys(GUIDES).filter(id => DATA.deals.some(d => d.id === id)).map(id => ({ id, t:GUIDES[id].de.h1, te:GUIDES[id].en.h1, a:firstSentence(GUIDES[id].de.answer), c:(DATA.deals.find(d=>d.id===id)||{}).cat, p:(DATA.deals.find(d=>d.id===id)||{}).now, u:R.guide.de(id), ue:R.guide.en(id) })),
  best: Object.keys(BEST).map(k => ({ id:k, t:BEST[k].de.h1, te:BEST[k].en.h1, k:BEST[k].keyword, c:BEST[k].cat, i:BEST[k].de.items.map(it => it.name), u:R.best.de(k), ue:R.best.en(k) }))
}));
fs.writeFileSync(`${OUT}/data/deals.json`, JSON.stringify({...DATA, deals: DATA.deals.map(d => NP(d) ? {...d, np: true, now: null, was: null, low: false} : d)}));
if (fs.existsSync(`${SRC}/data/reseller.json`)) fs.copyFileSync(`${SRC}/data/reseller.json`, `${OUT}/data/reseller.json`);
for (const lang of LANGS){
  buildHome(lang);
  Object.keys(CATS).filter(k => k==='vegan' || k==='travel' || DATA.deals.some(d => catHas(d, k))).forEach(k => buildCategory(lang, k));
  Object.keys(SHOPS).forEach(k => buildShop(lang, k));
  DATA.deals.forEach(d => buildDeal(lang, d));
  EXPIRED.forEach(a => buildExpired(lang, a));
  buildExpiredHub(lang);
  if (lang === "de") DATA.deals.forEach(buildStatus);
  Object.keys(GUIDES).forEach(id => buildGuide(lang, id));
  Object.keys(ARTICLES).forEach(k => buildArticle(lang, k));
  Object.keys(BEST).forEach(k => buildBest(lang, k));
  if (Object.keys(BEST).length) buildBestIndex(lang);
  buildCodes(lang);
  couponShops().forEach(x => buildCoupon(lang, x.k, x.name));
  if (lang === "de") buildCodeAlarm();
  if (HUBS) { buildBlackFriday(lang); if (HUBS.seasons) Object.keys(HUBS.seasons).forEach(k => buildSeason(lang, k)); buildGifts(lang); Object.keys(HUBS.gifts.pages).forEach(k => buildGift(lang, k)); }
  buildGuideIndex(lang);
  buildAccount(lang);
  buildAdvisor(lang);
  if (lang === "en") { TOPICS.forEach(buildTopicEn); buildTopicIndexEn(); BRANDS.forEach(buildBrandEn); WISSEN.items.forEach(buildWissenEn); buildWissenIndexEn(); }
  if (lang === "de") { BF_CATS.forEach(buildBFSub); bfBrandList().forEach(buildBFSub); buildBFShops(); buildWasserdicht(); buildVeganHub(); buildAdvent(); buildKarriere(); buildShare(); buildWhatsapp(); TOPICS.forEach(buildTopic); buildTopicIndex(); BRANDS.forEach(buildBrand); WISSEN.items.forEach(buildWissen); buildWissenIndex(); buildReseller(); buildPokemonSets(); buildPreisindex(); }
  ["imprint","money","privacy"].forEach(k => buildLegal(lang, k));
}

// IndexNow key file (Bing, Yandex, Seznam, Naver – Bing also feeds ChatGPT search)
const INDEXNOW_KEY = "67f3efb4b753f797b42a30445b2a88b6";
fs.writeFileSync(`${OUT}/${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);

// 404
fs.writeFileSync(`${OUT}/404.html`, `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Seite nicht gefunden · perldeals</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/assets/style.css?v=${VERSION}"><script src="/assets/theme.js?v=${VERSION}"></script></head><body><main class="wrap legal"><div class="eyebrow">404</div><h1>Diese Seite gibt es nicht (mehr).</h1><p>Vielleicht ist der Deal abgelaufen. Die aktuellen Angebote findest du auf der <a href="/">Startseite</a>.</p><p lang="en">This page does not exist (anymore). See today's deals on the <a href="/en/">home page</a>.</p></main></body></html>`);

// favicon
fs.writeFileSync(`${OUT}/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150"><defs><radialGradient id="p" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#d6efe9"/><stop offset="1" stop-color="#7cc2b4"/></radialGradient></defs><rect width="150" height="150" rx="34" fill="#0B776B"/><path d="M40 38h50l26 37-26 37H40a8 8 0 0 1-8-8V46a8 8 0 0 1 8-8z" fill="#0D2522"/><circle cx="66" cy="75" r="20" fill="url(#p)"/><circle cx="98" cy="75" r="5" fill="#F5C542"/></svg>`);

// robots.txt (search engines and AI assistants welcome)
fs.writeFileSync(`${OUT}/robots.txt`, `User-agent: *
Allow: /
Disallow: /api/
Disallow: /konto/
Disallow: /en/account/

# AI assistants and answer engines are welcome to read and cite perldeals
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /

Sitemap: ${BASE}/sitemap.xml
`);


/* ---------------- RSS feeds: all deals, and a Pinterest feed (auto-publish) with our pin images ---------------- */
{
  const x = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const rfc = d => new Date(d).toUTCString();
  const feed = (title, link, desc, items) => `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${x(title)}</title><link>${BASE}/</link><atom:link href="${BASE}${link}" rel="self" type="application/rss+xml"/><description>${x(desc)}</description><language>de-de</language>\n${items.join("\n")}\n</channel></rss>\n`;
  const dealItems = [...DATA.deals].sort((a,b)=>b.added.localeCompare(a.added)).slice(0,40).map(d => {
    const img = d.img ? absUrl(d.img.src) : null;
    return `<item><title>${x(NP(d) ? `${d.title.de} bei Amazon (zuletzt −${pct(d)} %)` : `${d.title.de} für ${eur(d.now,"de")} (−${pct(d)} %)`)}</title><link>${BASE}${R.deal.de(d.id)}</link><guid isPermaLink="true">${BASE}${R.deal.de(d.id)}</guid><pubDate>${rfc(d.added)}</pubDate><description>${x(`${eur(d.now,"de")} statt ${eur(d.was,"de")} bei ${shopName(d)}. Anzeige: Partnerlink.`)}</description>${img?`<enclosure url="${x(img)}" type="image/jpeg" length="0"/><media:content url="${x(img)}" medium="image"/>`:""}</item>`;
  });
  fs.writeFileSync(`${OUT}/feed.xml`, feed("perldeals – neue Deals", "/feed.xml", "Neue geprüfte Deals von perldeals.com", dealItems));
  const PINS = fs.existsSync(`${SRC}/data/pins.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/pins.json`,"utf8")) : {};
  const pinUrl = (k, v) => v.kind==="page" ? v.url : v.kind==="topic" ? TOPIC_PATH(v.slug) : v.kind==="deal" ? R.deal.de(v.deal) : v.kind==="coupon" ? R.coupon.de(v.shop) : v.kind==="season" ? HUBS.seasons[k].path.de : v.kind==="guide" ? R.guide.de(k) : v.kind==="article" ? R.article.de(k) : v.kind==="best" ? R.best.de(k) : v.kind==="gift" ? R.gift.de(k) : k==="black-friday" ? R.bf.de : R.gifts.de;
  const pinItems = Object.entries(PINS).filter(([k, v]) => fs.existsSync(`${SRC}/assets/pins/${k}.jpg`) && (v.kind !== "deal" || DATA.deals.some(d => d.id === v.deal)) && (v.kind !== "season" || (HUBS && HUBS.seasons && HUBS.seasons[k]))).map(([k, v]) => {
    const mt = fs.statSync(`${SRC}/assets/pins/${k}.jpg`).mtime, img = `${BASE}/assets/pins/${k}.jpg`, url = BASE + pinUrl(k, v);
    return {mt, xml:`<item><title>${x(v.title)}</title><link>${url}</link><guid isPermaLink="false">pin-${k}</guid><pubDate>${rfc(mt)}</pubDate><description>${x(v.title + " – ehrlich geprüft auf perldeals.com")}</description><enclosure url="${img}" type="image/jpeg" length="0"/><media:content url="${img}" medium="image"/></item>`};
  }).sort((a,b)=>b.mt-a.mt).map(o=>o.xml);
  fs.writeFileSync(`${OUT}/feed-pinterest.xml`, feed("perldeals – Kaufberatung und Bestenlisten", "/feed-pinterest.xml", "Kaufberatungen, Bestenlisten und Geschenkideen von perldeals.com", pinItems));
}

// sitemap with hreflang
const today = DATA.updated.slice(0,10);
const sm = pages.filter(p => p.alt.de && p.path === p.alt[Object.keys(p.alt).find(k => p.alt[k] === p.path)])
  .map(p => p.alt.en ? `<url><loc>${BASE}${p.path}</loc><lastmod>${today}</lastmod><xhtml:link rel="alternate" hreflang="de" href="${BASE}${p.alt.de}"/><xhtml:link rel="alternate" hreflang="en" href="${BASE}${p.alt.en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${BASE}${p.alt.de}"/></url>` : `<url><loc>${BASE}${p.path}</loc><lastmod>${today}</lastmod></url>`);
fs.writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sm.join("\n")}\n</urlset>\n`);

fs.writeFileSync(`${OUT}/og-pages.json`, JSON.stringify([...OG_PAGES].map(([s, v]) => ({s, ...v}))));
// llms.txt
fs.writeFileSync(`${OUT}/llms.txt`, `# perldeals

> perldeals (${BASE}) is a German deal site. It lists current bargains from Amazon.de, OTTO and other German shops that were checked against price history and other retailers, and publishes buying guides that answer "is it worth it?" for popular products. Content is available in German (default) and English (/en/). Prices carry a timestamp. Links marked "Anzeige"/"Ad" are affiliate links.

## Deals (German)
${sorted.map(d => `- [${d.title.de}](${BASE}${R.deal.de(d.id)}): ${NP(d) ? "Preis bei Amazon" : `${eur(d.now,"de")} statt ${eur(d.was,"de")} (−${pct(d)} %)`}, Stand ${STAMP("de")}`).join("\n")}

## Bestenlisten / Best lists
${Object.keys(BEST).map(k => `- [${BEST[k].de.h1}](${BASE}${R.best.de(k)}): ${BEST[k].de.answer.split(". ")[0]}.\n- [${BEST[k].en.h1}](${BASE}${R.best.en(k)})`).join("\n")}

## Saisonal / Seasonal
- [Black Friday 2026](${BASE}${R.bf.de}) · [English](${BASE}${R.bf.en})
- [Geschenkideen](${BASE}${R.gifts.de}) · [Gift ideas](${BASE}${R.gifts.en})
- [Cyber Monday 2026 (30.11.)](${BASE}/cyber-monday/) · [Adventskalender 2026](${BASE}/adventskalender-angebote/) · [Verpasste Deals](${BASE}/abgelaufene-deals/)
- [Pokémon-Preisindex: alle deutschen Pokémon-Karten (${PKART ? PKART.cards.length : ""}) mit Cardmarket-Preistrend und Ø 30 Tage, täglich aktualisiert, je Set eine Seite](${BASE}/reseller/pokemon-preisindex/)
- [Pokémon Pull-Rates aller aktuellen Sets (Delta-Herrschaft, Dunkelnacht, Wachsendes Chaos, Optimale Ordnung …)](${BASE}/reseller/pokemon-sets/) · [Booster öffnen oder versiegelt? EV-Rechner](${BASE}/reseller/ratgeber/booster-oeffnen-oder-versiegelt-erwartungswert/) · [Jobs](${BASE}/karriere/)
${BFS ? BFS.shops.map(S => `- [Black Friday 2026 bei ${S.name}](${BASE}${bfShopUrl(S.key)}): ${S.from ? `${bfDate(S.from)} bis ${bfDate(S.to)}` : "noch nicht angekündigt"}`).join("\n") : ""}
${typeof ADV !== "undefined" && ADV ? ADV.cats.map(c => `- [${c.h1}](${BASE}/adventskalender-angebote/${c.slug}/): ${c.desc}`).join("\n") : ""}

## Ist das wasserdicht? (German, IP-Schutzklassen laut Hersteller)
${WD ? WD.items.map(m => `- [${wdQ(m)} ${m.model} wasserdicht?](${BASE}/wasserdicht/${m.slug.replace(/-wasserdicht$/, "")}/): ${m.ip}. ${m.answer.split(". ")[0]}.`).join("\n") : ""}

## Vegan-Ratgeber (German)
- [Vegan-Ratgeber: Übersicht](${BASE}/vegan-ratgeber/)
${VEGAN_G ? VEGAN_G.items.map(w => `- [${w.title}](${BASE}/wissen/${w.slug}/): ${w.desc}`).join("\n") : ""}

## Gutschein-Alarm
- [Gutschein-Alarm: neue Rabattcodes per E-Mail](${BASE}/gutschein-alarm/): kostenloser Mail-Alarm für neue Gutscheine ausgewählter Shops (Double-Opt-in).

## Vergleiche / Comparisons
${Object.keys(ARTICLES).map(k => `- [${ARTICLES[k].de.h1}](${BASE}${R.article.de(k)}): ${ARTICLES[k].de.answer.split(". ")[0]}.\n- [${ARTICLES[k].en.h1}](${BASE}${R.article.en(k)})`).join("\n")}

## Kaufberatung / Buying guides
${Object.keys(GUIDES).map(id => `- [${GUIDES[id].de.h1}](${BASE}${R.guide.de(id)}): ${GUIDES[id].de.answer.split(". ")[0]}.\n- [${GUIDES[id].en.h1}](${BASE}${R.guide.en(id)})`).join("\n")}

## Pokémon & Reseller (German)
- [Pokémon für Händler: beste Deals & Leitfaden](${BASE}/reseller/pokemon-haendler/): aktuelle Pokémon-Deals und Leitfaden zum Finden und Bewerten von Karten.
- [Karten & Retro-Konsolen verkaufen: Ankauf per WhatsApp](${BASE}/reseller/karten-ankauf/): perldeals kauft Pokémon-, One-Piece- und Yu-Gi-Oh-Karten, Sammlungen, gegradete Karten und versiegelte Produkte sowie Retro-Konsolen und Videospiele (Nintendo 64, Super Nintendo, Game Boy, Sega, PlayStation) an; Anfrage mit Fotos per WhatsApp (${WA_PHONE}) oder E-Mail (kontakt@perldeals.com), Angebot kostenlos.
- [Reseller-Rechner](${BASE}/reseller/rechner/): berechnet den nötigen Verkaufspreis mit Wunschmarge oder den maximalen Ankaufspreis nach eBay-, Amazon-, Cardmarket- und PayPal-Gebühren, Versand und Umsatzsteuer (inkl. Differenzbesteuerung).
${(fs.existsSync(`${SRC}/data/ankauf.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/ankauf.json`, "utf8")).pages : []).map(a => `- [${a.title}](${BASE}/reseller/ankauf/${a.slug}/): ${a.desc}`).join("\n")}
${(fs.existsSync(`${SRC}/data/pokemon-haendler.json`) ? JSON.parse(fs.readFileSync(`${SRC}/data/pokemon-haendler.json`, "utf8")).chapters : []).map(c => `- [${c.title}](${BASE}/reseller/pokemon-haendler/${c.slug}/): ${c.desc}`).join("\n")}
- [Reseller & Sammler: Pokémon, One Piece, LEGO EOL, Konsolen](${BASE}/reseller/)
- [Pokémon Release-Kalender](${BASE}/reseller/pokemon/)

## Wissen / Guides (German)
${WISSEN.items.map(w => `- [${w.title}](${BASE}/wissen/${w.slug}/): ${w.desc}`).join("\n")}

## Themen / Topics (German)
${TOPICS.filter(T => !T.price && topicIndexed(T)).map(T => `- [${T.h}](${BASE}${TOPIC_PATH(T.slug)}): ${T.intro.split(". ")[0]}.`).join("\n")}

## Kategorien / Categories
${Object.keys(CATS).filter(k => k==='vegan' || k==='travel' || DATA.deals.some(d => catHas(d, k))).map(k => `- [${CATS[k].de[0]}](${BASE}${R.cat.de(k)})`).join("\n")}

## Shops & Gutscheine / Shops & vouchers
${Object.keys(SHOPS).map(k => `- [${SHOPS[k].name} Angebote](${BASE}${R.shop.de(k)}): ${SHOPS[k].de.split(". ")[0]}.`).join("\n")}
- [Rabattcodes und Aktionen](${BASE}${R.codes.de})

## About
- [So finanziert sich perldeals](${BASE}${R.money.de})
- [Impressum](${BASE}${R.imprint.de})
`);

// Apache config: HTTPS, security headers, caching
fs.writeFileSync(`${OUT}/.htaccess`, `# perldeals — Apache configuration
Options -Indexes
ErrorDocument 404 /404.html
AddType "text/vcard; charset=utf-8" .vcf

<IfModule mod_rewrite.c>
RewriteEngine On
# Force HTTPS and the bare domain
RewriteCond %{HTTPS} off [OR]
RewriteCond %{HTTP_HOST} ^www\\. [NC]
RewriteRule ^ https://perldeals.com%{REQUEST_URI} [L,R=301]
# API internals are never reachable over the web
RewriteRule ^(api/lib/|private(/|$)) - [F]
# Never serve dotfiles
RewriteRule (^|/)\\.(?!well-known/) - [F]
</IfModule>

<IfModule mod_headers.c>
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
Header always set Cross-Origin-Opener-Policy "same-origin"
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://m.media-amazon.com; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
Header always unset X-Powered-By
<FilesMatch "^logo\.png$">
Header set Access-Control-Allow-Origin "*"
</FilesMatch>
<FilesMatch "\\.(woff2|svg)$">
Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
<FilesMatch "\\.(css|js)$">
Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
<FilesMatch "\\.(html|xml|txt|json)$">
Header set Cache-Control "public, max-age=600"
</FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml application/xml text/plain
</IfModule>
`);

// security.txt
fs.mkdirSync(`${OUT}/.well-known`, {recursive:true});
fs.writeFileSync(`${OUT}/.well-known/security.txt`, `Contact: mailto:${SITE.email}\nExpires: 2027-10-20T00:00:00.000Z\nPreferred-Languages: de, en\nCanonical: ${BASE}/.well-known/security.txt\n`);

if (!SITE.phone) console.warn("WARNUNG: Im Impressum fehlt noch eine Telefonnummer (src/data/site.json -> phone).");
console.log(`Gebaut: ${pages.length} Seiten in ./${OUT}`);
