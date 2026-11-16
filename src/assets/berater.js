// perldeals Kaufberater: asks the AI endpoint if enabled, otherwise answers with a local smart search
(() => {
  const form = document.getElementById("adv-form");
  if (!form) return;
  const lang = document.documentElement.lang === "en" ? "en" : "de";
  const input = document.getElementById("adv-q"), out = document.getElementById("adv-out");
  const T = lang === "de"
    ? { loading: "Ich suche passende Angebote …", none: "Dazu habe ich gerade nichts Passendes gefunden. Versuch es mit einem anderen Begriff, zum Beispiel „Kopfhörer unter 50 €“.", local: "Passend zu deiner Frage", best: "Bestenliste", guide: "Kaufberatung", deal: "Deal", budget: b => `Mit Budget bis ${b} €:`, ai: "Antwort vom KI-Berater", aiNote: "KI-Antwort auf Basis unserer Deals und Ratgeber. Bitte Preise im Shop prüfen.", err: "Der Berater ist gerade nicht erreichbar, hier die Treffer aus unserer Suche:" }
    : { loading: "Looking for matching offers …", none: "Nothing matching right now. Try another term, e.g. “headphones under 50 €”.", local: "Matching your question", best: "Best list", guide: "Buying guide", deal: "Deal", budget: b => `With a budget up to €${b}:`, ai: "Answer from the AI advisor", aiNote: "AI answer based on our deals and guides. Please check prices in the shop.", err: "The advisor is unavailable right now, here are results from our search:" };
  const eur = n => n.toLocaleString(lang === "de" ? "de-DE" : "en-IE", { style: "currency", currency: "EUR" });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let IDX = null;
  const loadIdx = async () => IDX || (IDX = await fetch("/data/ai-index.json", { credentials: "same-origin" }).then(r => r.json()));

  const SYN = {
    smarthome: ["saugroboter", "saugroboters", "staubsaugerroboter", "wischroboter", "robot vacuum", "kamera", "überwachungskamera", "camera", "smart home", "alarm"],
    garden: ["mähroboter", "rasenmäher", "rasenroboter", "garten", "robot mower", "lawn", "mower", "rasen"],
    headphones: ["kopfhörer", "headphones", "earbuds", "in-ear", "over-ear", "anc", "noise cancelling", "airpods", "ohrhörer"],
    speaker: ["lautsprecher", "box", "musikbox", "speaker", "bluetooth box", "jbl"],
    tv: ["soundbar", "fernseher", "tv", "heimkino"],
    phone: ["handy", "smartphone", "phone", "iphone", "android", "powerbank"],
    watch: ["smartwatch", "uhr", "watch", "fitnessuhr", "fitness tracker"],
    computer: ["monitor", "bildschirm", "gaming", "pc", "laptop", "gaming stuhl", "gaming-stuhl", "stuhl", "chair"],
    kitchen: ["heißluftfritteuse", "airfryer", "air fryer", "fritteuse", "kaffee", "küche", "kitchen", "milchaufschäumer"],
    home: ["staubsauger", "waschmaschine", "trockner", "haushalt", "vacuum", "washing machine", "dryer", "dyson"],
    toys: ["lego", "spielzeug", "kinder", "toy", "kids", "geschenk für kinder"],
    tools: ["werkzeug", "schraubendreher", "akkuschrauber", "tools", "multitool"],
    sport: ["protein", "kreatin", "whey", "fitness", "sport"],
    vegan: ["vegan", "veganer", "vegane", "veganes", "pflanzlich", "plant based", "plant-based", "erbsenprotein", "sojaprotein", "tierfrei"]
  };
  const norm = s => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

  function localSearch(q) {
    const nq = norm(q);
    const m = nq.match(/(?:unter|bis|max(?:imal)?|hoechstens|under|below|up to|<)\s*(\d+[.,]?\d*)\s*(?:€|eur|euro)?/) || nq.match(/(\d+[.,]?\d*)\s*(?:€|eur|euro)\b/);
    const budget = m ? parseFloat(m[1].replace(",", ".")) : null;
    const cats = Object.keys(SYN).filter(c => SYN[c].some(w => nq.includes(norm(w))));
    const words = nq.replace(/(\d+[.,]?\d*)\s*(€|eur|euro|m2|m²|qm)?/g, " ").split(/[^a-z0-9-]+/).filter(w => w.length > 2 && !["unter", "fuer", "mit", "und", "der", "die", "das", "ein", "eine", "einen", "bis", "ich", "suche", "beste", "bester", "bestes", "guenstig", "the", "for", "with", "best", "cheap", "welcher", "welche", "welches", "ist", "was"].includes(w));
    // words hit = strong signal; category alone only counts when no item matches a word
    const rank = (list, text, cat) => {
      const r = list.map(x => { const t = norm(text(x)); const hits = words.filter(w => t.includes(w)).length; return { x, hits, s: hits * 3 + (cats.includes(cat(x)) ? 4 : 0) }; });
      const anyHit = r.some(y => y.hits > 0);
      return r.filter(y => (anyHit ? y.hits > 0 : y.s > 0)).sort((a, b) => b.s - a.s);
    };
    const deals = rank(IDX.deals, d => `${d.t} ${d.te} ${d.b}`, d => d.c).filter(y => budget == null || y.x.p <= budget)
      .sort((a, b) => b.s - a.s || ((b.x.w - b.x.p) / b.x.w - (a.x.w - a.x.p) / a.x.w)).slice(0, 6).map(y => y.x);
    const best = rank(IDX.best, b => `${b.t} ${b.k} ${b.i.join(" ")}`, b => b.c).slice(0, 2).map(y => y.x);
    const guides = rank(IDX.guides, g => `${g.t} ${g.a}`, g => g.c).filter(y => budget == null || y.x.p == null || y.x.p <= budget).slice(0, 3).map(y => y.x);
    return { budget, deals, best, guides };
  }

  const dealCard = d => `<li class="adv-item"><a href="${esc(lang === "de" ? d.u : d.ue)}"><span class="adv-kind">${T.deal} · ${esc(d.s)}</span><strong>${esc(lang === "de" ? d.t : d.te)}</strong><span class="adv-price">${eur(d.p)} <s>${eur(d.w)}</s> −${Math.round((1 - d.p / d.w) * 100)}%</span></a></li>`;
  const bestCard = b => `<li class="adv-item"><a href="${esc(lang === "de" ? b.u : b.ue)}"><span class="adv-kind">${T.best}</span><strong>${esc(lang === "de" ? b.t : b.te)}</strong><span>${esc((b.i || []).slice(0, 3).join(" · "))}</span></a></li>`;
  const guideCard = g => `<li class="adv-item"><a href="${esc(lang === "de" ? g.u : g.ue)}"><span class="adv-kind">${T.guide}</span><strong>${esc(lang === "de" ? g.t : g.te)}</strong><span>${esc(g.a)}</span></a></li>`;

  // local answer: smart search (typos, synonyms) from search.js; falls back to the simple keyword search
  async function renderLocal(q, prefix) {
    let r;
    if (window.PDS) r = await window.PDS.searchAll(q, 60); else r = localSearch(q);
    const none = !r.deals.length && !r.best.length && !r.guides.length;
    if (none) {
      const mean = r.suggestion ? (lang === "de" ? ` Meintest du <button type="button" class="adv-mean">${esc(r.suggestion)}</button>?` : ` Did you mean <button type="button" class="adv-mean">${esc(r.suggestion)}</button>?`) : "";
      const pop = (r.popular || []).map(dealCard).join("");
      out.innerHTML = `<p class="adv-answer">${T.none}${mean}</p>${pop ? `<h2>${lang === "de" ? "Beliebte Deals" : "Popular deals"}</h2><ul class="adv-list">${pop}</ul>` : ""}`;
      const b = out.querySelector(".adv-mean"); if (b) b.addEventListener("click", () => { input.value = b.textContent; form.requestSubmit(); });
      return;
    }
    out.innerHTML = `${prefix ? `<p class="adv-note">${prefix}</p>` : ""}<h2>${T.local}</h2>${r.budget ? `<p class="adv-note">${T.budget(r.budget)}</p>` : ""}
      <ul class="adv-list">${r.best.map(bestCard).join("")}${r.deals.map(dealCard).join("")}${r.guides.map(guideCard).join("")}</ul>`;
  }

  async function ask(q) {
    out.innerHTML = `<p class="adv-note">${T.loading}</p>`;
    await loadIdx();
    try {
      const res = await fetch("/api/ask.php", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ q, lang }) });
      const j = await res.json();
      if (j.ok && j.ai) {
        const by = { deal: Object.fromEntries(IDX.deals.map(d => [d.id, d])), guide: Object.fromEntries(IDX.guides.map(g => [g.id, g])), best: Object.fromEntries(IDX.best.map(b => [b.id, b])) };
        const cards = j.picks.map(p => p.type === "deal" ? dealCard(by.deal[p.id]) : p.type === "best" ? bestCard(by.best[p.id]) : guideCard(by.guide[p.id])).join("");
        out.innerHTML = `<h2>${T.ai}</h2><p class="adv-answer">${esc(j.answer)}</p>${cards ? `<ul class="adv-list">${cards}</ul>` : ""}<p class="adv-note">${T.aiNote}</p>`;
        if (window.PDS) {
          // below the AI answer: all other matching deals from the smart search
          const shown = new Set(j.picks.filter(p => p.type === "deal").map(p => p.id));
          const r = await window.PDS.searchAll(q, 60); const more = r.deals.filter(d => !shown.has(d.id));
          if (more.length) out.insertAdjacentHTML("beforeend", `<h2>${lang === "de" ? `Alle passenden Deals (${more.length})` : `All matching deals (${more.length})`}</h2><ul class="adv-list">${more.map(dealCard).join("")}</ul>`);
        }
        return;
      }
      renderLocal(q, j.error === "disabled" ? "" : T.err);
    } catch { renderLocal(q, ""); }
  }

  form.addEventListener("submit", e => { e.preventDefault(); const q = input.value.trim(); if (q.length < 2) return; history.replaceState(null, "", "?q=" + encodeURIComponent(q)); ask(q); });
  document.querySelectorAll("[data-adv]").forEach(b => b.addEventListener("click", () => { input.value = b.dataset.adv; form.requestSubmit(); }));
  const q0 = new URLSearchParams(location.search).get("q");
  if (q0) { input.value = q0; ask(q0); }
})();
