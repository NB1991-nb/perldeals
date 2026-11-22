(function(){
  "use strict";
  var root = document.documentElement;
  var lang = root.lang === "en" ? "en" : "de";
  var T = {
    de: {dark:"Dunkelmodus an", light:"Hellmodus an", deals:function(n){return n + (n===1?" Deal":" Deals");}},
    en: {dark:"Dark mode on", light:"Light mode on", deals:function(n){return n + (n===1?" deal":" deals");}}
  }[lang];

  function toast(msg){
    var t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function(){ t.classList.remove("show"); }, 2400);
  }

  // Theme: follows the system until the visitor picks one
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function isDark(){ var t = root.getAttribute("data-theme"); return t ? t === "dark" : mq.matches; }
  function sync(){ root.classList.toggle("is-dark", isDark()); }
  if (mq.addEventListener) mq.addEventListener("change", sync);
  var tb = document.getElementById("theme-toggle");
  if (tb) tb.addEventListener("click", function(){
    var next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next); sync();
    try { localStorage.setItem("pd-theme", next); } catch (e) {}
    toast(next === "dark" ? T.dark : T.light);
  });

  // Deal list: search and sort (works on any page with #grid)
  var grid = document.getElementById("grid");
  var q = document.getElementById("q");
  var form = document.getElementById("search-form");
  var params = new URLSearchParams(location.search);
  if (q && params.get("q")) q.value = params.get("q");

  if (form) form.addEventListener("submit", function(e){
    if (grid) { e.preventDefault(); smart(); var sg = document.getElementById("sugg"); if (sg) sg.hidden = true; grid.scrollIntoView({behavior:"smooth", block:"start"}); }
  });

  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
  var empty = document.getElementById("empty");
  var count = document.getElementById("count");
  var sortKey = "top";
  try { var s = localStorage.getItem("pd-sort2"); if (s === "top" || s === "new" || s === "disc" || s === "price") sortKey = s; } catch (e) {}
  var nowMs = Date.now();
  function topScore(c){ var age = Math.max(0, nowMs - new Date(c.dataset.added).getTime()) / 36e5; return (+c.dataset.disc) + (c.dataset.low === "1" ? 10 : 0) + 40 * Math.exp(-age / 36); }

  var ranked = null; // ordered deal ids from the smart search (search.js), null = no search
  function smart(){
    var term = q ? q.value.trim() : "";
    if (!term || !window.PDS) { ranked = null; apply(); return; }
    window.PDS.searchAll(term, 999).then(function(r){ ranked = r.allDeals.map(function(d){ return d.id; }); apply(); });
  }
  function apply(){
    var term = q ? q.value.trim().toLowerCase() : "";
    var shown = 0;
    var pos = {};
    if (ranked) ranked.forEach(function(id, i){ pos[id] = i; });
    cards.forEach(function(c){
      var hit = !term || (ranked ? pos[c.dataset.id] !== undefined : c.getAttribute("data-text").indexOf(term) !== -1);
      c.hidden = !hit; if (hit) shown++;
    });
    var cmp = {
      "top": function(a,b){ return topScore(b) - topScore(a); },
      "new": function(a,b){ return b.dataset.added.localeCompare(a.dataset.added); },
      "disc": function(a,b){ return (+b.dataset.disc) - (+a.dataset.disc); },
      "price": function(a,b){ return (+a.dataset.price) - (+b.dataset.price); }
    }[sortKey];
    var list = cards.slice().sort(cmp);
    if (ranked && term) list.sort(function(a,b){ return (pos[a.dataset.id] === undefined ? 1e9 : pos[a.dataset.id]) - (pos[b.dataset.id] === undefined ? 1e9 : pos[b.dataset.id]); });
    list.forEach(function(c){ grid.appendChild(c); });
    if (empty) { grid.appendChild(empty); empty.hidden = shown !== 0; }
    if (count) count.textContent = T.deals(shown);
    document.querySelectorAll("[data-sort]").forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.sort === sortKey ? "true" : "false"); });
  }
  document.querySelectorAll("[data-sort]").forEach(function(b){
    b.addEventListener("click", function(){
      sortKey = b.dataset.sort;
      try { localStorage.setItem("pd-sort2", sortKey); } catch (e) {}
      apply();
    });
  });
  var st = null;
  if (q) q.addEventListener("input", function(){ clearTimeout(st); st = setTimeout(smart, 150); });
  apply();
  if (q && q.value.trim()) { var tries = 0; (function wait(){ if (window.PDS) smart(); else if (tries++ < 40) setTimeout(wait, 50); })(); }
})();

