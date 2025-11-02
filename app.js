// ============================================================
// 🍷 Fouquet’s Suite — App Front (v2025 béton)
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbzjhHaSAo1_qhUyf_bX0Y8C_FEkkz6jwOdeFudEh9VtYWQsT17ya4J3eDqQnInP_qG6Ow/exec";

// === API Helper ===
async function api(action, data={}){
  try{
    const res = await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action,...data})
    });
    return await res.json();
  }catch(e){
    console.error("Erreur API:",e);
    return {status:"error",message:e.message};
  }
}

// === UI Shortcuts ===
const qs = s=>document.querySelector(s);
const app = qs("#app");
const tabs = document.querySelectorAll(".tab");

tabs.forEach(btn=>btn.addEventListener("click",()=>{
  tabs.forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  render(btn.dataset.view);
}));

// === Connection Check ===
async function checkConnection(){
  const res=await api("ping");
  const b=qs("#syncBadge");
  if(res.status==="success"){b.textContent="En ligne";b.className="status-badge online";}
  else{b.textContent="Hors ligne";b.className="status-badge offline";}
}
qs("#btnSync").addEventListener("click",checkConnection);

// === Rendering ===
async function render(view){
  const tpl=document.getElementById(`tpl-${view}`);
  app.innerHTML=tpl?tpl.innerHTML:"<p>Vue inconnue</p>";

  if(view==="dashboard") await mountDashboard();
  if(view==="pertes") mountPertes();
  if(view==="invj") mountInvJ();
  if(view==="invm") mountInvM();
  if(view==="recettes") mountRecettes();
}

// === Dashboard ===
async function mountDashboard(){
  try{
    const etat=await api("getEtatStock");
    const detail=await api("getStockDetail");
    qs("#kpiStock").textContent=etat.totalValeur+" €";
    qs("#kpiStockQte").textContent=etat.totalQuantite+" unités";
    const tb=qs("#tableStockDetail tbody");
    tb.innerHTML=(detail||[]).map(r=>`
      <tr><td>${r.produit}</td><td>${r.qte}</td><td>${r.unite}</td><td>${r.prix}</td><td>${r.valeur}</td><td>${r.zone}</td></tr>
    `).join("");
  }catch(e){console.error(e);}
}

// === Pertes ===
function mountPertes(){
  qs("#btnSavePerte").addEventListener("click",async()=>{
    const d={produit:qs("#pertesProduit").value,qte:qs("#pertesQte").value,unite:qs("#pertesUnite").value,motif:qs("#pertesMotif").value,comment:qs("#pertesComment").value};
    const r=await api("apiPertesAdd",d);
    alert(r.status==="success"?"✅ "+r.message:"❌ "+r.message);
    ["pertesProduit","pertesQte","pertesUnite","pertesMotif","pertesComment"].forEach(id=>qs("#"+id).value="");
  });
}

// === Inventaire Journalier ===
async function mountInvJ(){
  const produits=await api("getStockDetail");
  const dl=document.createElement("datalist");
  dl.id="produitsList";
  dl.innerHTML=produits.map(p=>`<option value="${p.produit}">`).join("");
  document.body.appendChild(dl);
  qs("#invjProduit").setAttribute("list","produitsList");

  qs("#btnInvJEntree").addEventListener("click",()=>handleInvJ("entree"));
  qs("#btnInvJSortie").addEventListener("click",()=>handleInvJ("sortie"));
}
async function handleInvJ(type){
  const d={type,produit:qs("#invjProduit").value,qte:qs("#invjQte").value,unite:qs("#invjUnite").value};
  const r=await api("inventaireJournalier",d);
  alert(r.status==="success"?"✅ "+r.message:"❌ "+r.message);
  ["invjProduit","invjQte","invjUnite"].forEach(id=>qs("#"+id).value="");
}

// === Inventaire Mensuel ===
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
    const d={zone:qs("#invmZone").value,mois:qs("#invmMois").value,produit:qs("#invmProduit").value,qte:qs("#invmQte").value,unite:qs("#invmUnite").value,comment:qs("#invmComment").value};
    const r=await api("saveInventaireMensuel",d);
    alert(r.status==="success"?"✅ "+r.message:"❌ "+r.message);
  });

  qs("#btnInvmGenerate").addEventListener("click",async()=>{
    const m=qs("#invmMois").value;
    const r=await api("createMonthlySheets",{mois:m});
    alert(r.status==="success"?"✅ "+r.message:"⚠️ "+r.message);
  });
}

// === Recettes ===
async function mountRecettes(){
  const r=await api("apiGetRecettesList");
  const list=qs("#recettesList");
  list.innerHTML=r.map(e=>`<div class="card recette" data-id="${e.id}">${e.nom}</div>`).join("");
  list.querySelectorAll(".recette").forEach(d=>d.addEventListener("click",()=>loadRecette(d.dataset.id)));
}
async function loadRecette(id){
  const r=await api("apiGetRecette",{id});
  qs("#recetteDetail").innerHTML=`<h3>${r.nom}</h3><p>${r.description}</p>`;
}

// === Init ===
document.addEventListener("DOMContentLoaded",async()=>{
  console.log("✅ Fouquet’s Suite chargée");
  await checkConnection();
  render("dashboard");
});
