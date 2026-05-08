// ============================================================
// 🍷 Fouquet’s Joy — Gold Motion v17.5
// Frontend double backend : application + inventaire intelligent
// Les deux inventaires se remplissent en même temps.
// ============================================================

// ============================================================
// CONFIG — À REMPLACER
// ============================================================

// Backend principal de l'application Fouquet’s Joy
const APP_API_URL = "https://script.google.com/macros/s/AKfycbxqh8yvag7cBGZ34zza181fpWV2TssYeQIIqUEd5ZI91knMY5jSK6sUP0QDEULfh12a/exec";

// Backend inventaire intelligent / SAS Axel
const INV_API_URL = "https://script.google.com/macros/s/AKfycbyH-HOgwqbc7yNIAzPZL-fY4ZJ1_HAzPhBp83w_QkoOztWylPHDt_537jRxDkucQ2lAKw/exec";

// Si tu utilises le Code.gs v17.4 multi-classeurs dans un seul Apps Script,
// mets la même URL dans les deux lignes ci-dessus.

// Actions qui partent vers le backend inventaire intelligent.
const INVENTORY_ACTIONS = new Set([
  "inventorySmartInit",
  "inventorySmartSearch",
  "inventorySmartSubmit",
  "inventorySmartBulkImport",
  "inventorySmartApplyValidation",
  "setupMultiClasseurs"
]);

// ============================================================
// HELPERS GÉNÉRAUX
// ============================================================

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];

function serialize(params) {
  const u = new URLSearchParams();

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) {
      u.append(k, "");
    } else {
      u.append(k, String(v));
    }
  });

  return u.toString();
}

function getApiUrlForAction(action) {
  return INVENTORY_ACTIONS.has(action) ? INV_API_URL : APP_API_URL;
}

async function api(action, params = {}) {
  const baseUrl = getApiUrlForAction(action);

  if (!baseUrl || baseUrl.includes("COLLE_ICI")) {
    return {
      status: "error",
      ok: false,
      message: `URL API manquante pour l’action : ${action}`
    };
  }

  const url = `${baseUrl}?${serialize({ action, ...params })}`;

  try {
    const r = await fetch(url, {
      method: "GET",
      cache: "no-store"
    });

    if (!r.ok) throw new Error("HTTP " + r.status);

    return await r.json();
  } catch (e) {
    console.error("Erreur API", action, e);

    return {
      status: "error",
      ok: false,
      message: e.message || String(e)
    };
  }
}

async function apiPost(action, body = {}) {
  const baseUrl = getApiUrlForAction(action);

  if (!baseUrl || baseUrl.includes("COLLE_ICI")) {
    return {
      status: "error",
      ok: false,
      message: `URL API manquante pour l’action : ${action}`
    };
  }

  try {
    const r = await fetch(`${baseUrl}?action=${encodeURIComponent(action)}`, {
      method: "POST",
      cache: "no-store",
      body: JSON.stringify(body)
    });

    if (!r.ok) throw new Error("HTTP " + r.status);

    return await r.json();
  } catch (e) {
    console.error("Erreur API POST", action, e);

    return {
      status: "error",
      ok: false,
      message: e.message || String(e)
    };
  }
}

function isOk(res) {
  return !!res && (res.ok === true || res.status === "success");
}

function setBadge(state) {
  const b = qs("#syncBadge");
  if (!b) return;

  b.textContent = state === "online" ? "En ligne" : state === "error" ? "Erreur" : "Hors ligne";
  b.classList.toggle("offline", state !== "online");
  b.classList.toggle("online", state === "online");
  b.classList.toggle("error", state === "error");
}

const toNum = v => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function debounce(fn, delay = 300) {
  let timer;

  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ============================================================
// NAVIGATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  qsa(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      qsa(".tab").forEach(b => b.classList.toggle("active", b === btn));
      render(btn.dataset.view);
    });
  });

  const syncBtn = qs("#btnSync");
  if (syncBtn) syncBtn.addEventListener("click", checkConnection);

  render("dashboard");
  checkConnection();
});

async function checkConnection() {
  const app = await api("ping");
  const inv = await api("inventorySmartInit");

  if (isOk(app) && isOk(inv)) {
    setBadge("online");
  } else {
    setBadge("error");
  }
}

