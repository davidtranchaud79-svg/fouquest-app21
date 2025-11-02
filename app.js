// ============================================================
// 🍷 Fouquet’s Suite v15.3 – Frontend App.js
// ============================================================

const API_URL = "https://script.google.com/macros/s/TON_PROXY_ID/exec"; // ← ton URL Apps Script
const API_KEY = "FOUQUETS_2025_SECRET";

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
    console.error("Erreur API :", err);
    return { status: "error", message: err.message };
  }
}

// === NAVIGATION ===
const qs = s => document.querySelector(s);
const app = qs("#app");
document.querySelectorAll(".tab").forEach(b =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    b.classList.add("active");
    render(b.dataset.view);
  })
);

// === SYNCHRO ===
async function checkConnection() {
  const res = await api("ping");
  const badge = qs("#syncBadge");
  if (res.status === "success") {
    badge.textContent = "En ligne"; badge.className = "status-badge online";
  } else {
    badge.textContent = "Hors ligne"; badge.className = "status-badge offline";
  }
}
qs("#btnSync").addEventListener("click", checkConnection);

// === RENDER ===
async function render(view) {
  const tpl = document.getElementById(`tpl-${view}`);
  app.innerHTML = tpl ? tpl.innerHTML : "<p>Vue inconnue</p>";
  if (view==="dashboard") await mountDashboard();
  if (view==="pertes") mountPertes();
  if (view==="invj") mountInvJ();
  if (view==="invm") mountInvM();
  if (view==="recettes") mountRecettes();
}

// === DASHBOARD ===
async function mountDashboard() {
  try {
    const etat = await api("getEtatStock");
    const detail = await api("getStockDetail");
    qs("#kpiStock").textContent = etat.totalValeur+" €";
    qs("#kpiStockQte").textContent = etat.totalQuantite+" unités";
    qs("#tableStockDetail tbody").innerHTML =
      (detail||[]).map(r=>`<tr><td>${r.produit}</td><td>${r.qte}</td><td>${r.unite}</td><td>${r.valeur}</td></tr>`).join("");
  } catch(e){console.error(e)}
}

// === PERTES ===
function mountPertes(){
  qs("#btnSavePerte").addEventListener("click",async()=>{
    const data={
      produit:qs("#pertesProduit").value,
      qte:qs("#pertesQte").value,
      unite:qs("#pertesUnite").value,
      motif:qs("#pertesMotif").value
    };
    const res=await api("apiPertesAdd",data);
    alert(res.status==="success"?"✅ Perte enregistrée":"❌ Erreur : "+res.message);
    ["pertesProduit","pertesQte","pertesUnite","pertesMotif"].forEach(i=>qs("#"+i).value="");
  });
}

// === INV JOURNALIER ===
async function mountInvJ(){
  const produits=await api("getStockDetail");
  const datalist=document.createElement("datalist");
  datalist.id="produitsList";
  datalist.innerHTML=produits.map(p=>`<option value="${p.produit}">`).join("");
  document.body.appendChild(datalist);
  qs("#invjProduit").setAttribute("list","produitsList");
  qs("#btnInvJEntree").addEventListener("click",()=>handleInvJ("entree"));
  qs("#btnInvJSortie").addEventListener("click",()=>handleInvJ("sortie"));
}
async function handleInvJ(type){
  const data={
    produit:qs("#invjProduit").value,
    qte:qs("#invjQte").value,
    unite:qs("#invjUnite").value,
    type
  };
  const res=await api("inventaireJournalier",data);
  alert(res.status==="success"?"✅ Inventaire enregistré":"❌ Erreur : "+res.message);
  ["invjProduit","invjQte","invjUnite"].forEach(i=>qs("#"+i).value="");
}

// === INV MENSUEL ===
async function mountInvM(){
  const zones=await api("apiZonesList");
  qs("#invmZone").innerHTML=zones.map(z=>`<option>${z.zone}</option>`).join("");
  const produits=await api("getStockDetail");
  const dl=document.createElement("datalist");
  dl.id="produitsMensuel";
  dl.innerHTML=produits.map(p=>`<option value="${p.produit}">`).join("");
  document.body.appendChild(dl);
  qs("#invmProduit").setAttribute("list","produitsMensuel");
  qs("#btnInvmSave").addEventListener("click",async()=>{
    const data={
      zone:qs("#invmZone").value,
      mois:qs("#invmMois").value,
      produit:qs("#invmProduit").value,
      qte:qs("#invmQte").value,
      unite:qs("#invmUnite").value,
      comment:qs("#invmComment").value
    };
    const res=await api("saveInventaireMensuel",data);
    alert(res.status==="success"?"✅ Enregistré":"❌ Erreur : "+res.message);
  });
}

// === RECETTES ===
async function mountRecettes(){
  const recettes=await api("apiGetRecettesList");
  const list=qs("#recettesList");
  list.innerHTML=recettes.map(r=>`<div class="card recette" data-id="${r.id}">${r.nom}</div>`).join("");
  list.querySelectorAll(".recette").forEach(div=>div.addEventListener("click",()=>loadRecette(div.dataset.id)));
}
async function loadRecette(id){
  const recette=await api("apiGetRecette",{id});
  qs("#recetteDetail").innerHTML=`<h3>${recette.nom}</h3><p>${recette.description}</p>`;
}

// === INIT ===
document.addEventListener("DOMContentLoaded",async()=>{
  console.log("✅ Application Fouquet’s Suite chargée");
  await checkConnection();
  render("dashboard");
});
