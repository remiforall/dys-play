// Restaure le thème choisi dans l'application avant le premier paint.
// Externalisé (et non inline) pour rester compatible avec la CSP stricte
// du projet (script-src 'self', sans 'unsafe-inline').
(function () {
  try {
    var t = JSON.parse(localStorage.getItem("dysplay_theme"));
    if (["light", "cream", "sepia", "dark", "dark-blue"].indexOf(t) !== -1) {
      document.documentElement.dataset.theme = t;
    }
  } catch (e) {}
})();
