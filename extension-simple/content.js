/*
 * PFM Connecteur – Simple (Attijarinet)
 * ------------------------------------------------------------
 * - Tourne uniquement sur attijarinet.attijariwafa.com, dans ta session déjà ouverte.
 * - Ne stocke aucun identifiant, ne contacte aucun autre serveur.
 * - Appelle la même route que la page (operation/data) par tranches de 3 mois
 *   et télécharge un fichier JSON à importer dans l'appli PFM.
 */
(() => {
  "use strict";

  const PAGE_RE = /\/particulier\/consultation\/compte\/([^/?#]+)\/operation/;
  const CHUNK_DAYS = 90;
  const BANK = "simple";

  const match = location.pathname.match(PAGE_RE);
  if (!match) return; // bouton seulement sur la page des opérations
  const accountId = match[1];

  // ---------- utilitaires ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toFr = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

  /** Retrouve le jeton CSRF de la session, sans jamais le stocker ni l'exporter. */
  function findCsrfToken() {
    // 1. champ caché ou meta
    const el = document.querySelector(
      'input[name="CSRFToken"], input[name="csrfToken"], meta[name="CSRFToken"], meta[name="_csrf"]'
    );
    const v = el && (el.value || el.getAttribute("content"));
    if (v) return v;

    // 2. URL d'une requête déjà faite par la page (Resource Timing)
    for (const e of performance.getEntriesByType("resource")) {
      const m = e.name.match(/[?&]CSRFToken=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
    }

    // 3. liens / formulaires / scripts inline
    for (const a of document.querySelectorAll("a[href*='CSRFToken='], form[action*='CSRFToken=']")) {
      const m = (a.getAttribute("href") || a.getAttribute("action")).match(/CSRFToken=([^&"']+)/);
      if (m) return decodeURIComponent(m[1]);
    }
    for (const s of document.querySelectorAll("script:not([src])")) {
      const m = s.textContent.match(/CSRFToken["'\s]*[:=]\s*["']([^"']+)["']/i);
      if (m) return m[1];
    }
    return null;
  }

  async function fetchChunk(token, from, to, realtime) {
    const params = new URLSearchParams({
      tempsreel: "true",
      CSRFToken: token,
      dateDebut: toFr(from),
      dateFin: toFr(to),
      sensOperation: "BOTH",
      montantMin: "",
      montantMax: "",
      libelle: "",
      operationTempsReel: realtime ? "true" : "false",
      _: String(Date.now()),
    });
    const url = `${location.origin}/particulier/consultation/compte/${accountId}/operation/data?${params}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error("Réponse non JSON (session expirée ?)"); }
    if (!Array.isArray(json.aaData)) throw new Error("Format inattendu (aaData absent)");
    return json.aaData;
  }

  async function runExport(months, log) {
    const token = findCsrfToken();
    if (!token) throw new Error("Jeton de session introuvable. Recharge la page des opérations puis réessaie.");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = addMonths(today, -months);
    const operations = [];
    let coveredFrom = today;
    let end = today;
    let first = true;

    while (end >= start) {
      const from = new Date(Math.max(addDays(end, -(CHUNK_DAYS - 1)).getTime(), start.getTime()));
      log(`Récupération du ${toFr(from)} au ${toFr(end)}…`);
      try {
        const rows = await fetchChunk(token, from, end, first);
        operations.push(...rows);
        coveredFrom = from;
        log(`  → ${rows.length} opérations`);
      } catch (err) {
        if (first) throw err;
        log(`  ⚠ arrêt : ${err.message} (la banque limite peut-être l'historique)`);
        break;
      }
      first = false;
      end = addDays(from, -1);
      await new Promise((r) => setTimeout(r, 400)); // rester discret avec le serveur
    }

    // On ne garde que les champs utiles (pas de RIB, pas d'identifiant de compte).
    const clean = operations.map((o) => ({
      dateOperation: o.dateOperation,
      dateValeur: o.dateValeur,
      libelleOperation: [o.libelleOperation, o.libelleOperation2, o.libelleOperation3]
        .filter(Boolean).join(" ").trim(),
      montantDebit: o.montantDebit,
      montantCredit: o.montantCredit,
    }));

    return {
      format: "pfm-export",
      version: 1,
      bank: BANK,
      exportedAt: new Date().toISOString(),
      from: toIso(coveredFrom),
      to: toIso(today),
      operations: clean,
    };
  }

  function download(obj) {
    const blob = new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pfm-${obj.bank}-${obj.to}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- interface (Shadow DOM pour ne pas toucher au style du site) ----------
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      .fab { background:#0b0b0b; color:#fff; border:0; border-radius:999px; padding:12px 18px;
             font-size:14px; font-weight:600; cursor:pointer; box-shadow:0 4px 16px rgba(0,0,0,.25); }
      .fab:hover { background:#2a2a28; }
      .panel { display:none; width:340px; background:#fcfcfb; color:#0b0b0b; border-radius:14px;
               padding:16px; box-shadow:0 8px 32px rgba(0,0,0,.25); margin-bottom:10px; }
      .panel.open { display:block; }
      h3 { margin:0 0 4px; font-size:15px; }
      p { margin:0 0 12px; font-size:12px; color:#52514e; line-height:1.4; }
      label { font-size:13px; display:flex; gap:8px; align-items:center; margin-bottom:12px; }
      select { flex:1; padding:6px; border-radius:8px; border:1px solid #d6d5d0; font-size:13px; }
      .go { width:100%; background:#2a78d6; color:#fff; border:0; border-radius:8px; padding:10px;
            font-size:14px; font-weight:600; cursor:pointer; }
      .go:disabled { opacity:.5; cursor:wait; }
      pre { background:#f0efec; border-radius:8px; padding:8px; font-size:11px; max-height:140px;
            overflow:auto; margin:12px 0 0; white-space:pre-wrap; display:none; }
      pre.show { display:block; }
    </style>
    <div class="panel" part="panel">
      <h3>Exporter vers ma PFM</h3>
      <p>Les opérations sont lues dans ta session ouverte et téléchargées dans un fichier JSON. Rien n'est envoyé ailleurs.</p>
      <label>Période
        <select class="months">
          <option value="3">3 derniers mois</option>
          <option value="6">6 derniers mois</option>
          <option value="12" selected>12 derniers mois</option>
          <option value="24">24 derniers mois</option>
        </select>
      </label>
      <button class="go">Télécharger le fichier</button>
      <pre class="log"></pre>
    </div>
    <button class="fab">⬇ Export PFM</button>
  `;
  document.documentElement.appendChild(host);

  const panel = root.querySelector(".panel");
  const logEl = root.querySelector(".log");
  const go = root.querySelector(".go");
  root.querySelector(".fab").addEventListener("click", () => panel.classList.toggle("open"));

  const log = (msg) => { logEl.classList.add("show"); logEl.textContent += msg + "\n"; logEl.scrollTop = 1e9; };

  go.addEventListener("click", async () => {
    go.disabled = true;
    logEl.textContent = "";
    try {
      const months = Number(root.querySelector(".months").value);
      const data = await runExport(months, log);
      download(data);
      log(`✅ ${data.operations.length} opérations exportées (${data.from} → ${data.to}).`);
      log("Importe le fichier dans l'appli PFM.");
    } catch (err) {
      log(`❌ ${err.message}`);
    } finally {
      go.disabled = false;
    }
  });
})();