async function render(view) {
  const tpl = qs(`#tpl-${view}`);
  const app = qs("#app");

  app.innerHTML = tpl
    ? tpl.innerHTML
    : `<section class="section"><div class="card">Vue indisponible</div></section>`;

  if (view === "dashboard") await mountDashboard();
  if (view === "pertes") await mountPertes();
  if (view === "invj") await mountInvJ();
  if (view === "invm") await mountInvM();
  if (view === "recettes") await mountRecettes();
  if (view === "settings") mountSettings();
}

// ============================================================
// DASHBOARD
// ============================================================

async function mountDashboard() {
  try {
    const etat = await api("getEtatStock");

    if (isOk(etat)) {
      qs("#kpiStock").textContent = `€ ${(etat.valeurTotale || 0).toLocaleString("fr-FR")}`;
      qs("#kpiStockQte").textContent = `${(etat.quantiteTotale || 0).toLocaleString("fr-FR")} unités`;
    }
  } catch (e) {
    console.warn("Etat stock", e);
  }

  try {
    const pertes = await api("getPertesPoids");

    if (isOk(pertes)) {
      qs("#kpiPertes").textContent = `${Number(pertes.pertesKg || 0).toFixed(2)} kg`;
    }
  } catch (e) {
    console.warn("Pertes", e);
  }

  try {
    const detail = await api("getStockDetail");
    const tbody = qs("#tableStockDetail tbody");
    if (!tbody) return;

    const stockList = detail.stock || detail || [];
    tbody.innerHTML = "";

    (Array.isArray(stockList) ? stockList : []).forEach(it => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escapeHtml(it.produit || "")}</td>
        <td style="text-align:right">${Number(it.quantite || 0).toFixed(3)}</td>
        <td>${escapeHtml(it.unite || "")}</td>
        <td style="text-align:right">${Number(it.prix || 0).toFixed(2)}</td>
        <td style="text-align:right">${Number(it.valeur || 0).toFixed(2)}</td>
        <td>${escapeHtml(it.zone || "")}</td>
      `;

      tbody.appendChild(tr);
    });
  } catch (e) {
    console.warn("Stock detail", e);
  }

  qs("#kpiSeuils").textContent = "0";

  await mountPertesChart();
}

async function mountPertesChart() {
  const ctx = qs("#chartPertes");
  const legendContainer = qs("#pertesLegend");
  const toggle = qs("#togglePareto");

  if (!ctx || !window.Chart) return;

  let chart;

  const renderSimple = () => {
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
        datasets: [{
          label: "Pertes kg",
          data: [0, 0, 0, 0, 0, 0, 0]
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    if (legendContainer) legendContainer.innerHTML = "";
  };

  const renderPareto = async () => {
    if (chart) chart.destroy();

    const res = await api("getPertesParProduit");

    if (!isOk(res)) {
      renderSimple();
      return;
    }

    const pertes = res.pertes || [];

    if (!pertes.length) {
      renderSimple();
      if (legendContainer) legendContainer.innerHTML = `<div class="muted">Aucune perte enregistrée.</div>`;
      return;
    }

    const total = pertes.reduce((sum, p) => sum + Number(p.qte || 0), 0);
    const top = pertes.slice(0, 10);
    const labels = top.map(p => p.produit);
    const dataVals = top.map(p => Number(p.qte || 0));

    let cumul = 0;
    const cumulPct = dataVals.map(v => {
      cumul += v;
      return total ? Number((cumul / total * 100).toFixed(1)) : 0;
    });

    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Pertes kg",
            data: dataVals,
            yAxisID: "y",
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: "Cumul %",
            data: cumulPct,
            type: "line",
            yAxisID: "y1",
            tension: 0.3
          }
        ]
      },
      options: {
        plugins: {
          legend: { position: "bottom" },
          title: { display: true, text: "Pareto des pertes" }
        },
        scales: {
          y: {
            beginAtZero: true
          },
          y1: {
            beginAtZero: true,
            position: "right",
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: { callback: v => v + "%" }
          }
        }
      }
    });

    if (legendContainer) {
      legendContainer.innerHTML = `
        <div class="card" style="margin-top:1rem">
          ${top.map((p, i) => {
            const pct = total ? ((p.qte / total) * 100).toFixed(1) : "0.0";
            return `
              <div style="display:flex;justify-content:space-between;gap:12px;">
                <span>${i + 1}. ${escapeHtml(p.produit)}</span>
                <span><b>${Number(p.qte || 0).toFixed(2)} kg</b> <small>(${pct}%)</small></span>
              </div>
            `;
          }).join("")}
          <hr>
          <div style="text-align:right;font-weight:bold;">Total : ${total.toFixed(2)} kg</div>
        </div>
      `;
    }
  };

  if (toggle) {
    toggle.checked = true;
    toggle.onchange = () => toggle.checked ? renderPareto() : renderSimple();
    await renderPareto();
  } else {
    renderSimple();
  }
}

// ============================================================
// PRODUITS
// ============================================================

async function preloadProduits(datalistId) {
  try {
    const d = await api("getProduitsEtUnites");
    const dl = qs(`#${datalistId}`);
    if (!dl) return;

    const produits = d.produits || d.stock || [];

    dl.innerHTML = produits
      .map(p => `<option value="${escapeHtml(p.produit || p.article || "")}">`)
      .join("");
  } catch (e) {
    console.warn("Préchargement produits", e);
  }
}

