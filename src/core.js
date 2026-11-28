/* PFM – logique métier (sans DOM). Testable sous Node. */
const PFM = (() => {
  "use strict";

  const BANKS = {
    simple: "Simple (AWB)",
    daralamane: "Dar Al Amane",
    autre: "Autre compte",
  };

  // type : income = revenu, expense = dépense, transfer = virement entre mes comptes (exclu)
  const CATEGORIES = [
    { name: "Salaire", type: "income" },
    { name: "Cashback & remboursements", type: "income" },
    { name: "Autres revenus", type: "income" },
    { name: "Transfert interne", type: "transfer" },
    { name: "Daret (épargne)", type: "transfer" },
    { name: "Courses", type: "expense" },
    { name: "Repas au travail", type: "expense" },
    { name: "Restaurants & cafés", type: "expense" },
    { name: "Livraison repas", type: "expense" },
    { name: "Abonnements & digital", type: "expense" },
    { name: "Télécom", type: "expense" },
    { name: "Transport & carburant", type: "expense" },
    { name: "Shopping & vêtements", type: "expense" },
    { name: "Sport", type: "expense" },
    { name: "Voyages & hôtels", type: "expense" },
    { name: "Santé", type: "expense" },
    { name: "Logement", type: "expense" },
    { name: "Retraits espèces", type: "expense" },
    { name: "Virements émis", type: "expense" },
    { name: "Frais bancaires", type: "expense" },
    { name: "Administratif", type: "expense" },
    { name: "Loisirs", type: "expense" },
    { name: "Cadeaux & famille", type: "expense" },
    { name: "Divers", type: "expense" },
    { name: "Non catégorisé", type: "expense" },
  ];
  const CAT_TYPE = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.type]));

  // Règles par défaut : testées dans l'ordre sur le libellé brut (en majuscules).
  const DEFAULT_RULES = [
    [/CASHBACK|REMBOURSEMENT|\bREMB\b|ANNULATION/, "Cashback & remboursements"],
    [/SALAIRE|\bPAIE\b|VIREMENT DE SALAIRE/, "Salaire"],
    [/AWBGAB|RETRAIT|\bGAB\b|\bDAB\b/, "Retraits espèces"],
    [/^VIR(EMENT)?\.? ?EMIS/, "Virements émis"],
    [/AWB YAM/, "Repas au travail"],
    [/GLOVO|JUMIA FOOD|KOOL FOOD/, "Livraison repas"],
    [/MARJANE|CARREFOUR|SUPECO|\bBIM\b|ACIMA|LABEL ?VIE|ASWAK|ATACADAO|KAZYON/, "Courses"],
    [/MCDO|MC ?DONALD|SHAWARMA|CUCINA|PIZZ|BURGER|\bKFC\b|CAFE|COFFEE|STARBUCKS|FRESH BOL|SMOOTHIE|ADHAM CHEF|CTR FOOD|RESTAU|SUSHI|TACOS|\bPAUL\b/, "Restaurants & cafés"],
    [/NETFLIX|SPOTIFY|APPLE\.COM|ANTHROPIC|CLAUDE|GOOGLE|CLEENG|YOUTUBE|DISNEY|SHAHID|\bOSN\b|OPENAI|CHATGPT|AMAZON PRIME|MICROSOFT/, "Abonnements & digital"],
    [/\bIAM\b|INWI|ORANGE|MAROC TELECOM/, "Télécom"],
    [/CIRCLE K|AFRIQUIA|SHELL|TOTAL ?ENERGIES|WINXO|PETROM|OLA ENERGY|AUTOROUTE|TAXI|YASSIR|CAREEM|UBER|INDRIVE|ONCF|PARKING|STATION/, "Transport & carburant"],
    [/PLANET SPORT|DECATHLON|GO SPORT|CITY CLUB|FITNESS|\bGYM\b/, "Sport"],
    [/LEFTIES|KOTON|ZARA|H&M|LC WAIKIKI|DEFACTO|BERSHKA|PULL ?& ?BEAR|MANGO|MASSIMO|PRIMARK/, "Shopping & vêtements"],
    [/BOOKING|RESA NUITEE|AIRBNB|ROYAL AIR|RYANAIR|AIR ARABIA|HOTEL|ATTIJARI TRAVEL|EXPEDIA/, "Voyages & hôtels"],
    [/PHCIE|PHARMA|CLINIQUE|\bLABO|DOCTEUR|MEDECIN/, "Santé"],
    [/WRAQI|IMPOTS|\bTGR\b|\bDGI\b|ANCFCC|TIMBRE/, "Administratif"],
    [/FRAIS|COMMISSION|COTISATION|AGIOS|TENUE DE COMPTE/, "Frais bancaires"],
  ];

  const DEFAULT_SETTINGS = {
    ownerNames: [],              // virements reçus/émis à ces noms = transfert interne (à renseigner dans ⚙)
    cycleStartDay: 1,            // 1 = mois calendaire ; 25 = de salaire à salaire, etc.
    dateBasis: "tx",             // "tx" = date réelle d'achat (libellé) ; "booking" = date de comptabilisation
    trackingStart: "2026-11-01", // suivi à partir de la période budgétaire qui contient cette date ("" = tout)
    budgets: null,               // null = proposition par défaut ; sinon { catégorie: montant mensuel }
    savingsGoal: { min: 7000, target: 10000 },
    catView: "bars",
  };

  // Budgets proposés (MAD / mois), calibrés sur les dépenses observées pour viser l'objectif d'épargne mensuel.
  const PROPOSED_BUDGETS = {
    "Logement": 3520, "Retraits espèces": 2000, "Repas au travail": 1000, "Courses": 2000,
    "Shopping & vêtements": 800, "Abonnements & digital": 700, "Livraison repas": 600,
    "Restaurants & cafés": 600, "Sport": 600, "Cadeaux & famille": 500, "Télécom": 400,
    "Transport & carburant": 400, "Loisirs": 400, "Santé": 300, "Divers": 300,
    "Administratif": 100, "Frais bancaires": 20,
  };

  const ICONS = {
    "Salaire": "💼", "Cashback & remboursements": "🎁", "Autres revenus": "💰", "Transfert interne": "🔁",
    "Daret (épargne)": "🤝", "Courses": "🛒", "Repas au travail": "🥪", "Restaurants & cafés": "🍽️",
    "Livraison repas": "🛵", "Abonnements & digital": "📺", "Télécom": "📱", "Transport & carburant": "⛽",
    "Shopping & vêtements": "🛍️", "Sport": "🏋️", "Voyages & hôtels": "✈️", "Santé": "💊", "Logement": "🏠",
    "Retraits espèces": "🏧", "Virements émis": "💸", "Frais bancaires": "🏦", "Administratif": "📄",
    "Loisirs": "🎮", "Cadeaux & famille": "💝", "Divers": "📦", "Non catégorisé": "❔",
  };

  // ---------- utilitaires ----------
  const pad = (n) => String(n).padStart(2, "0");
  const norm = (s) => String(s || "").toUpperCase().replace(/\s+/g, " ").trim();

  function hash(str) {
    // FNV-1a 32 bits, deux passes pour réduire les collisions
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ c, 2246822519);
    }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
  }

  function toNumber(v) {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return v;
    return Number(String(v).replace(/\s/g, "").replace(",", ".")) || 0;
  }

  /** Année à 4 chiffres pour une date jj/mm sans année, déduite de la date de comptabilisation. */
  function inferYear(day, month, bookingIso) {
    const by = Number(bookingIso.slice(0, 4));
    const bm = Number(bookingIso.slice(5, 7));
    return month > bm + 1 ? by - 1 : by; // achat en décembre comptabilisé en janvier
  }

  /** Analyse un libellé Attijarinet → date réelle, marchand lisible, statut en cours. */
  function parseLabel(rawLabel, bookingIso) {
    let label = String(rawLabel || "").trim();
    const pending = /\(\*\)\s*$/.test(label);
    label = label.replace(/\(\*\)\s*$/, "").trim();
    let txDate = bookingIso;
    let merchant = label;
    let m;

    if ((m = label.match(/^PAIEMENT CB\s+(\d{2})[\/ ](\d{2})[\/ ](\d{2})\s+(.*)$/i))) {
      txDate = `20${m[3]}-${m[2]}-${m[1]}`;
      merchant = m[4];
    } else if ((m = label.match(/^AWBGAB\s+(.+?)\s+(\d{2})\/(\d{2})\s+\d{2}H\d{2}$/i))) {
      const y = inferYear(Number(m[2]), Number(m[3]), bookingIso);
      txDate = `${y}-${m[3]}-${m[2]}`;
      merchant = `Retrait GAB ${m[1].trim()}`;
    } else if ((m = label.match(/^(?:VIREMENT|VIR\.?(?: INST)?)\s+RECU DE\s+(.+)$/i))) {
      merchant = `Virement de ${m[1].trim()}`;
    } else if ((m = label.match(/^VIR(?:EMENT)?\.? ?EMIS(?: WEB)?\s+VERS\s+(.+)$/i))) {
      merchant = `Virement vers ${m[1].trim()}`;
    } else if ((m = label.match(/^PAIEMENT\s+(RESA NUITEE)/i))) {
      merchant = "Réservation nuitée";
    } else if ((m = label.match(/^TOD\.\s*(.+)$/i))) {
      merchant = m[1];
    }

    // retire les références techniques finales (ex. « Spotify P4842E78E2 »)
    merchant = merchant.replace(/\s+[A-Z]?[0-9A-F]{8,}$/i, "").replace(/\*+/g, " ").replace(/\s+/g, " ").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate) || isNaN(Date.parse(txDate))) txDate = bookingIso;
    return { txDate, merchant, merchantKey: norm(merchant), pending };
  }

  /** Accepte un export de l'extension, la réponse brute {aaData}, ou un tableau d'opérations. */
  function readImport(json, fallbackBank) {
    let obj = typeof json === "string" ? JSON.parse(json) : json;
    let bank = fallbackBank;
    let ops;
    if (Array.isArray(obj)) ops = obj;
    else if (obj && obj.format === "pfm-export") { ops = obj.operations; bank = obj.bank || bank; }
    else if (obj && Array.isArray(obj.aaData)) ops = obj.aaData;
    else if (obj && obj.format === "pfm-backup") return { backup: obj };
    else throw new Error("Format non reconnu : il faut l'export de l'extension ou la réponse operation/data.");
    if (!BANKS[bank]) throw new Error(`Banque inconnue : ${bank}`);
    return { bank, transactions: normalize(ops, bank) };
  }

  function normalize(rawOps, bank) {
    const seen = new Map();
    return rawOps
      .filter((o) => o && o.dateOperation)
      .map((o) => {
        const date = String(o.dateOperation).slice(0, 10);
        const label = [o.libelleOperation, o.libelleOperation2, o.libelleOperation3].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
        const amount = Math.round((toNumber(o.montantCredit) - toNumber(o.montantDebit)) * 100) / 100;
        const base = `${bank}|${date}|${norm(label)}|${amount}`;
        const n = (seen.get(base) || 0) + 1; // deux opérations identiques le même jour restent distinctes
        seen.set(base, n);
        const p = parseLabel(label, date);
        return {
          id: hash(`${base}|${n}`),
          bank,
          date,
          valueDate: o.dateValeur ? String(o.dateValeur).slice(0, 10) : date,
          txDate: p.txDate,
          label,
          merchant: p.merchant,
          merchantKey: p.merchantKey,
          amount,
          pending: p.pending,
        };
      });
  }

  /** Fusionne un import dans l'état : dédoublonne, remplace les opérations « en cours ». */
  function merge(state, bank, incoming) {
    if (!incoming.length) return { added: 0, duplicates: 0, replacedPending: 0 };
    const minDate = incoming.reduce((m, t) => (t.date < m ? t.date : m), incoming[0].date);
    const before = state.transactions.length;
    // les opérations en cours de cette banque, couvertes par l'import, sont remplacées
    state.transactions = state.transactions.filter((t) => !(t.bank === bank && t.pending && t.date >= minDate));
    const replacedPending = before - state.transactions.length;
    const ids = new Set(state.transactions.map((t) => t.id));
    let added = 0, duplicates = 0;
    for (const t of incoming) {
      if (ids.has(t.id)) { duplicates++; continue; }
      ids.add(t.id);
      state.transactions.push(t);
      added++;
    }
    state.transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return { added, duplicates, replacedPending };
  }

  /** Catégorie d'une opération : manuel > règle apprise > nom du titulaire > règles par défaut > repli. */
  function categorize(t, state) {
    if (state.overrides[t.id]) return { category: state.overrides[t.id], source: "manuel" };
    if (t.fixedCategory) return { category: t.fixedCategory, source: t.recurringId ? "récurrent" : "saisie" };
    if (state.rules[t.merchantKey]) return { category: state.rules[t.merchantKey], source: "règle" };
    const L = norm(t.label);
    const owners = (state.settings.ownerNames || []).map(norm).filter(Boolean);
    if (/^VIR|VIREMENT/.test(L) && owners.some((o) => L.includes(o))) return { category: "Transfert interne", source: "auto" };
    for (const [re, cat] of DEFAULT_RULES) if (re.test(L)) return { category: cat, source: "auto" };
    return { category: t.amount > 0 ? "Autres revenus" : "Non catégorisé", source: "auto" };
  }

  function periodKey(iso, startDay) {
    let y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
    const d = Number(iso.slice(8, 10));
    if (startDay > 1 && d < startDay) { m -= 1; if (m === 0) { m = 12; y -= 1; } }
    return `${y}-${pad(m)}`;
  }

  function periodLabel(key, startDay, long) {
    const [y, m] = key.split("-").map(Number);
    const fmt = new Intl.DateTimeFormat("fr-FR", { month: long ? "long" : "short", year: "numeric" });
    const base = fmt.format(new Date(y, m - 1, 1));
    if (startDay <= 1 || !long) return base;
    const end = new Date(y, m, startDay - 1);
    return `${startDay}/${pad(m)} → ${end.getDate()}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
  }

  /** Génère les occurrences des opérations récurrentes jusqu'à aujourd'hui. */
  function materializeRecurring(state, todayIso, untilIso) {
    const today = todayIso || new Date().toISOString().slice(0, 10);
    const until = untilIso || today; // au-delà d'aujourd'hui : occurrences « prévues »
    const out = [];
    for (const r of state.recurring || []) {
      let [y, m] = r.start.split("-").map(Number);
      for (let guard = 0; guard < 240; guard++) {
        const key = `${y}-${pad(m)}`;
        if (r.end && key > r.end) break;
        const last = new Date(y, m, 0).getDate();
        const date = `${key}-${pad(Math.min(r.day, last))}`;
        if (date > until) break;
        out.push({
          planned: date > today,
          id: "r" + hash(`${r.id}|${key}`), bank: r.bank, date, valueDate: date, txDate: date,
          label: r.label, merchant: r.label, merchantKey: norm(r.label), amount: r.amount,
          pending: false, manual: true, recurringId: r.id, fixedCategory: r.category,
        });
        m++; if (m === 13) { m = 1; y++; }
      }
    }
    return out;
  }

  function allTransactions(state) {
    return [...state.transactions, ...materializeRecurring(state)];
  }

  /** Occurrences récurrentes à venir, d'après-demain… jusqu'à untilIso inclus. */
  function plannedTransactions(state, untilIso, todayIso) {
    return materializeRecurring(state, todayIso, untilIso).filter((t) => t.planned);
  }

  /** Bornes (ISO) d'une période budgétaire. */
  function periodBounds(key, startDay) {
    const [y, m] = key.split("-").map(Number);
    const sd = Math.max(1, Number(startDay) || 1);
    const start = new Date(Date.UTC(y, m - 1, sd));
    const end = new Date(Date.UTC(y, m, sd - 1)); // veille du début de la période suivante
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  /** Date (ISO) à partir de laquelle les opérations sont prises en compte. */
  function trackingCutoff(settings) {
    if (!settings.trackingStart) return "";
    const sd = Number(settings.cycleStartDay) || 1;
    return periodBounds(periodKey(settings.trackingStart, sd), sd).start;
  }

  /** Enrichit chaque opération (catégorie, type, période) selon les réglages courants. */
  function enrich(state, list) {
    const sd = Number(state.settings.cycleStartDay) || 1;
    const cutoff = trackingCutoff(state.settings);
    return (list || allTransactions(state)).map((t) => {
      const c = categorize(t, state);
      const d = state.settings.dateBasis === "booking" ? t.date : t.txDate;
      return { ...t, category: c.category, catSource: c.source, type: CAT_TYPE[c.category] || "expense", period: periodKey(d, sd), refDate: d };
    }).filter((t) => !cutoff || t.refDate >= cutoff);
  }

  /** Indicateurs d'une liste d'opérations enrichies. */
  function summarize(list) {
    let income = 0, expense = 0, transferIn = 0, transferOut = 0, net = 0, daretOut = 0, daretIn = 0;
    const byCat = {}, byMerchant = {};
    for (const t of list) {
      net += t.amount;
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") {
        expense += -t.amount; // un remboursement classé en dépense réduit la dépense
        byCat[t.category] = (byCat[t.category] || 0) + -t.amount;
        const k = t.merchant || t.label;
        const bm = (byMerchant[k] = byMerchant[k] || { merchant: k, total: 0, count: 0, category: t.category });
        bm.total += -t.amount; bm.count++;
      } else if (t.category === "Daret (épargne)") { if (t.amount < 0) daretOut += -t.amount; else daretIn += t.amount; }
      else if (t.amount > 0) transferIn += t.amount; else transferOut += -t.amount;
    }
    const r2 = (x) => Math.round(x * 100) / 100;
    const savings = income - expense;
    return {
      income: r2(income), expense: r2(expense), savings: r2(savings),
      savingsRate: income > 0 ? savings / income : null,
      transferIn: r2(transferIn), transferOut: r2(transferOut), net: r2(net), daretOut: r2(daretOut), daretIn: r2(daretIn),
      byCategory: Object.entries(byCat).map(([category, total]) => ({ category, total: r2(total) }))
        .filter((x) => Math.abs(x.total) >= 0.005).sort((a, b) => b.total - a.total),
      topMerchants: Object.values(byMerchant).map((x) => ({ ...x, total: r2(x.total) })).sort((a, b) => b.total - a.total),
      count: list.length,
    };
  }

  // ---------- synchronisation : horodatage, fusion, chiffrement ----------

  /** Instantané comparable de l'état (pour détecter ce qui a changé entre deux enregistrements). */
  function snapshot(state) {
    const snap = {};
    for (const t of state.transactions) snap["tx:" + t.id] = "1";
    for (const [k, v] of Object.entries(state.rules)) snap["rule:" + k] = v;
    for (const [k, v] of Object.entries(state.overrides)) snap["ov:" + k] = v;
    for (const r of state.recurring || []) snap["rec:" + r.id] = JSON.stringify(r);
    snap.settings = JSON.stringify(state.settings);
    return snap;
  }

  /** Horodate ce qui a été ajouté/modifié, et marque comme supprimé ce qui a disparu. */
  function stamp(state, prevSnap, now) {
    const cur = snapshot(state);
    state.ts = state.ts || {}; state.deleted = state.deleted || {};
    for (const [k, v] of Object.entries(cur)) if (prevSnap[k] !== v) { state.ts[k] = now; delete state.deleted[k]; }
    for (const k of Object.keys(prevSnap)) if (!(k in cur)) state.deleted[k] = now;
    return cur;
  }

  /** Fusionne deux états : opération par opération, la modification la plus récente l'emporte. */
  function mergeStates(a, b) {
    const ta = a.ts || {}, tb = b.ts || {};
    const del = { ...(a.deleted || {}) };
    for (const [k, v] of Object.entries(b.deleted || {})) del[k] = Math.max(del[k] || 0, v);
    const ts = { ...ta };
    for (const [k, v] of Object.entries(tb)) ts[k] = Math.max(ts[k] || 0, v);
    const alive = (k) => !(del[k] && del[k] >= (ts[k] || 0));
    const pick = (k, va, vb) => (va === undefined ? vb : vb === undefined ? va : (tb[k] || 0) > (ta[k] || 0) ? vb : va);

    const txs = new Map();
    for (const t of b.transactions || []) txs.set(t.id, t);
    for (const t of a.transactions || []) txs.set(t.id, t);
    const transactions = [...txs.values()].filter((t) => alive("tx:" + t.id))
      .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));

    const mapMerge = (ma, mb, prefix) => {
      const out = {};
      for (const k of new Set([...Object.keys(ma || {}), ...Object.keys(mb || {})])) {
        const v = pick(prefix + k, (ma || {})[k], (mb || {})[k]);
        if (v !== undefined && alive(prefix + k)) out[k] = v;
      }
      return out;
    };
    const ra = Object.fromEntries((a.recurring || []).map((r) => [r.id, r]));
    const rb = Object.fromEntries((b.recurring || []).map((r) => [r.id, r]));
    const recurring = Object.values(mapMerge(ra, rb, "rec:"));
    const settings = (tb.settings || 0) > (ta.settings || 0) ? { ...DEFAULT_SETTINGS, ...b.settings } : { ...DEFAULT_SETTINGS, ...a.settings };

    // purge des marques de suppression de plus de 400 jours
    const limit = Date.now() - 400 * 86400000;
    for (const k of Object.keys(del)) if (del[k] < limit) delete del[k];

    return { version: 1, transactions, recurring, rules: mapMerge(a.rules, b.rules, "rule:"), overrides: mapMerge(a.overrides, b.overrides, "ov:"), settings, ts, deleted: del };
  }

  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  const subtle = () => globalThis.crypto.subtle;

  async function deriveKey(passphrase, saltB64) {
    const base = await subtle().importKey("raw", new TextEncoder().encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey({ name: "PBKDF2", salt: unb64(saltB64), iterations: 310000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  function newSalt() { return b64(globalThis.crypto.getRandomValues(new Uint8Array(16))); }

  async function encryptVault(key, saltB64, obj) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    return { format: "pfm-vault", v: 1, kdf: "PBKDF2-SHA256-310000", salt: saltB64, iv: b64(iv), ct: b64(ct), updatedAt: new Date().toISOString() };
  }
  async function decryptVault(key, vault) {
    if (!vault || vault.format !== "pfm-vault") throw new Error("Fichier de synchronisation invalide.");
    let pt;
    try { pt = await subtle().decrypt({ name: "AES-GCM", iv: unb64(vault.iv) }, key, unb64(vault.ct)); }
    catch { throw new Error("Phrase secrète incorrecte."); }
    return JSON.parse(new TextDecoder().decode(pt));
  }

  function emptyState() {
    return { version: 1, transactions: [], recurring: [], rules: {}, overrides: {}, settings: { ...DEFAULT_SETTINGS }, ts: {}, deleted: {} };
  }

  return { BANKS, CATEGORIES, CAT_TYPE, DEFAULT_SETTINGS, PROPOSED_BUDGETS, ICONS, hash, materializeRecurring, allTransactions, plannedTransactions, periodBounds, trackingCutoff, snapshot, stamp, mergeStates, deriveKey, newSalt, encryptVault, decryptVault, parseLabel, readImport, normalize, merge, categorize, enrich, summarize, periodKey, periodLabel, emptyState, norm };
})();
if (typeof module !== "undefined") module.exports = PFM;
