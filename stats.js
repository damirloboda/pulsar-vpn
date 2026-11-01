// Cookieless daily counters (abacus.jasoncameron.dev, no account): one visit per
// browser session, plus every Download click. Keys are v-YYYY-MM-DD / d-YYYY-MM-DD (UTC).
(function () {
  var NS = "https://abacus.jasoncameron.dev/hit/pulsarvpn-site/";
  var day = new Date().toISOString().slice(0, 10);
  function hit(kind) {
    try { fetch(NS + kind + "-" + day, { mode: "cors", keepalive: true }); } catch (e) {}
  }
  try {
    if (!sessionStorage.getItem("pv")) { sessionStorage.setItem("pv", "1"); hit("v"); }
  } catch (e) { hit("v"); }
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-download]")) hit("d");
  }, true);
})();