// ============================================================
// PERTES
// ============================================================

async function mountPertes() {
  await preloadProduits("dlProduitsPertes");

  qs("#btnSavePerte").addEventListener("click", async () => {
    const payload = {
      produit: qs("#pertesProduit").value.trim(),
      qte: qs("#pertesQte").value,
      unite: qs("#pertesUnite").value.trim(),
      motif: qs("#pertesMotif").value.trim(),
      comment: qs("#pertesComment").value.trim()
    };

    if (!payload.produit || !payload.qte) {
      alert("Produit + quantité requis.");
      return;
    }

    const res = await api("pertesAdd", payload);

    alert(isOk(res) ? "✅ Perte enregistrée" : "❌ " + (res.message || "Erreur"));

    if (isOk(res)) {
      ["pertesProduit", "pertesQte", "pertesUnite", "pertesMotif", "pertesComment"]
        .forEach(id => qs("#" + id).value = "");
    }
  });

  qs("#btnResetPerte").addEventListener("click", () => {
    ["pertesProduit", "pertesQte", "pertesUnite", "pertesMotif", "pertesComment"]
      .forEach(id => qs("#" + id).value = "");
  });
}

// ============================================================
// INVENTAIRE JOURNALIER
// ============================================================

let produitsUnites = [];

async function mountInvJ() {
  try {
    const d = await api("getProduitsEtUnites");
    produitsUnites = isOk(d) ? (d.produits || []) : [];

    const dl = qs("#dlProduitsInvJ");

    if (dl) {
      dl.innerHTML = produitsUnites
        .map(p => `<option value="${escapeHtml(p.produit || "")}">`)
        .join("");
    }
  } catch (e) {
    console.warn("Produits non chargés", e);
  }

  const inputProduit = qs("#invjProduit");
  const inputUnite = qs("#invjUnite");

  if (inputProduit) {
    inputProduit.addEventListener("input", () => {
      const val = inputProduit.value.trim().toLowerCase();

      const found = produitsUnites.find(p =>
        String(p.produit || "").trim().toLowerCase() === val
      );

      if (found) {
        inputUnite.value = found.unite || "";
        inputUnite.setAttribute("readonly", "readonly");
        inputUnite.classList.add("locked");
      } else {
        inputUnite.value = "";
        inputUnite.removeAttribute("readonly");
        inputUnite.classList.remove("locked");
      }
    });
  }

  qs("#btnInvJEntree").addEventListener("click", () => handleInvJ("entree"));
  qs("#btnInvJSortie").addEventListener("click", () => handleInvJ("sortie"));

  qs("#btnResetInvJ").addEventListener("click", () => {
    ["invjProduit", "invjQte", "invjUnite"].forEach(id => qs("#" + id).value = "");
    qs("#invjUnite").removeAttribute("readonly");
    qs("#invjUnite").classList.remove("locked");
  });
}

async function handleInvJ(type) {
  const produit = qs("#invjProduit").value.trim();
  const qte = qs("#invjQte").value;
  const unite = qs("#invjUnite").value.trim();

  if (!produit || !qte) {
    alert("Veuillez remplir le produit et la quantité.");
    return;
  }

  const res = await api("inventaireJournalier", {
    produit,
    qte,
    unite,
    type
  });

  alert(isOk(res)
    ? `✅ ${type === "entree" ? "Entrée" : "Sortie"} enregistrée`
    : "❌ " + (res.message || "Erreur")
  );

  if (isOk(res)) {
    ["invjProduit", "invjQte", "invjUnite"].forEach(id => qs("#" + id).value = "");
    qs("#invjUnite").removeAttribute("readonly");
    qs("#invjUnite").classList.remove("locked");
  }
}

