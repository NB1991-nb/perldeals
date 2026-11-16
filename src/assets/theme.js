(function(){
  var r = document.documentElement;
  try { var t = localStorage.getItem("pd-theme"); if (t === "dark" || t === "light") r.setAttribute("data-theme", t); } catch (e) {}
  var dark = r.getAttribute("data-theme") ? r.getAttribute("data-theme") === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  r.classList.toggle("is-dark", dark);
  try { r.setAttribute("data-mode", localStorage.getItem("pd-mode") === "reseller" ? "reseller" : "privat"); } catch (e) { r.setAttribute("data-mode", "privat"); }
})();
