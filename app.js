// ============================================================
// 🍷 Fouquet’s Suite – Frontend App.js
// Edition: Secure API Key + CORS Proxy (Nov 2025)
// ============================================================

// === CONFIGURATION ===
const API_URL = "https://script.google.com/macros/s/AKfycbyuYT4mXVg66ZD0x8fMFuAIGpp_4HIpfToKbgp4-yyWCywP8amCptk3brzAMi2iH_KfRQ/exec; // Remplace par ton lien Proxy
const API_KEY = "FOUQUETS_2025_SECRET"; // Même clé que côté Proxy

// === UTILITAIRE API ===
async function api(action, data = {}) {
  try {
    const payload = { key: API_KEY, action, ...data };
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error("Erreur API:", err);
    return { status: "error", message: err.message };
  }
}

// === GESTION DE LA NAVIGATION ===
const qs = s => document.querySelector(s);
const app = qs("#app");
const tabs = document.querySelectorAll(".tab");

tabs.forEach(btn => btn.addEventListener("click", () => {
  tabs.forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  render(btn.dataset.view);
}));

// === SYNCHRONISATION ===
async function checkConnection() {
  const res = await api("ping");
  const badge = qs("#syncBadge");
  if (res.status === "success") {
    badge.textContent = "En ligne";
    badge.classList.remove("offline");
    badge.classList.add("online");
  } else {
    badge.textContent = "Hors ligne";
    badge.classList.add("offline");
  }
}
qs("#btnSync").addEventListener("click", checkConnection);

// === RENDER ===
async function render(view) {
  const tpl = document.getElementById(`tpl-${view}`);
  app.innerHTML = tpl ? tpl.innerHTML : "<p>Vue inconnue</p>";

  if (view === "dashboard") await mountDashboard();
  if (view === "pertes") mountPertes();
  if (view === "invj") mountInvJ();
  if (view === "invm") mountInvM();
  if (view === "recettes") mountRecettes();
  if (view === "settings") console.log("Paramètres ouverts");
}

// === DASHBOARD ===
async function mountDashboard() {
  try {
    const etat = await api("getEtatStock");
    const detail = await api("getStockDetail");

    qs("#kpiStock").textContent = etat.totalValeur + " €";
    qs("#kpiStockQte").textContent = etat.totalQuantite + " unités";

    const tbody = qs("#tableStockDetail tbody");
    tbody.innerHTML = (detail || []).map(r => `
      <tr><td>${r.produit}</td><td>${r.qte}</td><td>${r.unite}</td><td>${r.prix}</td><td>${r.valeur}</td><td>${r.zone}</td></tr>
    `).join("");
  } catch (err) {
    console.error("Erreur dashboard:", err);
  }
}

// === PERTES ===
function mountPertes() {
  qs("#btnSavePerte").addEventListener("click", async () => {
    const data = {
      produit: qs("#pertesProduit").value,
      qte: qs("#pertesQte").value,
      unite: qs("#pertesUnite").value,
      motif: qs("#pertesMotif").value,
      comment: qs("#pertesComment").value
    };
    const res = await api("apiPertesAdd", data);
    alert(res.status === "success" ? "✅ Perte enregistrée" : "❌ Erreur: " + res.message);
    // Réinitialisation
    ["pertesProduit", "pertesQte", "pertesUnite", "pertesMotif", "pertesComment"].forEach(id => qs("#" + id).value = "");
  });
}

// === INVENTAIRE JOURNALIER ===
async function mountInvJ() {
  const produits = await api("getStockDetail");
  const input = qs("#invjProduit");
  input.setAttribute("list", "produitsList");
  const datalist = document.createElement("datalist");
  datalist.id = "produitsList";
  datalist.innerHTML = produits.map(p => `<option value="${p.produit}">`).join("");
  document.body.appendChild(datalist);

  qs("#btnInvJEntree").addEventListener("click", () => handleInvJ("entree"));
  qs("#btnInvJSortie").addEventListener("click", () => handleInvJ("sortie"));
}

async function handleInvJ(type) {
  const data = {
    produit: qs("#invjProduit").value,
    qte: qs("#invjQte").value,
    unite: qs("#invjUnite").value,
    type
  };
  const res = await api("inventaireJournalier", data);
  alert(res.status === "success" ? "✅ Inventaire enregistré" : "❌ Erreur: " + res.message);
  ["invjProduit", "invjQte", "invjUnite"].forEach(id => qs("#" + id).value = "");
}

// === INVENTAIRE MENSUEL ===
async function mountInvM() {
  const zones = await api("apiZonesList");
  const selZone = qs("#invmZone");
  selZone.innerHTML = zones.map(z => `<option>${z.zone}</option>`).join("");
  const produits = await api("getStockDetail");
  const inputProd = qs("#invmProduit");
  inputProd.setAttribute("list", "produitsMensuel");
  const dl = document.createElement("datalist");
  dl.id = "produitsMensuel";
  dl.innerHTML = produits.map(p => `<option value="${p.produit}">`).join("");
  document.body.appendChild(dl);

  qs("#btnInvmSave").addEventListener("click", async () => {
    const data = {
      zone: selZone.value,
      mois: qs("#invmMois").value,
      produit: inputProd.value,
      qte: qs("#invmQte").value,
      unite: qs("#invmUnite").value,
      comment: qs("#invmComment").value
    };
    const res = await api("saveInventaireMensuel", data);
    alert(res.status === "success" ? "✅ Enregistré" : "❌ Erreur: " + res.message);
  });
}

// === RECETTES ===
async function mountRecettes() {
  const recettes = await api("apiGetRecettesList");
  const list = qs("#recettesList");
  list.innerHTML = recettes.map(r => `<div class="card recette" data-id="${r.id}">${r.nom}</div>`).join("");
  list.querySelectorAll(".recette").forEach(div => div.addEventListener("click", () => loadRecette(div.dataset.id)));
}

async function loadRecette(id) {
  const recette = await api("apiGetRecette", { id });
  const d = qs("#recetteDetail");
  d.innerHTML = `<h3>${recette.nom}</h3><p>${recette.description}</p>`;
}

// === INIT ===
document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ Application Fouquet’s Suite chargée");
  await checkConnection();
  render("dashboard");
});
