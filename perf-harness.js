/**
 * Dys-Play — Harnais de mesure OCR (diagnostic perf)
 * ---------------------------------------------------
 * Outil de profilage TEMPORAIRE pour répondre à une seule question :
 * où va le temps quand on scanne sur mobile ? (chargement / prétraitement / OCR)
 *
 * Activation : ajouter ?perf=1 à l'URL (https://dys-play.net/?perf=1).
 *   Le flag est mémorisé en localStorage pour survivre aux navigations PWA.
 *   Désactiver : ?perf=0, ou le bouton « Désactiver » du panneau.
 *
 * Quand il est désactivé (cas par défaut, tous les utilisateurs), ce script
 * ne fait STRICTEMENT RIEN : aucun panneau, aucun hook, aucun coût.
 *
 * 100 % local : aucune donnée n'est envoyée nulle part. Le bouton « Copier »
 * met le rapport JSON dans le presse-papiers, c'est tout.
 *
 * À RETIRER une fois le profilage terminé (le verdict du conseil 2026-06-14
 * impose de mesurer avant d'optimiser ; ceci est l'instrument de mesure).
 */
(function () {
  "use strict";

  // --- Gating : activer / désactiver / persister -------------------------
  var LS_KEY = "dysplay_perf";
  var params = new URLSearchParams(location.search);
  if (params.get("perf") === "1") {
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch (e) {}
  } else if (params.get("perf") === "0") {
    try {
      localStorage.removeItem(LS_KEY);
    } catch (e) {}
  }
  var active = false;
  try {
    active = localStorage.getItem(LS_KEY) === "1";
  } catch (e) {}
  if (!active) return; // inerte pour le grand public

  // --- État ---------------------------------------------------------------
  var entries = [];
  var panel, body;

  // Échappe toute chaîne avant interpolation innerHTML (défense en
  // profondeur : aucune valeur ici n'est du contenu utilisateur, mais on
  // ne prend pas de risque si une future valeur le devenait).
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function fmt(ms) {
    if (ms == null || isNaN(ms)) return "—";
    return ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : Math.round(ms) + " ms";
  }

  function median(arr) {
    var a = arr
      .filter(function (n) {
        return typeof n === "number" && !isNaN(n);
      })
      .slice()
      .sort(function (x, y) {
        return x - y;
      });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function deviceInfo() {
    var c = navigator.connection || {};
    return {
      ua: navigator.userAgent,
      cores: navigator.hardwareConcurrency || null,
      deviceMemoryGb: navigator.deviceMemory || null,
      screen: screen.width + "×" + screen.height,
      dpr: window.devicePixelRatio || 1,
      viewport: window.innerWidth + "×" + window.innerHeight,
      connection: c.effectiveType || null,
      saveData: c.saveData || false,
      lang: navigator.language,
    };
  }

  // --- Construction du panneau -------------------------------------------
  function buildPanel() {
    panel = document.createElement("section");
    panel.id = "perf-harness";
    panel.setAttribute("aria-label", "Harnais de mesure de performance OCR");
    panel.style.cssText = [
      "position:fixed",
      "left:0",
      "right:0",
      "bottom:0",
      "z-index:2147483647",
      "max-height:55vh",
      "overflow:auto",
      "background:#0f172a",
      "color:#e2e8f0",
      "font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace",
      "border-top:3px solid #38bdf8",
      "padding:10px 12px",
      "box-shadow:0 -4px 16px rgba(0,0,0,.5)",
    ].join(";");

    var d = deviceInfo();
    var head = document.createElement("div");
    head.style.cssText =
      "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px";
    head.innerHTML =
      '<strong style="color:#38bdf8">⏱ Perf OCR</strong>' +
      '<span style="opacity:.8">' +
      (d.cores || "?") +
      " cœurs · " +
      (d.deviceMemoryGb ? d.deviceMemoryGb + " Go" : "RAM ?") +
      " · " +
      "écran " +
      d.screen +
      " @" +
      d.dpr +
      "x · " +
      (d.connection || "réseau ?") +
      (d.saveData ? " · ÉCO-DATA" : "") +
      "</span>";

    var btns = document.createElement("div");
    btns.style.cssText = "margin-left:auto;display:flex;gap:6px";
    btns.appendChild(mkBtn("Copier", copyReport));
    btns.appendChild(
      mkBtn("Vider", function () {
        entries = [];
        render();
      }),
    );
    btns.appendChild(
      mkBtn("Désactiver", function () {
        try {
          localStorage.removeItem(LS_KEY);
        } catch (e) {}
        panel.remove();
      }),
    );
    head.appendChild(btns);

    body = document.createElement("div");

    panel.appendChild(head);
    panel.appendChild(body);
    document.body.appendChild(panel);
    render();
  }

  function mkBtn(label, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      "min-height:36px;padding:4px 10px;background:#1e293b;color:#e2e8f0;" +
      "border:1px solid #475569;border-radius:6px;font:inherit;cursor:pointer";
    b.addEventListener("click", onClick);
    return b;
  }

  function bar(load, pre, ocr) {
    var total = (load || 0) + (pre || 0) + (ocr || 0) || 1;
    function seg(v, color) {
      var pct = ((v || 0) / total) * 100;
      return (
        '<span style="display:inline-block;height:10px;width:' +
        pct.toFixed(1) +
        "%;background:" +
        color +
        '"></span>'
      );
    }
    return (
      '<div style="width:100%;background:#1e293b;border-radius:4px;overflow:hidden;font-size:0;margin:3px 0">' +
      seg(load, "#94a3b8") + // chargement (gris)
      seg(pre, "#f59e0b") + // prétraitement (orange)
      seg(ocr, "#38bdf8") + // OCR (bleu)
      "</div>"
    );
  }

  function subSteps(st) {
    if (!st) return "";
    var keys = [
      "decode",
      "resize",
      "grayscale",
      "contrast",
      "deskew",
      "binarize",
      "encode",
    ];
    var parts = keys
      .filter(function (k) {
        return st[k] != null;
      })
      .map(function (k) {
        return k + " " + Math.round(st[k]);
      });
    return parts.length
      ? '<div style="opacity:.7;font-size:11px;margin-left:4px">prétrait. ⟶ ' +
          parts.join(" · ") +
          " (ms)</div>"
      : "";
  }

  function render() {
    if (!body) return;
    if (!entries.length) {
      body.innerHTML =
        '<p style="opacity:.7;margin:4px 0">Scanne une image (Photographier / Choisir un fichier). ' +
        "Le 1er scan est « froid » (chargement des ~15 Mo), les suivants « chauds ».</p>";
      return;
    }
    var warm = entries.filter(function (e) {
      return e.workerWasWarm;
    });
    var html = entries
      .map(function (e, i) {
        var total =
          (e.workerLoadTimeMs || 0) +
          (e.preprocessingTimeMs || 0) +
          (e.ocrTimeMs || 0);
        return (
          '<div style="border-top:1px solid #334155;padding:6px 0">' +
          "<div><strong>#" +
          (i + 1) +
          "</strong> " +
          (e.workerWasWarm
            ? '<span style="color:#38bdf8">chaud</span>'
            : '<span style="color:#f59e0b">FROID</span>') +
          " · " +
          esc(e.scanType || "scan") +
          " · " +
          (e.preprocessedWidth || "?") +
          "×" +
          (e.preprocessedHeight || "?") +
          " · conf " +
          (e.confidence != null ? Math.round(e.confidence) : "?") +
          "%" +
          " · <strong>total " +
          fmt(total) +
          "</strong></div>" +
          bar(e.workerLoadTimeMs, e.preprocessingTimeMs, e.ocrTimeMs) +
          '<div style="font-size:12px">' +
          '<span style="color:#94a3b8">chargement ' +
          fmt(e.workerLoadTimeMs) +
          "</span> · " +
          '<span style="color:#f59e0b">prétrait. ' +
          fmt(e.preprocessingTimeMs) +
          "</span> · " +
          '<span style="color:#38bdf8">OCR ' +
          fmt(e.ocrTimeMs) +
          "</span></div>" +
          subSteps(e.stepTimings) +
          "</div>"
        );
      })
      .join("");

    if (warm.length) {
      html +=
        '<div style="border-top:2px solid #38bdf8;margin-top:6px;padding-top:6px">' +
        "<strong>Médiane scans chauds (n=" +
        warm.length +
        ")</strong> — " +
        "prétrait. " +
        fmt(
          median(
            warm.map(function (e) {
              return e.preprocessingTimeMs;
            }),
          ),
        ) +
        " · OCR " +
        fmt(
          median(
            warm.map(function (e) {
              return e.ocrTimeMs;
            }),
          ),
        ) +
        "</div>";
    }
    body.innerHTML = html;
  }

  function copyReport() {
    var report = {
      generatedAt: new Date().toISOString(),
      device: deviceInfo(),
      scans: entries,
      summaryWarm: (function () {
        var w = entries.filter(function (e) {
          return e.workerWasWarm;
        });
        return {
          n: w.length,
          medianPreprocessMs: median(
            w.map(function (e) {
              return e.preprocessingTimeMs;
            }),
          ),
          medianOcrMs: median(
            w.map(function (e) {
              return e.ocrTimeMs;
            }),
          ),
        };
      })(),
    };
    var text = JSON.stringify(report, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          flash("Rapport copié ✓");
        },
        function () {
          fallbackCopy(text);
        },
      );
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText =
      "position:fixed;top:10px;left:10px;width:90%;height:200px;z-index:2147483647";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      flash("Rapport copié ✓");
    } catch (e) {
      flash("Sélectionne + copie manuellement");
      return;
    }
    setTimeout(function () {
      ta.remove();
    }, 100);
  }

  function flash(msg) {
    var f = document.createElement("div");
    f.textContent = msg;
    f.style.cssText =
      "position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:2147483647;" +
      "background:#16a34a;color:#fff;padding:8px 14px;border-radius:8px;font:14px sans-serif";
    document.body.appendChild(f);
    setTimeout(function () {
      f.remove();
    }, 1500);
  }

  // --- API publique : appelée par app.js après chaque OCR ----------------
  window.DysPlayPerf = {
    active: true,
    record: function (entry) {
      entries.push(entry || {});
      render();
    },
  };

  // --- Démarrage ----------------------------------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildPanel);
  } else {
    buildPanel();
  }
})();
