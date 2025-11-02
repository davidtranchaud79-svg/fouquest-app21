// =======================================
// 🍷 Fouquet’s Joy Suite – app.js v15.1
// Version stable : fix DOM / auto-reset / proxy compatible
// =======================================

// ⚙️ CONFIGURATION
const SCRIPT_ID = "https://script.google.com/macros/s/AKfycbx15mhcn4Y4GSIPxozbHoB6xsMzvUwRCCVgE9MT6H4UhNBO5N76ntf3bL2M_t0FLGJh/exec"; // ← à remplacer par ton ID Apps Script
const BASE_URL = `https://script.google.com/macros/s/${SCRIPT_ID}/exec`;
const API_URL = `${BASE_URL}?action=proxy&url=${encodeURIComponent(BASE_URL)}`;

// ----------- OUTILS ----------- //
const qs = sel => document.querySelector(sel);
const ce = tag => document.createElement(tag);

// ----------- INITIALISATION ----------- //
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Fouquet’s Joy Suite v15.1 – Initialisation");

  await chargerZones();
  await chargerProduits();
  await chargerRecettes();
  await chargerDashboard();

  // ⚙️ Initialisation des vues après un court délai (DOM ready)
  setTimeout(() => {
    initPertes();
    initInventaireJournalier();
    initInventaireMensuel();
  }, 400);
});

// =======================================
// 🔌 GESTION API
// =======================================
async function apiFetch(action, method = "GET", data = {}) {
  const payload = method === "POST" ? { method, body: JSON.stringify(data) } : { method };
  payload.headers = { "Content-Type": "application/json" };
  const url = method === "GET"
    ? `${API_URL}?action=${action}`
    : API_URL;

  try {
    const res = await fetch(url, payload);
    const txt = await res.text();
    return JSON.parse(txt);
  } catch (e) {
    console.error("Erreur API:", e);
    return { status: "error", message: e.message };
  }
}

// =======================================
// 🧱 CHARGEMENTS INITIAUX
// =======================================

// --- ZONES ---
async function chargerZones() {
  const res = await apiFetch("zonesList", "GET");
  if (res.status !== "success") {
    console.warn("Zones non chargées:", res.message);
    return;
  }
  const selects = ["#invMZone", "#perteZone", "#invjZone"];
  selects.forEach(id => {
    const sel = qs(id);
    if (!sel) return;
    sel.innerHTML = "";
    res.zones.forEach(z => {
      const opt = ce("option");
      opt.value = z;
      opt.textContent = z;
      sel.appendChild(opt);
    });
  });
  console.log("✅ Zones chargées:", res.zones);
}

// --- PRODUITS ---
async function chargerProduits() {
  const res = await apiFetch("produitsList", "GET");
  if (res.status !== "success") {
    console.warn("Produits non chargés:", res.message);
    return;
  }
  const champs = ["#perteProduit", "#invjProduit", "#invMProduit"];
  champs.forEach(id => {
    const el = qs(id);
    if (!el) return;
    el.innerHTML = "";
    res.produits.forEach(p => {
      const opt = ce("option");
      opt.value = p;
      opt.textContent = p;
      el.appendChild(opt);
    });
  });
  console.log("✅ Produits chargés:", res.produits);
}

// --- RECETTES ---
async function chargerRecettes() {
  const res = await apiFetch("getRecettes", "GET");
  const zoneRecettes = qs("#recettesList");
  if (!zoneRecettes) return;
  if (res.status !== "success") {
    zoneRecettes.innerHTML = `<li>⚠️ Erreur : ${res.message}</li>`;
    return;
  }
  zoneRecettes.innerHTML = "";
  res.recettes.forEach(r => {
    const li = ce("li");
    li.textContent = `${r.nom} (${r.categorie})`;
    zoneRecettes.appendChild(li);
  });
  console.log("✅ Recettes chargées:", res.recettes.length);
}