// ============================================================
// INVENTAIRE MENSUEL
// ============================================================

async function mountInvM() {
  const zoneSelect = qs("#invmZone");
  const moisInput = qs("#invmMois");

  moisInput.value = currentMonth();

  let zones = [];

  try {
    const z = await api("zonesList");
    zones = isOk(z) ? (z.zones || []) : [];
  } catch {
    zones = [];
  }

  if (!zones.length) {
    zones = [
      "Petit déjeuner",
      "Garde-manger",
      "Entremets",
      "Poisson",
      "Viande",
      "Surgelés",
      "Économat",
      "Pâtisserie",
      "Boulangerie",
      "Production cuisine"
    ];
  }

  zoneSelect.innerHTML = zones
    .map(z => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`)
    .join("");

  try {
    const d = await api("getProduitsEtUnites");
    const produits = isOk(d) ? (d.produits || []) : [];
    const dl = qs("#dlProduitsInvM");

    dl.innerHTML = produits
      .map(p => `<option value="${escapeHtml(p.produit || "")}">`)
      .join("");
  } catch (e) {
    console.warn("Produits inventaire mensuel", e);
  }

  const tbody = qs("#invTable tbody");

  function addRow(p = "", q = "", u = "", c = "") {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input list="dlProduitsInvM" value="${escapeHtml(p)}" placeholder="Produit"></td>
      <td><input type="number" step="0.001" value="${escapeHtml(q)}" placeholder="0.000"></td>
      <td><input value="${escapeHtml(u)}" placeholder="KG / L / PCS"></td>
      <td><input value="${escapeHtml(c)}" placeholder="Commentaire"></td>
      <td><button class="btn danger small" type="button">✖</button></td>
    `;

    tr.querySelector("button").addEventListener("click", () => tr.remove());
    tbody.appendChild(tr);
  }

  addRow();

  qs("#btnAddRow").addEventListener("click", () => addRow());

  qs("#btnGenSheet").addEventListener("click", async () => {
    const res = await api("createInventaireMensuel", {
      zone: zoneSelect.value,
      mois: moisInput.value
    });

    alert(isOk(res) ? "✅ Feuille générée" : "❌ " + (res.message || "Erreur"));
  });

  qs("#btnSaveInv").addEventListener("click", async () => {
    const lignes = [];

    qsa("#invTable tbody tr").forEach(tr => {
      const inputs = qsa("input", tr);
      const p = inputs[0].value.trim();
      const q = inputs[1].value;
      const u = inputs[2].value.trim();
      const c = inputs[3].value.trim();

      if (p && q) {
        lignes.push({
          produit: p,
          qte: q,
          unite: u,
          comment: c
        });
      }
    });

    if (!lignes.length) {
      alert("Aucune ligne saisie.");
      return;
    }

    const res = await saveClassicInventoryBatch(lignes);

    alert(isOk(res)
      ? "✅ Inventaire classique enregistré"
      : "❌ " + (res.message || "Erreur")
    );

    if (isOk(res)) {
      tbody.innerHTML = "";
      addRow();
    }
  });

  mountInventorySmart();
}

async function saveClassicInventoryBatch(lignes) {
  return await apiPost("saveInventaireMensuelBatch", {
    zone: qs("#invmZone").value,
    mois: qs("#invmMois").value,
    lignes: lignes
  });
}

// ============================================================
// INVENTAIRE INTELLIGENT — REMPLIT LES 2 INVENTAIRES
// ============================================================

let smartSelectedCle = "";