// Copy buttons on the internal share page
document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", async () => {
  const t = b.parentElement.querySelector("textarea");
  try { await navigator.clipboard.writeText(t.value); } catch { t.select(); document.execCommand("copy"); }
  const old = b.textContent; b.textContent = "Kopiert ✓"; setTimeout(() => (b.textContent = old), 1800);
}));

// newsletter / price alert sign-up with double opt-in
document.querySelectorAll("form[data-sub]").forEach(f => f.addEventListener("submit", async e => {
  e.preventDefault();
  const de = document.documentElement.lang !== "en", msg = f.querySelector(".sub-msg"), btn = f.querySelector("button");
  const email = f.querySelector('input[type=email]').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = de ? "Bitte gib eine gültige E-Mail-Adresse ein." : "Please enter a valid email address."; return; }
  if (f.dataset.kind === "reseller" && !f.querySelector('input[name=topics]:checked')) { msg.textContent = "Bitte wähle mindestens ein Thema."; return; }
  if (f.dataset.kind === "codes" && !f.querySelector('input[name=topics]:checked')) { msg.textContent = de ? "Bitte wähle mindestens einen Shop." : "Please pick at least one shop."; return; }
  btn.disabled = true;
  try {
    const r = await fetch("/api/subscribe.php", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ email, lang: de ? "de" : "en", kind: f.dataset.kind, keyword: f.dataset.keyword || "", cat: f.dataset.cat || "", max_price: f.dataset.max || "", topics: [...f.querySelectorAll('input[name=topics]:checked')].map(x => x.value), min_discount: (f.querySelector('[name=min_discount]') || {}).value || "", min_margin: (f.querySelector('[name=min_margin]') || {}).value || "", newsletter: !!(f.querySelector('input[name=newsletter]') || {}).checked, source: f.dataset.source || "web", website: f.querySelector(".hp").value }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { if (window.pdCampAlarm) window.pdCampAlarm(); f.classList.add("done"); msg.textContent = de ? "Fast geschafft: Bitte bestätige den Link in der E-Mail, die wir dir gerade geschickt haben." : "Almost done: please confirm the link in the email we just sent you."; }
    else msg.textContent = j.error === "too_many_requests" ? (de ? "Zu viele Versuche, bitte später erneut." : "Too many attempts, please try again later.") : (de ? "Das hat nicht geklappt. Bitte versuche es erneut." : "That didn't work. Please try again.");
  } catch { msg.textContent = de ? "Keine Verbindung. Bitte versuche es erneut." : "No connection. Please try again."; }
  btn.disabled = false;
}));
// confirmation notice after double opt-in
(() => {
  const v = new URLSearchParams(location.search).get("bestaetigt"); if (!v) return;
  const de = document.documentElement.lang !== "en", main = document.querySelector("main"); if (!main) return;
  const t = v === "codes" ? (de ? "✅ Bestätigt! Dein Gutschein-Alarm ist aktiv. Neue Codes kommen per E-Mail." : "✅ Confirmed! Your voucher alert is active.") : v === "newsletter" ? (de ? "✅ Bestätigt! Du bekommst ab sofort den Deal-Alarm und die Perlen des Tages." : "✅ Confirmed! You will now receive the deal alarm and the pearls of the day.")
    : v === "reseller" ? "✅ Bestätigt! Dein Reseller-Deal-Alarm ist aktiv. Neue Termine, Aktionen und Deals zu deinen Themen kommen ab jetzt per E-Mail."
    : v === "alarm" ? (de ? "✅ Bestätigt! Dein Preisalarm ist aktiv. Melde dich hier an, um ihn zu bearbeiten." : "✅ Confirmed! Your price alert is active. Sign in here to edit it.")
    : (de ? "Der Bestätigungslink ist ungültig oder abgelaufen. Bitte trag dich erneut ein." : "The confirmation link is invalid or has expired. Please sign up again.");
  const p = document.createElement("p"); p.className = "wrap sub-msg"; p.style.cssText = "padding:14px 16px;margin-top:16px;border-radius:12px;background:var(--accent-soft)"; p.textContent = t; main.prepend(p);
})();
document.querySelectorAll(".cat-select select").forEach(s => s.addEventListener("change", () => { if (s.value) location.href = s.value; }));

