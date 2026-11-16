/* Reseller-Rechner: nötiger Verkaufspreis und maximaler Ankaufspreis (perldeals) */
(function () {
  "use strict";
  var root = document.getElementById("rr");
  if (!root) return;

  // Gebühren-Voreinstellungen (Stand siehe Seite). pct = Provision in %, pct2/thr = Satz über Schwelle, fixLo/fixHi/fixThr = Festgebühr je Bestellung, min = Mindestgebühr, perItem = Stückgebühr
  var P = {
    "ebay-privat":      { n: "eBay privat (Deutschland)", pct: 0, fixLo: 0, fixHi: 0, vatOnFees: false },
    "ebay-tcg":         { n: "eBay gewerblich · Sammelkarten", pct: 11, pct2: 3, thr: 990, fixLo: 0.35, fixHi: 0.45, fixThr: 10, vatOnFees: true },
    "ebay-spielzeug":   { n: "eBay gewerblich · Spielzeug/LEGO", pct: 12, pct2: 3, thr: 990, fixLo: 0.35, fixHi: 0.45, fixThr: 10, vatOnFees: true },
    "ebay-games":       { n: "eBay gewerblich · Videospiele", pct: 12, pct2: 3, thr: 990, fixLo: 0.35, fixHi: 0.45, fixThr: 10, vatOnFees: true },
    "ebay-konsole":     { n: "eBay gewerblich · Konsolen (gebraucht)", pct: 5, fixLo: 0.35, fixHi: 0.45, fixThr: 10, vatOnFees: true },
    "amazon-spielzeug": { n: "Amazon · Spielzeug/LEGO (Profi-Tarif)", pct: 15, min: 0.30, vatOnFees: true },
    "amazon-games":     { n: "Amazon · Videospiele (Profi-Tarif)", pct: 15, min: 0.30, vatOnFees: true },
    "amazon-konsole":   { n: "Amazon · Konsolen (Profi-Tarif)", pct: 8, min: 0.30, vatOnFees: true },
    "cardmarket":       { n: "Cardmarket privat", pct: 5, vatOnFees: false },
    "cardmarket-pro":   { n: "Cardmarket Professional", pct: 3, vatOnFees: true },
    "kleinanzeigen":    { n: "Kleinanzeigen (Abholung/Überweisung)", pct: 0, vatOnFees: false },
    "paypal":           { n: "Direktverkauf mit PayPal (Waren & Dienstl.)", pct: 2.49, fixLo: 0.35, fixHi: 0.35, vatOnFees: false },
    "vinted":           { n: "Vinted (Käufer zahlt Schutzgebühr)", pct: 0, vatOnFees: false },
    "eigen":            { n: "Eigene Werte", pct: 0, vatOnFees: false }
  };

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var v = parseFloat(String($(id).value).replace(",", ".")); return isFinite(v) ? v : 0; };
  var eur = function (v) { return (Math.round(v * 100) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }); };

  function cfg() {
    return {
      pct: num("rr-pct"), pct2: num("rr-pct2"), thr: num("rr-thr"), fix: num("rr-fix"), min: num("rr-min"),
      vatOnFees: $("rr-feevat").checked
    };
  }

  // Alle Kosten bei Artikelpreis vk (Käufer zahlt zusätzlich versandK)
  function calc(vk, ek, c) {
    var shipIn = num("rr-shipin"), shipOut = num("rr-shipout"), pack = num("rr-pack"), other = num("rr-other");
    var gross = vk + shipIn; // Plattformen rechnen Provision auf den Gesamtbetrag inkl. Versand
    var fee;
    if (c.thr > 0 && gross > c.thr) fee = c.thr * c.pct / 100 + (gross - c.thr) * c.pct2 / 100;
    else fee = gross * c.pct / 100;
    if (c.min > 0 && gross > 0) fee = Math.max(fee, c.min);
    var fixFee = gross > 0 ? c.fix : 0;
    var platform = fee + fixFee;
    if (c.vatOnFees) platform = platform * 1.19;
    var tax = 0, mode = $("rr-tax").value;
    if (mode === "regel") tax = gross * 19 / 119;
    else if (mode === "diff") tax = Math.max(0, gross - ek) * 19 / 119;
    var cost = ek + shipOut + pack + other;
    var profit = gross - platform - tax - cost;
    return { gross: gross, platform: platform, tax: tax, cost: cost, shipOut: shipOut, pack: pack, other: other, profit: profit };
  }

  function target(r, ek, vk) {
    var t = num("rr-target"), m = $("rr-tmode").value;
    if (m === "eur") return t;
    if (m === "ek") return ek * t / 100;      // Aufschlag auf EK
    return (vk + num("rr-shipin")) * t / 100;  // Marge vom Umsatz
  }

  // Kleinster VK, bei dem Gewinn >= Ziel
  function solveVK(ek, c, zero) {
    var lo = 0, hi = 1000000;
    var ok = function (vk) { var r = calc(vk, ek, c); return r.profit - (zero ? 0 : target(r, ek, vk)) >= 0; };
    if (!ok(hi)) return null;
    for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
    return Math.ceil(hi * 100) / 100;
  }
  // Größter EK, bei dem Gewinn >= Ziel (Verkaufspreis gegeben)
  function solveEK(vk, c) {
    var lo = 0, hi = vk + num("rr-shipin");
    var ok = function (ek) { var r = calc(vk, ek, c); return r.profit - target(r, ek, vk) >= 0; };
    if (!ok(0)) return null;
    for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
    return Math.floor(lo * 100) / 100;
  }

  function row(l, v, cls) { return "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + l + "</td><td>" + v + "</td></tr>"; }
  function breakdown(vk, ek, c) {
    var r = calc(vk, ek, c);
    var m = r.gross > 0 ? Math.round(r.profit / r.gross * 1000) / 10 : 0;
    return "<table class=\"rr-table\"><tbody>" +
      row("Verkaufspreis Artikel", eur(vk)) +
      row("+ Versand, den der Käufer zahlt", eur(r.gross - vk)) +
      row("= Umsatz", eur(r.gross), "sum") +
      row("− Plattform- und Zahlungsgebühren" + (c.vatOnFees ? " (inkl. 19 % USt)" : ""), eur(r.platform)) +
      row("− Umsatzsteuer an das Finanzamt", eur(r.tax)) +
      row("− Einkaufspreis", eur(ek)) +
      row("− Versandkosten, Verpackung, Sonstiges", eur(r.shipOut + r.pack + r.other)) +
      row("= Gewinn", eur(r.profit) + " (" + m.toLocaleString("de-DE") + " % vom Umsatz)", "sum " + (r.profit >= 0 ? "pos" : "neg")) +
      "</tbody></table>";
  }

  function compare(ek, mode, vkGiven) {
    var keep = $("rr-platform").value, html = "<table class=\"rr-table rr-cmp\"><thead><tr><th>Plattform</th><th>" + (mode === "vk" ? "Nötiger Verkaufspreis" : "Max. Ankaufspreis") + "</th></tr></thead><tbody>";
    Object.keys(P).forEach(function (k) {
      if (k === "eigen") return;
      var p = P[k];
      var c = { pct: p.pct || 0, pct2: p.pct2 || 0, thr: p.thr || 0, fix: p.fixHi != null ? p.fixHi : 0, min: p.min || 0, vatOnFees: p.vatOnFees && $("rr-tax").value === "none" };
      var v = mode === "vk" ? solveVK(ek, c) : solveEK(vkGiven, c);
      html += "<tr" + (k === keep ? ' class="cur"' : "") + "><td>" + p.n + "</td><td>" + (v == null ? "–" : eur(v)) + "</td></tr>";
    });
    return html + "</tbody></table>";
  }

  function applyPreset() {
    var p = P[$("rr-platform").value]; if (!p) return;
    $("rr-pct").value = String(p.pct || 0).replace(".", ",");
    $("rr-pct2").value = String(p.pct2 || 0).replace(".", ",");
    $("rr-thr").value = p.thr || 0;
    $("rr-fix").value = String(p.fixHi != null ? p.fixHi : 0).replace(".", ",");
    $("rr-min").value = String(p.min || 0).replace(".", ",");
    $("rr-feevat").checked = !!p.vatOnFees && $("rr-tax").value === "none";
  }

  function run() {
    var c = cfg(), mode = $("rr-mode").value, out = $("rr-out");
    root.classList.toggle("mode-ek", mode === "ek");
    if (mode === "vk") {
      var ek = num("rr-ek"), vk = solveVK(ek, c), be = solveVK(ek, c, true);
      if (vk == null) { out.innerHTML = "<p class=\"rr-big\">Mit diesen Einstellungen ist das Ziel nicht erreichbar.</p>"; return; }
      out.innerHTML = "<p class=\"rr-kicker\">Nötiger Verkaufspreis</p><p class=\"rr-big\">" + eur(vk) + "</p><p class=\"rr-sub\">Ohne Gewinn (Break-even): <strong>" + eur(be) + "</strong></p>" +
        breakdown(vk, ek, c) + "<h3>Gleiches Ziel auf anderen Plattformen</h3>" + compare(ek, "vk");
    } else {
      var vkG = num("rr-vk"), maxEk = solveEK(vkG, c);
      if (maxEk == null) { out.innerHTML = "<p class=\"rr-big\">Bei diesem Verkaufspreis bleibt nach Kosten nichts übrig.</p>"; return; }
      out.innerHTML = "<p class=\"rr-kicker\">Maximaler Ankaufspreis</p><p class=\"rr-big\">" + eur(maxEk) + "</p><p class=\"rr-sub\">So viel darfst du höchstens zahlen, damit dein Ziel bei " + eur(vkG) + " Verkaufspreis erreicht wird.</p>" +
        breakdown(vkG, maxEk, c) + "<h3>Gleicher Verkaufspreis auf anderen Plattformen</h3>" + compare(0, "ek", vkG);
    }
    try { localStorage.setItem("pd-rechner", JSON.stringify(Array.prototype.map.call(root.querySelectorAll("input,select"), function (e) { return [e.id, e.type === "checkbox" ? e.checked : e.value]; }))); } catch (e) {}
  }

  try {
    var saved = JSON.parse(localStorage.getItem("pd-rechner") || "null");
    if (saved) saved.forEach(function (p) { var e = $(p[0]); if (e) { if (e.type === "checkbox") e.checked = p[1]; else e.value = p[1]; } });
    else applyPreset();
  } catch (e) { applyPreset(); }

  $("rr-platform").addEventListener("change", function () { applyPreset(); run(); });
  $("rr-tax").addEventListener("change", function () { applyPreset(); run(); });
  root.addEventListener("input", run);
  root.addEventListener("change", run);
  $("rr-reset").addEventListener("click", function () { try { localStorage.removeItem("pd-rechner"); } catch (e) {} location.reload(); });
  run();
})();
