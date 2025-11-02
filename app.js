// =======================================
// 🍷 Fouquet’s Joy Suite – app.js v15.0
// Compatible proxy Google Apps Script
// Zones & Produits dynamiques, auto-reset, et boutons Entrée / Sortie
// =======================================

// ⚙️ URL du script (avec proxy activé)
const SCRIPT_ID = "https://script.google.com/macros/s/AKfycbxDfmMcASzk9su5QN08LIWLlOgOW24z78vz4nuV5eXTAB0NYKVGuArRI2lOKQRehrfx/exec"; // ← remplace par ton ID Apps Script
const BASE_URL = `https://script.google.com/macros/s/${SCRIPT_ID}/exec`;
const API_URL = `${BASE_URL}?action=proxy&url=${encodeURIComponent(BASE_URL)}`;

// ----------- outils DOM ----------- //
const qs = sel => document.querySelector(sel);
const ce = tag => document.createElement(tag);

// ----------- Initialisation ----------- //
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Fouquet’s Joy Suite v15.0 – Initialisation");

  await chargerZones();
  await chargerProduits();
  await chargerRecettes();
  await chargerDashboard();

  // Pertes
  qs("#btnSavePerte").addEventListener("click", enregistrerPerte);
  // Inventaire journalier : deux boutons
  qs("#btnEntreeInvJ").addEventListener("click", () => enregistrerInventaireJournalier("entree"));
  qs("#btnSortieInvJ").addEventListener("click", () => enregistrerInventaireJournalier("sortie"));
  // Inventaire mensuel
  qs("#btnSaveInvM").addEventListener("click", enregistrerInventaireMensuel);
});

// ----------- Fonctions utilitaires API ----------- //
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
// 🧱 CHARGEMENT INITIAL
// =======================================

// --- Zones dynamiques ---
async function chargerZones() {
  const res = await apiFetch("zonesList", "GET");
  if (res.status !== "success") return console.warn("Zones non chargées", res.message);

  const sel = qs("#invMZone");
  if (!sel) return;

  sel.innerHTML = "";
  res.zones.forEach(z => {
    const opt = ce("option");
    opt.value = z;
    opt.textContent = z;
    sel.appendChild(opt);
  });
  console.log("✅ Zones chargées:", res.zones);
}

// --- Produits dynamiques ---
async function chargerProduits() {
  const res = await apiFetch("produitsList", "GET");
  if (res.status !== "success") return console.warn("Produits non chargés", res.message);

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

// --- Recettes ---
async function chargerRecettes() {
  const res = await apiFetch("getRecettes", "GET");
  if (res.status !== "success") return;
  const zoneRecettes = qs("#recettesList");
  if (!zoneRecettes) return;
  zoneRecettes.innerHTML = "";
  res.recettes.forEach(r => {
    const li = ce("li");
    li.textContent = `${r.nom} (${r.categorie})`;
    zoneRecettes.appendChild(li);
  });
}

// --- Dashboard ---
async function chargerDashboard() {
  const res = await apiFetch("getEtatStock", "GET");
  if (res.status !== "success") return;
  qs("#totalStock").textContent = `${res.quantiteTotale} unités`;
  qs("#valeurStock").textContent = `${res.valeurTotale.toFixed(2)} €`;
}

// =======================================
// 🧾 MODULES DE SAISIE
// =======================================

// --- PERTES ---
async function enregistrerPerte() {
  const payload = {
    action: "pertesAdd",
    produit: qs("#perteProduit").value,
    qte: qs("#perteQte").value,
    unite: qs("#perteUnite").value,
    motif: qs("#perteMotif")?.value || ""
  };
  const res = await apiFetch("pertesAdd", "POST", payload);
  alert(res.status === "success" ? "✅ Perte enregistrée" : "❌ Erreur : " + res.message);

  // Réinitialisation
  ["#perteProduit", "#perteQte", "#perteUnite", "#perteMotif"].forEach(id => { const el = qs(id); if (el) el.value = ""; });
  await chargerDashboard();
}

// --- INVENTAIRE JOURNALIER ---
async function enregistrerInventaireJournalier(type) {
  const payload = {
    action: "inventaireJournalier",
    produit: qs("#invjProduit").value,
    qte: qs("#invjQte").value,
    unite: qs("#invjUnite").value,
    type
  };
  const res = await apiFetch("inventaireJournalier", "POST", payload);
  alert(res.status === "success"
    ? (type === "sortie" ? "📦 Sortie enregistrée" : "📥 Entrée enregistrée")
    : "❌ Erreur : " + res.message);

  // Réinitialisation
  ["#invjProduit", "#invjQte", "#invjUnite"].forEach(id => { const el = qs(id); if (el) el.value = ""; });
  await chargerDashboard();
}

// --- INVENTAIRE MENSUEL ---
async function enregistrerInventaireMensuel() {
  const zone = qs("#invMZone").value;
  const produit = qs("#invMProduit").value;
  const qte = qs("#invMQte").value;
  const unite = qs("#invMUnite").value;
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

  // Réinitialisation
  ["#invMZone", "#invMProduit", "#invMQte", "#invMUnite"].forEach(id => { const el = qs(id); if (el) el.value = ""; });
  await chargerDashboard();
}