// copy discount codes on /rabatte/
document.querySelectorAll("[data-code]").forEach(b => b.addEventListener("click", async () => {
  const de = document.documentElement.lang !== "en";
  try { await navigator.clipboard.writeText(b.dataset.code); } catch (e) {}
  const old = b.textContent; b.textContent = de ? "Kopiert ✓" : "Copied ✓"; setTimeout(() => (b.textContent = old), 1800);
}));

// share a deal: native share sheet on phones, small menu elsewhere
(() => {
  const de = document.documentElement.lang !== "en";
  let menu = null;
  const close = () => { if (menu) { menu.remove(); menu = null; } };
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-share]");
    if (!b) { if (menu && !e.target.closest(".share-menu")) close(); return; }
    e.preventDefault(); e.stopPropagation();
    const url = b.dataset.share + "?utm_source=share&utm_medium=" + (navigator.share ? "native" : "menu");
    const text = b.dataset.shareText;
    if (navigator.share) { try { await navigator.share({ title: "perldeals", text, url }); } catch (err) {} return; }
    if (menu && menu._for === b) { close(); return; }
    close();
    const u = encodeURIComponent(url), t = encodeURIComponent(text);
    const items = [["WhatsApp", `https://wa.me/?text=${t}%20${u}`], ["Telegram", `https://t.me/share/url?url=${u}&text=${t}`], ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`], ["X", `https://x.com/intent/post?text=${t}&url=${u}`], [de ? "E-Mail" : "Email", `mailto:?subject=${encodeURIComponent(de ? "Deal-Tipp von perldeals" : "Deal tip from perldeals")}&body=${t}%0A${u}`]];
    menu = document.createElement("div"); menu.className = "share-menu"; menu._for = b; menu.setAttribute("role", "menu");
    items.forEach(([n, h]) => { const a = document.createElement("a"); a.href = h; a.textContent = n; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("role", "menuitem"); menu.appendChild(a); });
    const c = document.createElement("button"); c.type = "button"; c.textContent = de ? "Link kopieren" : "Copy link";
    c.addEventListener("click", async () => { try { await navigator.clipboard.writeText(url); c.textContent = de ? "Kopiert ✓" : "Copied ✓"; } catch (err) {} setTimeout(close, 900); });
    menu.appendChild(c);
    document.body.appendChild(menu);
    const r = b.getBoundingClientRect(), w = menu.offsetWidth;
    menu.style.top = (window.scrollY + r.bottom + 6) + "px";
    menu.style.left = Math.max(8, Math.min(window.scrollX + r.right - w, window.scrollX + document.documentElement.clientWidth - w - 8)) + "px";
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();

// Datensparsame Zählung der Besucherquelle (keine Cookies, keine IP, keine URL): siehe Datenschutzerklärung
(() => {
  try {
    if (navigator.webdriver || !navigator.sendBeacon || location.hostname !== "perldeals.com") return;
    let r = ""; try { r = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) {}
    const q = new URLSearchParams(location.search);
    const seg = location.pathname.split("/").filter(Boolean);
    const en = seg[0] === "en"; if (en) seg.shift();
    const map = { "buying-guide": "kaufberatung", "compare": "ratgeber", "best": "bestenliste", "coupons": "gutscheine", "discounts": "rabatte", "category": "kategorie", "gifts": "geschenke", "christmas-deals": "weihnachtsangebote", "advisor": "berater", "account": "konto" };
    const p = map[seg[0]] || seg[0] || "";
    // Kampagne (utm_campaign) für die Dauer des Besuchs merken: Folgeseiten, Shop-Klicks und Deal-Alarm-Anmeldungen zuordnen
    let camp = null; try { camp = JSON.parse(sessionStorage.getItem("pd-camp") || "null"); } catch (e) {}
    const qc = q.get("utm_campaign");
    if (qc) { camp = { c: qc.slice(0, 40), x: (q.get("utm_content") || "").slice(0, 40) }; try { sessionStorage.setItem("pd-camp", JSON.stringify(camp)); } catch (e) {} }
    // Landingpage-Test (18.11.): Seite trägt ihre Variante selbst (data-pd-camp="kampagne:variante"), wenn keine utm_campaign da ist
    let lp = false; const lpEl = document.querySelector("[data-pd-camp]");
    if (!qc && lpEl) { const [lc, lx] = lpEl.getAttribute("data-pd-camp").split(":"); camp = { c: lc.slice(0, 40), x: (lx || "").slice(0, 40) }; lp = true; try { sessionStorage.setItem("pd-camp", JSON.stringify(camp)); } catch (e) {} }
    navigator.sendBeacon("/api/hit.php", new Blob([JSON.stringify({ r, u: q.get("utm_source") || "", p, pa: location.pathname.slice(0, 160), en: en ? 1 : 0, c: (qc || lp) ? camp.c : "", x: (qc || lp) ? camp.x : "", e: "visit" })], { type: "application/json" }));
    // Shop-Klicks je Seite (anonym, nur Pfad): welche Seiten bringen Klicks zu den Shops?
    document.addEventListener("click", ev => { const a = ev.target.closest && ev.target.closest('a[rel~="sponsored"]'); if (a) { let sh = ""; try { const u = new URL(a.href, location.href), h = u.hostname.replace(/^www\./, ""); sh = /(^|\.)amazon\./.test(h) || h === "amzn.to" ? "amazon" : /(^|\.)ebay\./.test(h) || h === "rover.ebay.com" ? "ebay" : h === "awin1.com" ? "awin:" + (u.searchParams.get("awinmid") || "") : h; } catch (e) {} navigator.sendBeacon("/api/hit.php", new Blob([JSON.stringify({ e: "out", pa: location.pathname.slice(0, 160), s: sh.slice(0, 40) })], { type: "application/json" })); } }, true);
    if (camp && !qc && !lp) navigator.sendBeacon("/api/hit.php", new Blob([JSON.stringify({ c: camp.c, x: camp.x, e: "page" })], { type: "application/json" }));
    if (camp) {
      document.addEventListener("click", ev => { const a = ev.target.closest && ev.target.closest('a[rel~="sponsored"]'); if (a) navigator.sendBeacon("/api/hit.php", new Blob([JSON.stringify({ c: camp.c, x: camp.x, e: "click" })], { type: "application/json" })); }, true);
      document.addEventListener("click", ev => { const a = ev.target.closest && ev.target.closest("a[data-cta]"); if (a) navigator.sendBeacon("/api/hit.php", new Blob([JSON.stringify({ c: camp.c, x: camp.x, e: "cta" })], { type: "application/json" })); }, true);
      window.pdCampAlarm = () => navigator.sendBeacon("/api/hit.php", new Blob([JSON.stringify({ c: camp.c, x: camp.x, e: "alarm" })], { type: "application/json" }));
    }
  } catch (e) {}
})();

/* Follow nudge: after a visitor clicked through to a shop and comes back, show one small
   hint to follow us on WhatsApp/Telegram. Once per visitor, dismissable. */
(function(){
  try {
    var de = document.documentElement.lang !== "en";
    var KEY = "pd-follow-nudge";
    function seen(){ try { return localStorage.getItem(KEY) === "1"; } catch (e) { return true; } }
    if (seen()) return;
    var out = false;
    document.addEventListener("click", function(e){
      var a = e.target.closest && e.target.closest('a[rel~="sponsored"]');
      if (a) { out = true; try { sessionStorage.setItem("pd-out", "1"); } catch (e2) {} }
    });
    function show(){
      if (seen() || document.getElementById("follow-nudge")) return;
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      var q = "?utm_source=site&utm_medium=nudge";
      var box = document.createElement("div");
      box.id = "follow-nudge"; box.className = "nudge"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", de ? "Deals aufs Handy" : "Deals on your phone");
      box.innerHTML = '<button class="nudge-x" type="button" aria-label="' + (de ? "Schließen" : "Close") + '">×</button>' +
        '<strong>' + (de ? "Schneller beim nächsten Deal?" : "Faster on the next deal?") + '</strong>' +
        '<span>' + (de ? "Die besten Deals kostenlos aufs Handy, ohne Spam." : "The best deals on your phone for free, no spam.") + '</span>' +
        '<div class="nudge-btns"><a class="btn follow-wa" href="https://whatsapp.com/channel/0029VbDtsloHgZWfmyoCPe2q" target="_blank" rel="noopener">WhatsApp-Kanal</a>' +
        '<a class="btn follow-tg" href="https://t.me/perldeals" target="_blank" rel="noopener">Telegram</a></div>';
      document.body.appendChild(box);
      requestAnimationFrame(function(){ box.classList.add("show"); });
      box.querySelector(".nudge-x").addEventListener("click", function(){ box.remove(); });
      box.querySelectorAll("a").forEach(function(a){ a.addEventListener("click", function(){ setTimeout(function(){ box.remove(); }, 300); }); });
    }
    function back(){
      var was = out; try { was = was || sessionStorage.getItem("pd-out") === "1"; } catch (e) {}
      if (document.visibilityState === "visible" && was) { try { sessionStorage.removeItem("pd-out"); } catch (e) {} out = false; setTimeout(show, 700); }
    }
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
  } catch (e) {}
})();

/* Black Friday countdown on the home page */
(function(){
  try {
    var el = document.querySelector("[data-bf-days]"); if (!el) return;
    var bf = new Date("2026-11-27T00:00:00+01:00"), now = new Date();
    var days = Math.ceil((bf - now) / 864e5);
    var strip = el.closest(".bf-strip");
    if (days < 0 && strip) { strip.remove(); return; }
    el.textContent = days > 0 ? days : (document.documentElement.lang === "en" ? "today" : "heute");
  } catch (e) {}
})();

/* Aktiven Menüpunkt in horizontal scrollenden Menüs sichtbar machen */
document.querySelectorAll(".rs-nav [aria-current], .subnav [aria-current]").forEach(a => { const n = a.closest(".rs-nav") || a.parentElement; if (n.scrollWidth > n.clientWidth) n.scrollLeft = a.offsetLeft - n.offsetLeft - 16; });

/* Ankauf-Formular: Fehlermeldung aus ?fehler= anzeigen */
(function(){ var el = document.getElementById("ak-err"); if (!el) return; var m = (location.search.match(/[?&]fehler=([a-z-]+)/) || [])[1]; if (!m) return;
  var t = {limit:"Zu viele Anfragen in kurzer Zeit – bitte später erneut versuchen oder per WhatsApp schreiben.", felder:(document.getElementById("auftrag-formular")?"Bitte Name, gültige E-Mail, Anschrift und die Positionen angeben.":"Bitte Name, gültige E-Mail und eine kurze Beschreibung angeben."), consent:(document.getElementById("auftrag-formular")?"Bitte bestätige die Ankaufbedingungen und dass du Eigentümer der Ware bist.":"Bitte stimme der Datenverarbeitung zu."), foto:"Ein Foto konnte nicht hochgeladen werden.", "foto-gross":"Die Fotos sind zu groß (je max. 8 MB, zusammen max. 25 MB).", "foto-typ":"Bitte nur Bilder (JPG, PNG, WEBP oder HEIC) hochladen.", mail:"Die Anfrage konnte gerade nicht gesendet werden – bitte per WhatsApp oder E-Mail schreiben.", kontakt:"Bitte deinen Namen und eine Telefonnummer oder E-Mail-Adresse angeben.", datei:"Die Datei konnte nicht hochgeladen werden.", "datei-gross":"Die Datei ist zu groß (max. 10 MB).", "datei-typ":"Bitte nur PDF, Word (DOC/DOCX) oder ein Foto (JPG, PNG, HEIC) anhängen."}[m];
  if (t) { el.textContent = t; el.hidden = false; } })();

// Gutschein-Alarm: "Alle Shops" vs. einzelne Shops, Vorauswahl per ?shop=
document.querySelectorAll("form.code-alarm").forEach(f => {
  const all = f.querySelector('input[value=all]'), boxes = [...f.querySelectorAll('input[name=topics]')].filter(x => x !== all);
  const pre = new URLSearchParams(location.search).get("shop");
  if (pre && f.id === "gutschein-alarm") { const b = boxes.find(x => x.value === pre); if (b) { b.checked = true; all.checked = false; } }
  all.addEventListener("change", () => { if (all.checked) boxes.forEach(x => (x.checked = false)); });
  boxes.forEach(x => x.addEventListener("change", () => { if (x.checked) all.checked = false; }));
});

/* Karriere: Klick auf "Kurzbewerbung" wählt die passende Stelle im Formular */
document.querySelectorAll("a[data-job]").forEach(a => a.addEventListener("click", () => { const s = document.getElementById("job-select"); if (s) s.value = a.dataset.job; }));

/* EV-Rechner (Reseller-Ratgeber Booster öffnen oder versiegelt) */
(function(){ const f = document.getElementById("ev-calc"); if (!f) return;
  const num = el => { const v = parseFloat(String(el.value).replace(",", ".")); return isFinite(v) ? v : 0; };
  const eur = v => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const calc = () => {
    const price = num(f.querySelector("#ev-price")), packs = Math.max(0, Math.round(num(f.querySelector("#ev-packs")))), bulk = num(f.querySelector("#ev-bulk"));
    const odds = [...f.querySelectorAll("[data-ev-odds]")].map(num), vals = [...f.querySelectorAll("[data-ev-val]")].map(num);
    if (!vals.some(v => v > 0) || !(price > 0)) { f.querySelector("#ev-out").innerHTML = "<p>Trage den Displaypreis und die Ø-Werte der Karten ein, dann siehst du hier den Erwartungswert.</p>"; return; }
    let perPack = bulk; odds.forEach((o, i) => { if (o > 0) perPack += vals[i] / o; });
    const ev = perPack * packs, diff = ev - price;
    const sir = odds[3] > 0 ? 1 - Math.pow(1 - 1 / odds[3], packs) : 0;
    f.querySelector("#ev-out").innerHTML = `<p><strong>Erwartungswert pro Display: ${eur(ev)}</strong> (${eur(perPack)} pro Booster)</p>
      <p class="${diff >= 0 ? "ev-pos" : "ev-neg"}">${diff >= 0 ? "Im Schnitt +" + eur(diff) + " gegenüber dem Displaypreis" : "Im Schnitt " + eur(diff) + " gegenüber dem Displaypreis – versiegelt verkaufen ist meist besser"}</p>
      <p>Chance auf mindestens eine Special Illustration Rare im Display: <strong>${Math.round(sir * 100)} %</strong></p>`;
  };
  f.addEventListener("input", calc); f.addEventListener("submit", e => e.preventDefault()); calc();
})();

/* Ansicht Privat/Reseller (Nico 08.11.): merkt sich die Wahl; in der Reseller-Ansicht zeigen Deal-Listen nur Sammler-/Reseller-Deals */
(function(){
  var root = document.documentElement, btns = document.querySelectorAll("[data-mode-set]");
  if (!btns.length) return;
  var grid = document.getElementById("grid"), onRs = /^\/reseller\//.test(location.pathname), showAll = false, note = null;
  function mode(){ return root.getAttribute("data-mode") === "reseller" ? "reseller" : "privat"; }
  function apply(){
    var m = mode();
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-mode-set") === m ? "true" : "false");
    if (!grid || onRs) return;
    var cards = grid.querySelectorAll(".card"), rs = grid.querySelectorAll('.card[data-rs="1"]').length, filter = m === "reseller" && !showAll && rs > 0;
    for (var j = 0; j < cards.length; j++) cards[j].classList.toggle("mode-hide", filter && !cards[j].hasAttribute("data-rs"));
    if (!note) { note = document.createElement("p"); note.className = "mode-note"; grid.parentNode.insertBefore(note, grid); note.addEventListener("click", function(e){ var b = e.target.closest("button"); if (!b) return; if (b.dataset.act === "all") { showAll = !showAll; apply(); } else { setMode("privat"); } }); }
    if (m !== "reseller") { note.hidden = true; return; }
    note.hidden = false;
    note.innerHTML = rs ? (showAll ? '🃏 Reseller-Ansicht · alle Deals sichtbar <button type="button" data-act="all">Nur Reseller-Deals</button>' : '🃏 Reseller-Ansicht: ' + rs + (rs === 1 ? ' Deal' : ' Deals') + ' mit Sammler- und Wiederverkaufswert <button type="button" data-act="all">Alle Deals zeigen</button> <button type="button" data-act="privat">Zur Privat-Ansicht</button>')
      : '🃏 Reseller-Ansicht: Hier gibt es gerade keine Sammler-Deals. <a href="/reseller/">Zum Reseller-Bereich</a>';
  }
  var bar = null;
  function syncBar(){
    var m = mode(), header = document.querySelector("header.top");
    if (!bar && header) { bar = document.createElement("div"); bar.className = "mode-bar"; header.parentNode.insertBefore(bar, header.nextSibling); }
    if (!bar) return;
    if (m !== "reseller") { bar.hidden = true; return; }
    var rs = grid && !onRs ? grid.querySelectorAll('.card[data-rs="1"]').length : 0;
    bar.hidden = false;
    bar.innerHTML = '<div class="wrap"><strong>🃏 Reseller-Ansicht aktiv</strong>' + (rs ? ' <a href="#grid">↓ ' + rs + ' Sammler-Deals</a>' : '') + ' <a href="/reseller/release-kalender/">📅 Termine</a> <a href="/reseller/lego-eol/">🧱 LEGO-EOL</a> <a href="/reseller/rechner/">🧮 Rechner</a> <a href="/reseller/karten-ankauf/">💰 Ankauf</a> <a href="/reseller/">Alles für Reseller →</a></div>';
  }
  function toastMsg(t){ var el = document.getElementById("toast"); if (!el) return; el.textContent = t; el.classList.add("show"); clearTimeout(el._h); el._h = setTimeout(function(){ el.classList.remove("show"); }, 2600); }
  function setMode(m){ root.setAttribute("data-mode", m); try { localStorage.setItem("pd-mode", m); } catch (e) {} showAll = false; apply(); syncBar();
    var rs = grid && !onRs ? grid.querySelectorAll('.card[data-rs="1"]').length : 0;
    toastMsg(m === "reseller" ? "Reseller-Ansicht an" + (rs ? ": " + rs + " Sammler-Deals" : "") : "Privat-Ansicht: alle Deals"); }
  for (var i = 0; i < btns.length; i++) btns[i].addEventListener("click", function(){ setMode(this.getAttribute("data-mode-set")); });
  apply(); syncBar();
})();
/* 22.11.: Aufklappmenüs – nur eins offen, Klick außerhalb oder Esc schließt.
   Handy (≤640 px): Menü öffnet als Blatt von unten, direkt im <body> – so kann es weder vom
   Kopfbereich (backdrop-filter) noch von der waagerecht scrollenden Leiste verdeckt werden (iOS). */
(function(){
  var dds = document.querySelectorAll(".nav-dd");
  if (!dds.length) return;
  var mob = function(){ return window.innerWidth <= 640; };
  var ov = null, sh = null;
  function closeSheet(){ if (ov) { ov.remove(); ov = null; } if (sh) { sh.remove(); sh = null; } document.documentElement.classList.remove("dd-lock"); }
  function openSheet(d){
    closeSheet();
    var sum = d.querySelector("summary"), pan = d.querySelector(".nav-panel");
    ov = document.createElement("div"); ov.className = "dd-ov";
    sh = document.createElement("div"); sh.className = "dd-sheet"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
    var t = (sum.textContent || "").replace(/[▾▴]/g, "").trim();
    sh.innerHTML = '<div class="dd-sh-h"><b></b><button type="button" class="dd-x" aria-label="Schließen">✕</button></div><nav class="dd-sh-l"></nav>';
    sh.querySelector("b").textContent = t;
    sh.querySelector(".dd-sh-l").innerHTML = pan ? pan.innerHTML : "";
    ov.addEventListener("click", function(){ d.open = false; });
    sh.querySelector(".dd-x").addEventListener("click", function(){ d.open = false; });
    document.body.appendChild(ov); document.body.appendChild(sh);
    document.documentElement.classList.add("dd-lock");
  }
  dds.forEach(function(d){ d.addEventListener("toggle", function(){
    if (d.open) {
      dds.forEach(function(o){ if (o !== d) o.open = false; });
      if (mob()) openSheet(d);
      else { var r = d.querySelector("summary").getBoundingClientRect(); d.style.setProperty("--dd-top", (r.bottom + 6) + "px"); }
    } else if (sh && !document.querySelector(".nav-dd[open]")) closeSheet();
  }); });
  document.addEventListener("click", function(e){ if (sh && sh.contains(e.target)) return; dds.forEach(function(d){ if (d.open && !d.contains(e.target)) d.open = false; }); });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") dds.forEach(function(d){ d.open = false; }); });
  window.addEventListener("pageshow", function(){ dds.forEach(function(d){ d.open = false; }); closeSheet(); });
})();
/* 22.11.: Amazon-Tracking-ID je Kanal (Nico hat boeketvgpt/fb/wa/tg-21 im PartnerNet angelegt).
   Kanal wird beim ersten Seitenaufruf aus utm_source bzw. Referrer bestimmt und für die Sitzung gemerkt. */
(function(){
  var MAP = { gpt: "boeketvgpt-21", fb: "boeketvfb-21", wa: "boeketvwa-21", tg: "boeketvtg-21" };
  function detect(){
    var u = "", r = "";
    try { u = (new URLSearchParams(location.search).get("utm_source") || "").toLowerCase(); } catch (e) {}
    try { r = (document.referrer || "").toLowerCase(); } catch (e) {}
    if (/chatgpt|openai/.test(u) || /chatgpt\.com|openai\.com/.test(r)) return "gpt";
    if (/^facebook|^fb|instagram/.test(u) || /facebook\.com|fb\.com|instagram\.com/.test(r)) return "fb";
    if (/whatsapp/.test(u) || /whatsapp/.test(r)) return "wa";
    if (/telegram/.test(u) || /t\.me|telegram/.test(r)) return "tg";
    return "";
  }
  var ch = "";
  try { ch = sessionStorage.getItem("pd_ch") || ""; } catch (e) {}
  var fresh = detect();
  if (fresh) { ch = fresh; try { sessionStorage.setItem("pd_ch", ch); } catch (e) {} }
  var tag = MAP[ch];
  if (!tag) return;
  function fix(a){ if (a.href && /(^|\.)amazon\.de\//.test(a.href.replace(/^https?:\/\//, "")) && /[?&]tag=boeketv-21\b/.test(a.href)) a.href = a.href.replace(/([?&]tag=)boeketv-21\b/, "$1" + tag); }
  document.querySelectorAll("a[href*='amazon.de']").forEach(fix);
  document.addEventListener("click", function(e){ var a = e.target.closest && e.target.closest("a[href*='amazon.de']"); if (a) fix(a); }, true);
})();
