// perldeals search: typo-tolerant, understands synonyms, compound words and plurals.
// Used by the header search (instant results), the deal grid filter and the AI advisor.
(() => {
  const lang = document.documentElement.lang === "en" ? "en" : "de";

  /* ---------- text normalisation ---------- */
  const norm = s => String(s || "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[‐-―]/g, "-").replace(/[^a-z0-9+.,€ -]/g, " ");
  const STOP = new Set(["unter","bis","fuer","mit","und","oder","der","die","das","den","dem","des","ein","eine","einen","einem","ich","suche","suchen","beste","bester","bestes","besten","guenstig","guenstige","guenstiger","guenstigen","billig","billige","the","for","with","best","cheap","welcher","welche","welches","ist","was","von","im","in","am","an","auf","zu","fuer","gut","gute","guter","neu","neue","neuer","neues","a","an","of","to","und","euro","eur","angebot","angebote","deal","deals","kaufen","preis","rabatt"]);
  // light German/English stemming so "Kopfhörer"/"Kopfhoerern", "Waschmaschinen", "lights" match
  const stem = w => {
    if (w.length > 5) w = w.replace(/(ern|en|er|es|em|e|n|s)$/, "");
    else if (w.length > 4) w = w.replace(/(en|e|s|n)$/, "");
    return w;
  };
  const tokens = s => norm(s).split(/[\s,./+-]+/).filter(w => w.length > 1);

  /* ---------- synonyms (both directions) ---------- */
  const GROUPS = [
    ["kopfhoerer","headphones","headphone","earbuds","ohrhoerer","in-ear","inear","over-ear","bluetooth-kopfhoerer","headset","airpods","noise cancelling","anc"],
    ["fernseher","tv","fernsehen","smart-tv","smarttv","glotze","television","led-fernseher","qled-fernseher","oled-fernseher"],
    ["soundbar","heimkino","home cinema","tv-lautsprecher"],
    ["lautsprecher","speaker","box","musikbox","bluetooth-box","bluetooth-lautsprecher","boombox"],
    ["handy","smartphone","phone","mobiltelefon","telefon","iphone","android"],
    ["smartwatch","uhr","watch","fitnessuhr","fitness-tracker","fitnesstracker","sportuhr","wearable"],
    ["laptop","notebook","ultrabook","macbook"],
    ["pc","computer","rechner","mini-pc","minipc","desktop"],
    ["monitor","bildschirm","display","screen"],
    ["tablet","ipad","tab"],
    ["waschmaschine","washing machine","washer","toplader","frontlader","waschautomat"],
    ["trockner","waeschetrockner","dryer","waermepumpentrockner","tumbler"],
    ["waschtrockner","washer-dryer"],
    ["kuehlschrank","fridge","kuehl-gefrierkombination","kuehlgefrierkombination","kuehl","refrigerator","side-by-side","multi-door"],
    ["gefrierschrank","gefrierer","freezer","gefriertruhe","tiefkuehler"],
    ["spuelmaschine","geschirrspueler","spueler","dishwasher","geschirrspuelmaschine"],
    ["herd","backofen","ofen","oven","cooker","herd-set","herdset"],
    ["kochfeld","induktion","induktionskochfeld","ceranfeld","glaskeramik","hob","cooktop"],
    ["mikrowelle","microwave"],
    ["dunstabzugshaube","dunstabzug","abzugshaube","cooker hood","haube"],
    ["kaffeevollautomat","kaffeemaschine","coffee machine","espressomaschine","espresso","siebtraeger","kaffee","coffee","barista"],
    ["heissluftfritteuse","airfryer","air fryer","fritteuse","heissluft","friteuse"],
    ["kuechenmaschine","food processor","mixer","standmixer","blender","kuechenhelfer"],
    ["staubsauger","sauger","vacuum","akkusauger","akku-staubsauger","handstaubsauger","stielsauger"],
    ["saugroboter","staubsaugerroboter","roboter","robot vacuum","wischroboter","saug-wischroboter","robotersauger"],
    ["maehroboter","rasenmaeher","rasenroboter","robot mower","lawn mower","maeher"],
    ["kamera","ueberwachungskamera","camera","cam","sicherheitskamera","webcam","videoueberwachung","aussenkamera"],
    ["drohne","drone","quadrocopter"],
    ["router","wlan","wifi","mesh","netzwerk","switch","repeater","hotspot"],
    ["nas","netzwerkspeicher","cloud","speicher","festplatte","ssd"],
    ["wallbox","ladestation","e-auto","elektroauto","laden","charger"],
    ["e-bike","ebike","pedelec","fahrrad","bike","e-scooter","escooter","roller","scooter"],
    ["rasierer","bartschneider","trimmer","shaver","rasur","barttrimmer"],
    ["zahnbuerste","elektrische zahnbuerste","toothbrush","aufsteckbuersten","buerstenkoepfe","oral-b"],
    ["lego","bausteine","baukasten","klemmbausteine","spielzeug","toy","toys"],
    ["spiel","brettspiel","gesellschaftsspiel","game","monopoly"],
    ["protein","eiweiss","proteinpulver","whey","shake"],
    ["kreatin","creatine"],
    ["vegan","vegane","veganer","veganes","pflanzlich","plant based","plant-based","tierfrei"],
    ["werkzeug","tool","tools","akkuschrauber","bohrmaschine","schraubendreher","multitool","saege","kettensaege"],
    ["heizluefter","heizung","heater","heizgeraet","radiator"],
    ["gaming","gamer","zocken","konsole","playstation","xbox","nintendo"],
    ["stuhl","gaming-stuhl","gamingstuhl","buerostuhl","chair","sessel"],
    ["maus","mouse"],["tastatur","keyboard"],
    ["drucker","printer","etikettendrucker","label printer"],
    ["navi","verkehrswarner","blitzer","blitzerwarner"],
    ["matratze","bett","boxspring"],
    ["rucksack","tasche","bag","backpack","shopper"],
    ["sneaker","schuhe","schuh","turnschuhe","shoes"]
  ].map(g => g.map(norm));
  const SYN = new Map();
  for (const g of GROUPS) for (const w of g) {
    const set = SYN.get(w) || new Set(); g.forEach(x => x !== w && set.add(x)); SYN.set(w, set);
  }

  /* ---------- typo distance (Damerau-Levenshtein with early exit) ---------- */
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const m = a.length, n = b.length, d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= n; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
    }
    return d[m][n];
  }
  const tol = w => w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;

  /* ---------- index ---------- */
  let IDX = null, VOCAB = null, loading = null;
  const CAT = {phone:["Smartphones","Smartphones"],watch:["Smartwatches","Smartwatches"],headphones:["Kopfhörer","Headphones"],speaker:["Lautsprecher","Speakers"],tv:["TV & Soundbars","TV & soundbars"],computer:["PC & Gaming","PC & gaming"],smarthome:["Smart Home","Smart home"],kitchen:["Küche","Kitchen"],home:["Haushalt","Household"],tools:["Werkzeug","Tools"],garden:["Garten","Garden"],sport:["Sport & Fitness","Sport & fitness"],toys:["Spielzeug","Toys"],vegan:["Vegan","Vegan"],b2b:["Business","Business"]};
  function prep(x, text) {
    x._toks = [...new Set(tokens(text).filter(w => !STOP.has(w)))];
    x._stems = x._toks.map(stem);
    x._text = " " + x._toks.join(" ") + " ";
  }
  async function load() {
    if (IDX) return IDX;
    if (!loading) loading = fetch("/data/search-index.json", { credentials: "same-origin" }).then(r => r.json()).then(j => {
      j.deals.forEach(d => { const cl = CAT[d.c] || ["", ""]; prep(d, `${d.t} ${d.te} ${d.b} ${d.s} ${cl[0]} ${cl[1]} ${d.c}${d.v ? " vegan" : ""}`); });
      j.best.forEach(b => prep(b, `${b.t} ${b.te} ${b.k} ${b.i.join(" ")}`));
      j.guides.forEach(g => prep(g, `${g.t} ${g.te} ${g.a}`));
      const v = new Set(); [...j.deals, ...j.best, ...j.guides].forEach(x => x._toks.forEach(w => w.length > 2 && v.add(w)));
      GROUPS.flat().forEach(w => v.add(w));
      VOCAB = [...v]; IDX = j; return j;
    });
    return loading;
  }

  /* ---------- query parsing ---------- */
  function parse(q) {
    const n = norm(q);
    const m = n.match(/(?:unter|bis|max(?:imal)?|hoechstens|under|below|up to|<)\s*(\d+[.,]?\d*)\s*(?:€|eur|euro)?/) || n.match(/(\d+[.,]?\d*)\s*(?:€|eur|euro)\b/);
    const budget = m ? parseFloat(m[1].replace(",", ".")) : null;
    const words = tokens(n.replace(/(\d+[.,]?\d*)\s*(€|eur|euro)/g, " ").replace(/(unter|bis|under|below)\s*\d+[.,]?\d*/g, " "))
      .filter(w => !STOP.has(w) && !/^\d+$/.test(w) || /^\d{2,}$/.test(w) && !budget);
    // for every query word: itself, its synonyms, and close vocabulary words (typos)
    const terms = words.map(w => {
      const alts = new Map([[w, 1]]);
      const syn = SYN.get(w) || SYN.get(stem(w));
      if (syn) syn.forEach(s => alts.set(s, 0.8));
      if (!syn && w.length >= 4 && VOCAB) {
        const t = tol(w);
        for (const v of VOCAB) {
          if (alts.has(v) || Math.abs(v.length - w.length) > t) continue;
          if (dist(w, v, t) <= t) { alts.set(v, 0.7); const s2 = SYN.get(v); if (s2) s2.forEach(s => alts.has(s) || alts.set(s, 0.6)); }
        }
      }
      return { w, alts };
    });
    return { budget, terms };
  }

  // how well does one alternative word match an item (exact > stem > prefix > inside compound word)
  function hit(x, a) {
    if (a.includes(" ")) return x._text.includes(" " + a + " ") ? 1 : (x._text.includes(a) ? 0.9 : 0);
    if (x._toks.includes(a)) return 1;
    const sa = stem(a);
    if (sa.length >= 3 && x._stems.includes(sa)) return 0.95;
    let best = 0;
    for (const t of x._toks) {
      if (a.length >= 3 && t.startsWith(a)) best = Math.max(best, 0.85);
      else if (a.length >= 4 && t.includes(sa)) best = Math.max(best, 0.75);     // "spuelmaschine" in "geschirrspuelmaschine"
      else if (t.length >= 5 && a.includes(t) && t.length >= a.length / 2) best = Math.max(best, 0.6);
    }
    return best;
  }
  function score(x, terms) {
    let s = 0, matched = 0;
    for (const { alts } of terms) {
      let b = 0;
      alts.forEach((wgt, a) => { const h = hit(x, a) * wgt; if (h > b) b = h; });
      if (b > 0) { matched++; s += b; }
    }
    return { s, matched };
  }

  // rank items: prefer items matching all query words; otherwise the best partial matches
  function rank(list, terms, extra, minAvg = 0) {
    if (!terms.length) return [];
    const r = list.map(x => ({ x, ...score(x, terms) })).filter(y => y.matched > 0 && y.s / terms.length >= minAvg);
    const full = r.filter(y => y.matched === terms.length);
    const use = full.length ? full : r.filter(y => y.matched >= Math.ceil(terms.length / 2));
    return use.map(y => ({ x: y.x, s: y.s + (extra ? extra(y.x) : 0) })).sort((a, b) => b.s - a.s).map(y => y.x);
  }

  async function searchAll(q, limit = 8) {
    await load();
    const { budget, terms } = parse(q);
    const disc = d => d.p == null ? 0 : (d.w - d.p) / d.w;
    let deals = rank(IDX.deals, terms, d => disc(d) * 0.8 + (d.l ? 0.15 : 0));
    if (budget != null) deals = (terms.length ? deals : IDX.deals.slice().sort((a, b) => disc(b) - disc(a))).filter(d => d.p != null && d.p <= budget);
    const best = rank(IDX.best, terms, null, 0.8);
    const guides = rank(IDX.guides, terms, null, 0.8).filter(g => budget == null || g.p == null || g.p <= budget);
    // "did you mean": the vocabulary word closest to an unmatched query word
    let suggestion = null;
    if (!deals.length && terms.length) {
      const w = terms[0].w; let bestD = 99;
      for (const v of VOCAB) { const dd = dist(w, v, 3); if (dd < bestD) { bestD = dd; suggestion = v; } }
      if (bestD > 3) suggestion = null;
    }
    return { budget, total: deals.length, deals: deals.slice(0, limit), allDeals: deals, best: best.slice(0, 2), guides: guides.slice(0, 3), suggestion, popular: IDX.deals.slice().sort((a, b) => disc(b) - disc(a)).slice(0, 4) };
  }

  window.PDS = { load, searchAll, ready: () => !!IDX };

  /* ---------- instant results under a search field (header search and AI advisor) ---------- */
  const T = lang === "de"
    ? { all: n => `Alle ${n} Treffer anzeigen`, allAdv: n => `Alle ${n} Ergebnisse anzeigen`, none: "Keine passenden Deals gefunden.", mean: "Meintest du", pop: "Beliebte Deals", best: "Bestenliste", guide: "Kaufberatung" }
    : { all: n => `Show all ${n} results`, allAdv: n => `Show all ${n} results`, none: "No matching deals found.", mean: "Did you mean", pop: "Popular deals", best: "Best list", guide: "Buying guide" };
  const eur = n => n.toLocaleString(lang === "de" ? "de-DE" : "en-IE", { style: "currency", currency: "EUR" });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // deals without a photo get a small category icon (icons come from our own index)
  const thumb = d => d.i ? `<img src="${esc(d.i)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="sugg-ph" aria-hidden="true">${IDX && IDX.icons && IDX.icons[d.c] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IDX.icons[d.c]}</svg>` : ""}</span>`;
  const row = d => `<a class="sugg-item" role="option" href="${esc(lang === "de" ? d.u : d.ue)}">${thumb(d)}<span class="sugg-t">${esc(lang === "de" ? d.t : d.te)}<small>${esc(d.s)}</small></span><span class="sugg-p">${d.p == null ? (lang === "de" ? "bei Amazon" : "at Amazon") : `${eur(d.p)}<small>−${Math.round((1 - d.p / d.w) * 100)}%</small>`}</span></a>`;
  const link = (x, kind) => `<a class="sugg-item sugg-link" role="option" href="${esc(lang === "de" ? x.u : x.ue)}"><span class="sugg-kind">${kind}</span><span class="sugg-t">${esc((lang === "de" ? x.t : x.te).split(":")[0])}</span></a>`;
  let n = 0;
  // allAction: "grid" -> link to the deal list; "submit" -> submit the form (AI advisor shows the full answer)
  function attach(form, input, allAction) {
    if (!form || !input) return;
    const id = "sugg" + (n++ || "");
    const box = document.createElement("div");
    box.className = "sugg"; box.id = id; box.setAttribute("role", "listbox"); box.hidden = true;
    (input.parentElement || form).style.position = "relative";
    (input.parentElement || form).appendChild(box);
    input.setAttribute("aria-controls", id); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("autocomplete", "off");
    const homeUrl = form.getAttribute("action") || "/";
    let timer = null, seq = 0, active = -1;
    async function update() {
      const q = input.value.trim(); const my = ++seq;
      if (q.length < 2) { box.hidden = true; return; }
      const r = await searchAll(q, 6);
      if (my !== seq) return;
      let html = "";
      if (r.deals.length) {
        html += r.deals.map(row).join("");
        html += r.best.map(b => link(b, T.best)).join("") + r.guides.slice(0, 1).map(g => link(g, T.guide)).join("");
        html += allAction === "submit"
          ? `<button type="submit" class="sugg-all">${T.allAdv(r.total)}</button>`
          : `<a class="sugg-all" href="${esc(homeUrl)}?q=${encodeURIComponent(q)}#grid">${T.all(r.total)}</a>`;
      } else {
        html += `<p class="sugg-none">${T.none}${r.suggestion ? ` ${T.mean} <button type="button" class="sugg-mean">${esc(r.suggestion)}</button>?` : ""}</p>`;
        html += `<p class="sugg-head">${T.pop}</p>` + r.popular.map(row).join("");
      }
      box.innerHTML = html; box.hidden = false; active = -1;
      const mean = box.querySelector(".sugg-mean");
      if (mean) mean.addEventListener("click", () => { input.value = mean.textContent; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus(); });
    }
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 90); });
    input.addEventListener("focus", () => { if (input.value.trim().length >= 2) update(); load(); });
    input.addEventListener("keydown", e => {
      const items = [...box.querySelectorAll("a,.sugg-all")];
      if (box.hidden || !items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((a, i) => a.classList.toggle("on", i === active)); items[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && active >= 0) { e.preventDefault(); items[active].click(); }
      else if (e.key === "Escape") { box.hidden = true; }
    });
    form.addEventListener("submit", () => { box.hidden = true; });
    document.addEventListener("click", e => { if (!form.contains(e.target)) box.hidden = true; });
  }
  attach(document.getElementById("search-form"), document.getElementById("q"), "grid");
  attach(document.getElementById("adv-form"), document.getElementById("adv-q"), "submit");
  const mini = document.getElementById("adv-mini-q");
  if (mini) attach(mini.closest("form"), mini, "submit");
})();