function mountInventorySmart() {
  const articleInput = qs("#smartArticle");
  const qteInput = qs("#smartQte");
  const uniteInput = qs("#smartUnite");
  const suggestionsBox = qs("#smartSuggestions");
  const statusBox = qs("#smartStatus");
  const btnSave = qs("#btnSmartSave");
  const btnBulk = qs("#btnSmartBulkImport");
  const bulkText = qs("#smartBulkText");

  if (!articleInput || !btnSave) return;

  function setSmartStatus(message, type = "") {
    if (!statusBox) return;
    statusBox.textContent = message || "";
    statusBox.className = type ? `smart-status ${type}` : "smart-status";
  }

  async function refreshSuggestions() {
    const q = articleInput.value.trim();
    smartSelectedCle = "";

    if (!suggestionsBox) return;

    if (q.length < 2) {
      suggestionsBox.innerHTML = `<div class="muted-dark">Tape au moins 2 lettres.</div>`;
      return;
    }

    const res = await api("inventorySmartSearch", {
      q,
      poste: qs("#invmZone").value,
      limit: 8
    });

    if (!isOk(res)) {
      suggestionsBox.innerHTML = `<div class="muted-dark">Backend inventaire non disponible.</div>`;
      setSmartStatus("❌ Backend inventaire non branché : " + (res.message || "erreur"), "error");
      return;
    }

    const items = res.items || [];

    if (!items.length) {
      suggestionsBox.innerHTML = `<div class="muted-dark">Aucune proposition fiable.</div>`;
      return;
    }

    suggestionsBox.innerHTML = items.map((it, index) => `
      <button type="button" class="smart-choice" data-cle="${escapeHtml(it.cle)}">
        <strong>${index + 1}. ${escapeHtml(it.article || it.produit || "")}</strong>
        <span class="muted-dark">
          ${escapeHtml(it.groupe || "")} • ${escapeHtml(it.unite || "")}
          • ordre PDF ${escapeHtml(it.ordrePdf || "")}
          • score ${escapeHtml(it.score || 0)}
        </span>
      </button>
    `).join("");

    qsa(".smart-choice", suggestionsBox).forEach(btn => {
      btn.addEventListener("click", () => {
        qsa(".smart-choice", suggestionsBox).forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        smartSelectedCle = btn.dataset.cle || "";
        setSmartStatus("✅ Article Axel sélectionné. Tu peux enregistrer.", "ok");
      });
    });
  }

  articleInput.addEventListener("input", debounce(refreshSuggestions, 300));

  btnSave.addEventListener("click", async () => {
    const articleTerrain = articleInput.value.trim();
    const qte = qteInput.value;
    const unite = uniteInput.value.trim();
    const poste = qs("#invmZone").value;
    const mois = qs("#invmMois").value;

    if (!articleTerrain || !qte) {
      alert("Article + quantité obligatoires.");
      return;
    }

    setSmartStatus("⏳ Rangement intelligent en cours...", "loading");

    const smartRes = await api("inventorySmartSubmit", {
      mois,
      poste,
      articleTerrain,
      qte,
      unite,
      cle: smartSelectedCle
    });

    if (smartRes.status === "NEED_CHOICE") {
      renderSmartChoices(smartRes.suggestions || []);
      setSmartStatus("⚠️ Plusieurs articles possibles. Sélectionne le bon puis reclique sur enregistrer.", "warning");
      return;
    }

    if (!isOk(smartRes)) {
      setSmartStatus("❌ SAS intelligent non rempli : " + (smartRes.message || "Erreur inconnue"), "error");
      return;
    }

    const articleFinal = smartRes.item?.article || articleTerrain;
    const classicRes = await saveClassicInventoryBatch([{
      produit: articleFinal,
      qte,
      unite: smartRes.item?.unite || unite,
      comment: `Inventaire intelligent — terrain : ${articleTerrain}`
    }]);

    if (!isOk(classicRes)) {
      setSmartStatus(
        `⚠️ SAS intelligent rempli, mais inventaire classique non rempli : ${classicRes.message || "Erreur"}`,
        "warning"
      );
      return;
    }

    setSmartStatus(`✅ Rempli dans les 2 inventaires : ${articleFinal}`, "ok");

    articleInput.value = "";
    qteInput.value = "";
    uniteInput.value = "";
    smartSelectedCle = "";

    suggestionsBox.innerHTML = `<div class="muted-dark">Aucune proposition fixe.</div>`;
  });

  btnBulk.addEventListener("click", async () => {
    const raw = bulkText.value.trim();

    if (!raw) {
      alert("Colle ton inventaire terrain avant d’importer.");
      return;
    }

    const rows = parseSmartBulkText(raw, {
      mois: qs("#invmMois").value,
      poste: qs("#invmZone").value
    });

    if (!rows.length) {
      alert("Aucune ligne exploitable trouvée.");
      return;
    }

    setSmartStatus(`⏳ Import intelligent de ${rows.length} ligne(s)...`, "loading");

    const smartRes = await apiPost("inventorySmartBulkImport", {
      mois: qs("#invmMois").value,
      poste: qs("#invmZone").value,
      rows
    });

    if (!isOk(smartRes)) {
      setSmartStatus("❌ Import intelligent impossible : " + (smartRes.message || "Erreur"), "error");
      return;
    }

    const okClassicRows = [];

    (smartRes.details || []).forEach(d => {
      if (d.result && isOk(d.result)) {
        okClassicRows.push({
          produit: d.result.item?.article || d.input.articleTerrain,
          qte: d.input.qte,
          unite: d.result.item?.unite || d.input.unite || "",
          comment: `Import intelligent — terrain : ${d.input.articleTerrain}`
        });
      }
    });

    let classicRes = { status: "success", ok: true };

    if (okClassicRows.length) {
      classicRes = await saveClassicInventoryBatch(okClassicRows);
    }

    const s = smartRes.summary || {};
    const msg = `✅ SAS : ${s.ok || 0} rangé(s), ${s.needChoice || 0} à valider, ${s.error || 0} erreur(s). Classique : ${okClassicRows.length} ligne(s).`;

    if (!isOk(classicRes)) {
      setSmartStatus(msg + " ⚠️ Mais l’inventaire classique n’a pas tout pris.", "warning");
      return;
    }

    setSmartStatus(msg, "ok");
  });

  function renderSmartChoices(items) {
    if (!items.length) {
      suggestionsBox.innerHTML = `<div class="muted-dark">Aucune proposition exploitable.</div>`;
      return;
    }

    suggestionsBox.innerHTML = items.map((it, index) => `
      <button type="button" class="smart-choice" data-cle="${escapeHtml(it.cle)}">
        <strong>${index + 1}. ${escapeHtml(it.article || it.produit || "")}</strong>
        <span class="muted-dark">
          ${escapeHtml(it.groupe || "")} • ${escapeHtml(it.unite || "")}
          • ordre PDF ${escapeHtml(it.ordrePdf || "")}
          • score ${escapeHtml(it.score || 0)}
        </span>
      </button>
    `).join("");

    qsa(".smart-choice", suggestionsBox).forEach(btn => {
      btn.addEventListener("click", () => {
        qsa(".smart-choice", suggestionsBox).forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        smartSelectedCle = btn.dataset.cle || "";
        setSmartStatus("✅ Choix sélectionné. Reclique sur enregistrer intelligemment.", "ok");
      });
    });
  }
}

