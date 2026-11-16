(function(){
  "use strict";
  var root = document.getElementById("account"); if (!root) return;
  var lang = document.documentElement.lang === "en" ? "en" : "de";
  var T = {
    de: {
      sent:"Fast geschafft: Wir haben dir einen Anmeldelink geschickt. Er gilt 30 Minuten. Schau auch im Spam-Ordner nach.",
      badMail:"Bitte gib eine gültige E-Mail-Adresse ein.", tooMany:"Zu viele Versuche. Bitte warte ein paar Minuten.",
      mailFail:"Die E-Mail konnte gerade nicht verschickt werden. Bitte versuch es gleich noch einmal.",
      badToken:"Dieser Anmeldelink ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.",
      offline:"Konten sind in Kürze verfügbar. Bitte versuch es später noch einmal.", generic:"Etwas ist schiefgelaufen. Bitte versuch es noch einmal.",
      saved:"Einstellungen gespeichert", added:"Preisalarm angelegt", removed:"Preisalarm gelöscht", loggedOut:"Abgemeldet",
      none:"Du hast noch keinen Preisalarm. Lege oben deinen ersten an.", any:"alle Kategorien", upTo:"bis", del:"Löschen",
      kwReq:"Bitte gib einen Suchbegriff oder eine Kategorie an.", limit:"Du kannst bis zu 25 Preisalarme anlegen.",
      confirmDel:"Konto wirklich löschen? Alle Preisalarme und Einstellungen werden sofort entfernt.", deleted:"Dein Konto wurde gelöscht."
    },
    en: {
      sent:"Almost done: we sent you a sign-in link. It is valid for 30 minutes. Check your spam folder too.",
      badMail:"Please enter a valid email address.", tooMany:"Too many attempts. Please wait a few minutes.",
      mailFail:"We could not send the email right now. Please try again shortly.",
      badToken:"This sign-in link has expired or was already used. Just request a new one.",
      offline:"Accounts will be available shortly. Please try again later.", generic:"Something went wrong. Please try again.",
      saved:"Settings saved", added:"Price alert created", removed:"Price alert deleted", loggedOut:"Signed out",
      none:"You have no price alerts yet. Create your first one above.", any:"all categories", upTo:"up to", del:"Delete",
      kwReq:"Please enter a search term or choose a category.", limit:"You can create up to 25 price alerts.",
      confirmDel:"Really delete your account? All price alerts and settings will be removed immediately.", deleted:"Your account has been deleted."
    }
  }[lang];
  var CATS = JSON.parse(root.getAttribute("data-cats") || "{}");
  var csrf = "";
  var $ = function(id){ return document.getElementById(id); };
  var views = { loading:$("acc-loading"), login:$("acc-login"), app:$("acc-app") };
  function show(v){ Object.keys(views).forEach(function(k){ views[k].hidden = k !== v; }); }
  function toast(msg){ var t=$("toast"); if(!t) return; t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(function(){t.classList.remove("show");},2600); }
  function note(el, msg, ok){ el.textContent = msg; el.hidden = !msg; el.className = "form-note" + (ok ? " ok" : ""); }
  function errText(e){ return ({invalid_email:T.badMail, too_many_requests:T.tooMany, mail_failed:T.mailFail, invalid_token:T.badToken, not_configured:T.offline, keyword_required:T.kwReq, too_many_alerts:T.limit})[e] || T.generic; }

  function api(path, body){
    var opt = { method: body === undefined ? "GET" : "POST", credentials:"same-origin", headers:{} };
    if (body !== undefined){ opt.headers["Content-Type"]="application/json"; opt.body=JSON.stringify(body); if (csrf) opt.headers["X-CSRF-Token"]=csrf; }
    return fetch(path, opt).then(function(r){
      return r.json().catch(function(){ return {ok:false, error:"generic"}; }).then(function(j){ j._status=r.status; return j; });
    }).catch(function(){ return {ok:false, error:"generic"}; });
  }

  function render(me){
    csrf = me.csrf;
    $("acc-email").textContent = me.email;
    $("pref-alerts").checked = me.prefs.alerts_enabled;
    $("pref-freq-" + me.prefs.alert_frequency).checked = true;
    $("pref-news").checked = me.prefs.newsletter;
    var list = $("alert-list"); list.textContent = "";
    if (!me.alerts.length){ var li=document.createElement("li"); li.className="alert-empty"; li.textContent=T.none; list.appendChild(li); }
    me.alerts.forEach(function(a){
      var li=document.createElement("li"); li.className="alert-item";
      var main=document.createElement("div");
      var b=document.createElement("b"); b.textContent = a.keyword || (CATS[a.cat] || T.any);
      var small=document.createElement("small");
      small.textContent = (a.cat ? (CATS[a.cat] || a.cat) : T.any) + (a.max_price ? " · " + T.upTo + " " + a.max_price.toLocaleString(lang==="en"?"en-IE":"de-DE",{style:"currency",currency:"EUR"}) : "");
      main.appendChild(b); main.appendChild(small);
      var btn=document.createElement("button"); btn.type="button"; btn.className="btn btn-ghost"; btn.textContent=T.del;
      btn.addEventListener("click", function(){ api("/api/alerts.php?action=delete",{id:a.id}).then(function(r){ if(r.ok){ toast(T.removed); load(); } else toast(errText(r.error)); }); });
      li.appendChild(main); li.appendChild(btn); list.appendChild(li);
    });
    show("app");
  }

  function load(){
    return api("/api/me.php").then(function(r){
      if (r.ok) render(r);
      else { if (r.error === "not_configured") note($("login-note"), T.offline); show("login"); }
    });
  }

  // Prefill an alert from ?q=...&cat=... (links on deal pages)
  var params = new URLSearchParams(location.search);
  if (params.get("alarm")) $("alert-kw").value = params.get("alarm").slice(0,80);
  if (params.get("cat") && CATS[params.get("cat")]) $("alert-cat").value = params.get("cat");

  // Magic-link sign-in: token arrives in the URL fragment (never sent to the server in logs)
  var m = location.hash.match(/^#login=([A-Za-z0-9_-]{40,50})$/);
  if (m){
    history.replaceState(null, "", location.pathname + location.search);
    api("/api/auth.php?action=verify",{token:m[1]}).then(function(r){
      if (r.ok){ csrf=r.csrf; load(); } else { show("login"); note($("login-note"), errText(r.error)); }
    });
  } else load();

  $("login-form").addEventListener("submit", function(e){
    e.preventDefault();
    var btn=this.querySelector("button"); btn.disabled=true;
    api("/api/auth.php?action=request",{email:$("login-email").value, lang:lang, website:$("login-website").value}).then(function(r){
      btn.disabled=false;
      if (r.ok){ if (window.pdCampAlarm) window.pdCampAlarm(); note($("login-note"), T.sent, true); $("login-form").reset(); }
      else note($("login-note"), errText(r.error));
    });
  });

  $("alert-form").addEventListener("submit", function(e){
    e.preventDefault();
    var body={keyword:$("alert-kw").value, cat:$("alert-cat").value || null, max_price:$("alert-max").value || null};
    api("/api/alerts.php?action=create", body).then(function(r){
      if (r.ok){ if (window.pdCampAlarm) window.pdCampAlarm(); toast(T.added); $("alert-form").reset(); note($("alert-note"),""); load(); }
      else note($("alert-note"), errText(r.error));
    });
  });

  $("prefs-form").addEventListener("submit", function(e){
    e.preventDefault();
    api("/api/me.php?action=prefs",{alerts_enabled:$("pref-alerts").checked, alert_frequency:$("pref-freq-daily").checked?"daily":"instant", newsletter:$("pref-news").checked, lang:lang})
      .then(function(r){ toast(r.ok ? T.saved : errText(r.error)); });
  });

  $("logout").addEventListener("click", function(){
    api("/api/auth.php?action=logout",{}).then(function(){ csrf=""; toast(T.loggedOut); show("login"); });
  });

  // Account deletion with an in-page confirmation step
  var delStep = $("delete-confirm");
  $("delete-start").addEventListener("click", function(){ delStep.hidden = false; });
  $("delete-cancel").addEventListener("click", function(){ delStep.hidden = true; });
  $("delete-go").addEventListener("click", function(){
    api("/api/me.php?action=delete",{}).then(function(r){ if (r.ok){ csrf=""; delStep.hidden=true; show("login"); note($("login-note"), T.deleted, true); } else toast(errText(r.error)); });
  });
})();
