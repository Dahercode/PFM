/*
 * Favori « Export PFM » pour Attijarinet.
 * À cliquer sur la page Opérations d'un compte : récupère les opérations dans la session
 * déjà ouverte, ouvre la PFM et les lui transmet directement (postMessage, origine vérifiée
 * des deux côtés). Si l'envoi direct échoue, télécharge un fichier JSON à importer.
 * Aucun identifiant n'est lu ni stocké.
 */
(function () {
  var PFM_ORIGIN = "https://dahercode.github.io";
  var PFM_URL = PFM_ORIGIN + "/PFM/";
  var CHUNK = 90;
  var RUN = String(Date.now());

  function note(text) {
    var d = document.getElementById("pfm-note");
    if (!d) {
      d = document.createElement("div");
      d.id = "pfm-note";
      d.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#0d0f1a;color:#fff;padding:12px 16px;border-radius:12px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:380px";
      document.body.appendChild(d);
    }
    d.textContent = text;
    d.setAttribute("data-run", RUN);
  }

  var m = location.pathname.match(/\/particulier\/consultation\/compte\/([^/?#]+)\/operation/);
  if (location.host !== "attijarinet.attijariwafa.com" || !m) {
    alert("Ouvre la page Opérations de ton compte Simple sur Attijarinet, puis clique à nouveau sur ce favori.");
    return;
  }
  var accountId = m[1];

  function token() {
    var el = document.querySelector('input[name="CSRFToken"],input[name="csrfToken"],meta[name="CSRFToken"],meta[name="_csrf"]');
    var v = el && (el.value || el.getAttribute("content"));
    if (v) return v;
    var res = performance.getEntriesByType("resource");
    for (var i = 0; i < res.length; i++) {
      var r = res[i].name.match(/[?&]CSRFToken=([^&]+)/);
      if (r) return decodeURIComponent(r[1]);
    }
    var links = document.querySelectorAll("a[href*='CSRFToken='],form[action*='CSRFToken=']");
    for (var j = 0; j < links.length; j++) {
      var a = (links[j].getAttribute("href") || links[j].getAttribute("action")).match(/CSRFToken=([^&"']+)/);
      if (a) return decodeURIComponent(a[1]);
    }
    var scripts = document.querySelectorAll("script:not([src])");
    for (var k = 0; k < scripts.length; k++) {
      var s = scripts[k].textContent.match(/CSRFToken["'\s]*[:=]\s*["']([^"']+)["']/i);
      if (s) return s[1];
    }
    return null;
  }

  var csrf = token();
  if (!csrf) { note("Jeton de session introuvable : recharge la page des opérations puis réessaie."); return; }

  function pad(n) { return String(n).padStart(2, "0"); }
  function fr(d) { return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

  function chunk(from, to, realtime) {
    var p = new URLSearchParams({
      tempsreel: "true", CSRFToken: csrf, dateDebut: fr(from), dateFin: fr(to), sensOperation: "BOTH",
      montantMin: "", montantMax: "", libelle: "", operationTempsReel: realtime ? "true" : "false", _: String(Date.now()),
    });
    return fetch(location.origin + "/particulier/consultation/compte/" + accountId + "/operation/data?" + p, {
      credentials: "same-origin",
      headers: { accept: "application/json, text/javascript, */*; q=0.01", "x-requested-with": "XMLHttpRequest" },
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (t) {
      var j;
      try { j = JSON.parse(t); } catch (e) { throw new Error("réponse non JSON (session expirée ?)"); }
      if (!Array.isArray(j.aaData)) throw new Error("format inattendu");
      return j.aaData;
    });
  }

  /** since : date ISO de la dernière opération déjà connue de la PFM (null = 12 mois). */
  async function grab(since) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var oldest = new Date(today); oldest.setMonth(oldest.getMonth() - 24);
    var start;
    if (since) start = addDays(new Date(since + "T00:00:00"), -10); // 10 jours de recouvrement pour les opérations « en cours »
    else { start = new Date(today); start.setMonth(start.getMonth() - 12); }
    if (start < oldest) start = oldest;
    var ops = [], end = today, first = true, covered = today;
    while (end >= start) {
      var from = addDays(end, -(CHUNK - 1));
      if (from < start) from = start;
      note("Récupération du " + fr(from) + " au " + fr(end) + "…");
      try { ops = ops.concat(await chunk(from, end, first)); covered = from; }
      catch (e) { if (first) throw e; break; }
      first = false;
      end = addDays(from, -1);
      await new Promise(function (r) { setTimeout(r, 300); });
    }
    return {
      format: "pfm-export", version: 1, bank: "simple", exportedAt: new Date().toISOString(),
      from: iso(covered), to: iso(today),
      operations: ops.map(function (o) {
        return {
          dateOperation: o.dateOperation, dateValeur: o.dateValeur,
          libelleOperation: [o.libelleOperation, o.libelleOperation2, o.libelleOperation3].filter(Boolean).join(" ").trim(),
          montantDebit: o.montantDebit, montantCredit: o.montantCredit,
        };
      }),
    };
  }

  function download(obj) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: "application/json" }));
    a.download = "pfm-simple-" + obj.to + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  var done = false;
  async function fallback() {
    if (done) return; done = true;
    note("Envoi direct impossible : préparation d'un fichier…");
    try {
      var p = await grab(null);
      download(p);
      note("📄 " + p.operations.length + " opérations dans un fichier : importe-le dans ta PFM (bouton Importer).");
    } catch (e) { note("❌ " + e.message); }
  }

  window.addEventListener("message", async function (ev) {
    if (ev.origin !== PFM_ORIGIN || !ev.data) return;
    if (ev.data.type === "pfm-ready" && !done) {
      done = true; clearTimeout(timer);
      try {
        var p = await grab(ev.data.since || null);
        note("Envoi de " + p.operations.length + " opérations à ta PFM…");
        ev.source.postMessage({ type: "pfm-import", payload: p }, PFM_ORIGIN);
      } catch (e) { note("❌ " + e.message); }
    }
    if (ev.data.type === "pfm-imported") {
      note("✅ " + ev.data.msg);
      setTimeout(function () { var d = document.getElementById("pfm-note"); if (d && d.getAttribute("data-run") === RUN) d.remove(); }, 8000);
    }
  });

  var win = window.open(PFM_URL + "?src=attijarinet&t=" + Date.now() + "#operations", "pfm-app");
  var timer = setTimeout(fallback, 15000);
  if (!win) { clearTimeout(timer); fallback(); return; }
  note("Ouverture de ta PFM…");
})();