function parseSmartBulkText(raw, defaults = {}) {
  return raw
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const tabParts = line.split(/\t|;/).map(x => x.trim()).filter(Boolean);

      if (tabParts.length >= 3) {
        return {
          articleTerrain: tabParts[0],
          qte: tabParts[1],
          unite: tabParts[2],
          poste: tabParts[3] || defaults.poste || "",
          mois: tabParts[4] || defaults.mois || ""
        };
      }

      const match = line.match(/^(.+?)\s+([0-9]+(?:[,.][0-9]+)?)\s*(KG|KILO|KILOS|L|LITRE|LITRES|PCS|PIECE|PIECES|PCE|U|G|GR|ML)?$/i);

      if (match) {
        return {
          articleTerrain: match[1].trim(),
          qte: match[2],
          unite: match[3] || "",
          poste: defaults.poste || "",
          mois: defaults.mois || ""
        };
      }

      return {
        articleTerrain: line,
        qte: "",
        unite: "",
        poste: defaults.poste || "",
        mois: defaults.mois || ""
      };
    })
    .filter(x => x.articleTerrain && x.qte);
}

// ============================================================
// RECETTES
// ============================================================

let recetteCache = {};

async function mountRecettes() {
  try {
    const res = await api("getRecettes");
    const list = qs("#recettesList");

    if (!isOk(res)) {
      list.innerHTML = `<div class="muted">Erreur de chargement.</div>`;
      return;
    }

    const recettes = res.recettes || [];

    if (!recettes.length) {
      list.innerHTML = `<div class="muted">Aucune recette.</div>`;
      return;
    }

    list.innerHTML = recettes.map(r => `
      <div class="card recette-card" data-code="${escapeHtml(r.code)}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <div>
            <strong>${escapeHtml(r.nom)}</strong>
            <div class="muted">${escapeHtml(r.categorie || "")} • base ${escapeHtml(r.portions || 1)} p.</div>
          </div>
          <button class="btn ghost small">Voir</button>
        </div>
        <div class="recette-detail" style="display:none;"></div>
      </div>
    `).join("");

    qsa(".recette-card", list).forEach(card => {
      const btn = card.querySelector(".btn.small");

      btn.addEventListener("click", async ev => {
        ev.stopPropagation();

        const detail = card.querySelector(".recette-detail");

        if (detail.style.display === "block") {
          detail.style.display = "none";
          detail.innerHTML = "";
          btn.textContent = "Voir";
          return;
        }

        detail.innerHTML = `<div class="muted">Chargement...</div>`;
        detail.style.display = "block";
        btn.textContent = "Fermer";

        const code = card.dataset.code;

        if (!recetteCache[code]) {
          const r = await api("getRecette", { code });

          if (!isOk(r)) {
            detail.innerHTML = `<div class="muted">Recette introuvable.</div>`;
            return;
          }

          recetteCache[code] = {
            recette: r.recette,
            factor: 1
          };
        }

        renderRecetteDetail(card, recetteCache[code].recette, recetteCache[code].factor);
      });
    });

    const search = qs("#recetteSearch");

    if (search) {
      search.addEventListener("input", e => {
        const q = e.target.value.toLowerCase();

        qsa(".recette-card", list).forEach(c => {
          const name = c.querySelector("strong").textContent.toLowerCase();
          c.style.display = name.includes(q) ? "" : "none";
        });
      });
    }
  } catch (e) {
    qs("#recettesList").innerHTML = `<div class="muted">Erreur de chargement.</div>`;
  }
}