// --- DASHBOARD ---
async function chargerDashboard() {
  const res = await apiFetch("getEtatStock", "GET");
  if (res.status !== "success") return;
  if (qs("#totalStock")) qs("#totalStock").textContent = `${res.quantiteTotale} unités`;
  if (qs("#valeurStock")) qs("#valeurStock").textContent = `${res.valeurTotale.toFixed(2)} €`;
}

// =======================================
// 🧾 MODULES DE SAISIE
// =======================================

// --- INITIALISATION DES ÉCOUTEURS ---
function initPertes() {
  const btn = qs("#btnSavePerte");
  if (!btn) return;
  btn.addEventListener("click", enregistrerPerte);
  console.log("🗑️ Bouton pertes prêt");
}

function initInventaireJournalier() {
  const entree = qs("#btnEntreeInvJ");
  const sortie = qs("#btnSortieInvJ");
  if (entree) entree.addEventListener("click", () => enregistrerInventaireJournalier("entree"));
  if (sortie) sortie.addEventListener("click", () => enregistrerInventaireJournalier("sortie"));
  console.log("📦 Boutons inventaire journalier prêts");
}

function initInventaireMensuel() {
  const btn = qs("#btnSaveInvM");
  if (btn) btn.addEventListener("click", enregistrerInventaireMensuel);
  console.log("🏷️ Bouton inventaire mensuel prêt");
}

// --- PERTES ---
async function enregistrerPerte() {
  const payload = {
    action: "pertesAdd",
    produit: qs("#perteProduit")?.value || "",
    qte: qs("#perteQte")?.value || 0,
    unite: qs("#perteUnite")?.value || "",
    motif: qs("#perteMotif")?.value || "",
    zone: qs("#perteZone")?.value || ""
  };
  const res = await apiFetch("pertesAdd", "POST", payload);
  alert(res.status === "success" ? "✅ Perte enregistrée" : "❌ Erreur : " + res.message);

  // Réinitialisation automatique
  ["#perteProduit", "#perteQte", "#perteUnite", "#perteMotif", "#perteZone"].forEach(id => {
    const el = qs(id); if (el) el.value = "";
  });
  await chargerDashboard();
}

// --- INVENTAIRE JOURNALIER ---
async function enregistrerInventaireJournalier(type) {
  const payload = {
    action: "inventaireJournalier",
    produit: qs("#invjProduit")?.value || "",
    qte: qs("#invjQte")?.value || 0,
    unite: qs("#invjUnite")?.value || "",
    type,
    zone: qs("#invjZone")?.value || ""
  };
  const res = await apiFetch("inventaireJournalier", "POST", payload);
  alert(res.status === "success"
    ? (type === "sortie" ? "📦 Sortie enregistrée" : "📥 Entrée enregistrée")
    : "❌ Erreur : " + res.message);

  ["#invjProduit", "#invjQte", "#invjUnite", "#invjZone"].forEach(id => {
    const el = qs(id); if (el) el.value = "";
  });
  await chargerDashboard();
}

// --- INVENTAIRE MENSUEL ---
async function enregistrerInventaireMensuel() {
  const zone = qs("#invMZone")?.value || "";
  const produit = qs("#invMProduit")?.value || "";
  const qte = qs("#invMQte")?.value || 0;
  const unite = qs("#invMUnite")?.value || "";
  const mois = new Date().toISOString().slice(0,7);

  const payload = {
    action: "saveInventaireMensuel",
    zone,
    produits: produit,
    quantite: qte,
    unite,
    mois
  };
  const res = await apiFetch("saveInventaireMensuel", "POST", payload);
  alert(res.status === "success" ? "✅ Inventaire mensuel enregistré" : "❌ Erreur : " + res.message);

  ["#invMZone", "#invMProduit", "#invMQte", "#invMUnite"].forEach(id => {
    const el = qs(id); if (el) el.value = "";
  });
  await chargerDashboard();
}
