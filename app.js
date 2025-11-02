// =======================================
// 🍷 Fouquet’s Suite v15.7 – app.js
// Frontend pour Joy / GitHub Pages
// =======================================

// 🧭 URL de l’API (à remplacer si tu redéploies le script)
const API_URL = "https://script.google.com/macros/s/AKfycbzhXTkQ0vSkU_hcR17GrWLiZM55cMBuUlaMMNu83XW8frY47vQuCfdavoNTRngTDKA4/exec";

// ============================
// 🌍 Gestion API
// ============================
async function api(action, method = "GET", body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    mode: "cors"
  };
  if (body) options.body = JSON.stringify(body);
  const url = method === "GET" ? `${API_URL}?action=${action}` : API_URL;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Erreur réseau (${res.status})`);
  return await res.json();
}

// ============================
// 📊 Fonctions Dashboard
// ============================
async function mountDashboard() {
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("tpl-dashboard").innerHTML;

  try {
    const etat = await api("getEtatStock");
    document.getElementById("kpiStock").textContent = etat.valeurTotale.toFixed(2) + " €";
    document.getElementById("kpiStockQte").textContent = etat.quantiteTotale.toFixed(2) + " unités";
  } catch (e) {
    console.warn("Erreur dashboard:", e.message);
  }

  try {
    const stock = await api("getStockDetail");
    const tbody = document.querySelector("#tableStockDetail tbody");
    tbody.innerHTML = stock.stock.map(s =>
      `<tr><td>${s.produit}</td><td>${s.quantite}</td><td>${s.unite}</td><td>${s.prix}</td><td>${s.valeur}</td><td>${s.zone}</td></tr>`
    ).join("");
  } catch (e) { console.warn(e.message); }
}

// ============================
// 🗑️ Pertes
// ============================
async function mountPertes() {
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("tpl-pertes").innerHTML;

  const produits = await api("getStockDetail");
  const datalist = document.getElementById("produitsList");
  datalist.innerHTML = produits.stock.map(p => `<option value="${p.produit}">`).join("");

  document.getElementById("btnSavePerte").addEventListener("click", async () => {
    const data = {
      action: "pertesAdd",
      produit: document.getElementById("pertesProduit").value,
      qte: document.getElementById("pertesQte").value,
      unite: document.getElementById("pertesUnite").value,
      motif: document.getElementById("pertesMotif").value,
      comment: document.getElementById("pertesComment").value
    };
    const res = await api("pertesAdd", "POST", data);
    alert(res.message);
    // Réinitialisation automatique
    ["pertesProduit","pertesQte","pertesUnite","pertesMotif","pertesComment"].forEach(id=>document.getElementById(id).value="");
  });
}

// ============================
// 📦 Inventaire journalier
// ============================
async function mountInvJ() {
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("tpl-invj").innerHTML;

  const produits = await api("getStockDetail");
  const datalist = document.getElementById("produitsList");
  datalist.innerHTML = produits.stock.map(p => `<option value="${p.produit}">`).join("");

  // ✅ Bouton Entrée
  document.getElementById("btnInvJEntree").addEventListener("click", async () => {
    await sendInvJ("ENTREE");
  });
  // ✅ Bouton Sortie
  document.getElementById("btnInvJSortie").addEventListener("click", async () => {
    await sendInvJ("SORTIE");
  });
}

async function sendInvJ(type) {
  const data = {
    action: "inventaireJournalier",
    produit: document.getElementById("invjProduit").value,
    qte: document.getElementById("invjQte").value,
    unite: document.getElementById("invjUnite").value,
    type
  };
  const res = await api("inventaireJournalier", "POST", data);
  alert(res.message);
  // 🔁 Réinitialisation
  ["invjProduit","invjQte","invjUnite"].forEach(id=>document.getElementById(id).value="");
}

// ============================
// 🏷️ Inventaire mensuel
// ============================
async function mountInvM() {
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("tpl-invm").innerHTML;

  const zonesRes = await api("zonesList");
  const zoneSelect = document.getElementById("invmZone");
  zoneSelect.innerHTML = zonesRes.zones.map(z => `<option>${z}</option>`).join("");

  document.getElementById("btnInvmGenerate").addEventListener("click", async () => {
    const data = { action: "createInventaireMensuel", zone: zoneSelect.value, mois: document.getElementById("invmMois").value };
    const res = await api("createInventaireMensuel", "POST", data);
    alert(res.message);
  });

  document.getElementById("btnInvmSave").addEventListener("click", async () => {
    const data = {
      action: "saveInventaireMensuel",
      zone: zoneSelect.value,
      mois: document.getElementById("invmMois").value,
      produits: document.getElementById("invmProduit").value,
      quantite: document.getElementById("invmQte").value,
      unite: document.getElementById("invmUnite").value,
      commentaires: document.getElementById("invmComment").value
    };
    const res = await api("saveInventaireMensuel", "POST", data);
    alert(res.message);
    // Réinitialisation
    ["invmProduit","invmQte","invmUnite","invmComment"].forEach(id=>document.getElementById(id).value="");
  });
}

// ============================
// 🍽️ Recettes
// ============================
async function mountRecettes() {
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("tpl-recettes").innerHTML;
  const res = await api("getRecettes");
  const list = document.getElementById("recettesList");
  list.innerHTML = res.recettes.map(r => `<div class="card recette" data-code="${r.code}"><strong>${r.nom}</strong><br><small>${r.categorie}</small></div>`).join("");
  list.querySelectorAll(".recette").forEach(el => {
    el.addEventListener("click", async () => {
      const code = el.dataset.code;
      const rec = await api(`getRecette&code=${code}`);
      const det = document.getElementById("recetteDetail");
      det.innerHTML = `<h3>${rec.recette.nom}</h3><table class="list"><tr><th>Produit</th><th>Qté</th><th>Unité</th></tr>` +
        rec.recette.ingredients.map(i => `<tr><td>${i.produit}</td><td>${i.quantite}</td><td>${i.unite}</td></tr>`).join("") + "</table>";
    });
  });
}

// ============================
// ⚙️ Paramètres
// ============================
function mountSettings() {
  const app = document.getElementById("app");
  app.innerHTML = document.getElementById("tpl-settings").innerHTML;
}

// ============================
// 🧭 Router simple
// ============================
const views = {
  dashboard: mountDashboard,
  pertes: mountPertes,
  invj: mountInvJ,
  invm: mountInvM,
  recettes: mountRecettes,
  settings: mountSettings
};

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", async () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const view = tab.dataset.view;
      if (views[view]) await views[view]();
    });
  });
  // Vue par défaut
  mountDashboard();
  console.log("✅ Application Fouquet’s Suite chargée");
});