function renderRecetteDetail(card, recette, factorInit) {
  const code = card.dataset.code;
  const detail = card.querySelector(".recette-detail");
  const basePortions = toNum(recette.portions || 1);
  const f0 = Math.max(0, toNum(factorInit) || 1);

  detail.innerHTML = `
    <div class="row-actions" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
      <span class="muted">Multiplicateur :</span>
      <button class="btn ghost small factor-dec" type="button">−</button>
      <input class="factor-input" type="number" step="0.1" min="0" value="${f0}" style="width:90px">
      <button class="btn ghost small factor-inc" type="button">+</button>
      <span class="info-line muted" style="margin-left:8px"></span>
    </div>

    <table class="list mini">
      <thead>
        <tr>
          <th>Produit</th>
          <th>Qté</th>
          <th>Unité</th>
          <th>Zone</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const input = detail.querySelector(".factor-input");
  const decBtn = detail.querySelector(".factor-dec");
  const incBtn = detail.querySelector(".factor-inc");
  const tbody = detail.querySelector("tbody");
  const info = detail.querySelector(".info-line");

  const renderRows = factor => {
    tbody.innerHTML = (recette.ingredients || []).map(i => {
      const q = toNum(i.quantite);
      const scaled = q * factor;

      return `
        <tr>
          <td>${escapeHtml(i.produit)}</td>
          <td style="text-align:right">${scaled.toFixed(2)}</td>
          <td>${escapeHtml(i.unite || "")}</td>
          <td>${escapeHtml(i.zone || "")}</td>
        </tr>
      `;
    }).join("");

    const totalPortions = basePortions * factor;
    info.innerHTML = `Base ${basePortions} p. → <b>${totalPortions.toFixed(1)} p.</b> ×${factor.toFixed(2)}`;
  };

  const setFactor = f => {
    const nf = Math.max(0, toNum(f) || 1);
    input.value = String(nf);
    recetteCache[code].factor = nf;
    renderRows(nf);
  };

  input.addEventListener("input", () => setFactor(input.value));
  decBtn.addEventListener("click", () => setFactor(toNum(input.value) - 1));
  incBtn.addEventListener("click", () => setFactor(toNum(input.value) + 1));

  setFactor(f0);
}

// ============================================================
// PARAMÈTRES
// ============================================================

function mountSettings() {
  const etab = localStorage.getItem("etab") || "";
  const tz = localStorage.getItem("tz") || "Europe/Paris";
  const email = localStorage.getItem("emailCC") || "";
  const lang = localStorage.getItem("lang") || "fr";

  qs("#setEtab").value = etab;
  qs("#setTz").value = tz;
  qs("#setEmail").value = email;
  qs("#setLang").value = lang;

  qs("#btnSetSave").addEventListener("click", () => {
    localStorage.setItem("etab", qs("#setEtab").value);
    localStorage.setItem("tz", qs("#setTz").value);
    localStorage.setItem("emailCC", qs("#setEmail").value);
    localStorage.setItem("lang", qs("#setLang").value);

    alert("Paramètres enregistrés ✅");
  });
}
