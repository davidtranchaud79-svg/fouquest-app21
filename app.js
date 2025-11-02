// =======================================
// 🍷 Fouquet’s Joy Suite – app.js v15.2
// =======================================

const API_URL = "https://script.google.com/macros/s/AKfycbxWSFO8YOYpnOU-Ey0FSla4qOBNSzM-TH7iz4goBKjyJBkdogmULZDx352GjTuPbsGL/exec"; // ← remplace ici ton URL

const qs = s => document.querySelector(s);

// --- Initialisation ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("🍷 Fouquet’s Suite – App initialisée");
  chargerDashboard();
  chargerRecettes();
  chargerZones();
  chargerProduits();
  initPertes();
  initInventaireJournalier();
  initInventaireMensuel();
});

// --- API ---
async function api(action, data = null) {
  const options = data ? { method: "POST", body: JSON.stringify({ action, ...data }) } : {};
  const url = data ? API_URL : `${API_URL}?action=${action}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

// --- Dashboard ---
async function chargerDashboard() {
  const res = await api("getEtatStock");
  if (res.status === "success") {
    qs("#kpiStock").textContent = `€ ${res.valeurTotale.toFixed(2)}`;
    qs("#kpiStockQte").textContent = `${res.quantiteTotale} unités`;
  }
}

// --- Pertes ---
function initPertes() {
  const btn = qs("#btnSavePerte");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const data = {
      produit: qs("#pertesProduit").value,
      qte: qs("#pertesQte").value,
      unite: qs("#pertesUnite").value,
      motif: qs("#pertesMotif").value,
      comment: qs("#pertesComment").value,
    };
    const res = await api("pertesAdd", data);
    alert(res.message);
    ["#pertesProduit", "#pertesQte", "#pertesUnite", "#pertesMotif", "#pertesComment"].forEach(id => qs(id).value = "");
    chargerDashboard();
  });
}

// --- Inventaire journalier ---
function initInventaireJournalier() {
  ["entree", "sortie"].forEach(type => {
    const btn = qs(`#btn${type === "entree" ? "Entree" : "Sortie"}InvJ`);
    if (btn) btn.addEventListener("click", async () => {
      const data = {
        type,
        produit: qs("#invjProduit").value,
        qte: qs("#invjQte").value,
        unite: qs("#invjUnite").value,
      };
      const res = await api("inventaireJournalier", data);
      alert(res.message);
      ["#invjProduit", "#invjQte", "#invjUnite"].forEach(id => qs(id).value = "");
      chargerDashboard();
    });
  });
}

// --- Inventaire mensuel ---
function initInventaireMensuel() {
  const btn = qs("#btnInvmSave");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const mois = new Date().toISOString().slice(0, 7);
    const data = {
      zone: qs("#invmZone").value,
      produits: qs("#invmProduit").value,
      quantite: qs("#invmQte").value,
      unite: qs("#invmUnite").value,
      mois,
    };
    const res = await api("saveInventaireMensuel", data);
    alert(res.message);
  });
}

// --- Recettes ---
async function chargerRecettes() {
  const res = await api("getRecettes");
  if (res.status !== "success") return;
  const list = qs("#recettesList");
  list.innerHTML = res.recettes.map(r => `<div class="card"><b>${r.nom}</b><br><small>${r.categorie}</small></div>`).join("");
}

// --- Zones / Produits ---
async function chargerZones() {
  const res = await api("zonesList");
  if (res.status === "success") {
    const sel = qs("#invmZone");
    sel.innerHTML = res.zones.map(z => `<option>${z}</option>`).join("");
  }
}
async function chargerProduits() {
  const res = await api("produitsList");
  if (res.status === "success") {
    const champs = ["#pertesProduit", "#invjProduit", "#invmProduit"];
    champs.forEach(id => {
      const el = qs(id);
      el.innerHTML = res.produits.map(p => `<option>${p}</option>`).join("");
    });
  }
}
