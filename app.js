// =======================================
// 🍷 Fouquet’s Joy Suite – app.js v15.3
// =======================================

// ⛳️ Remplace par TON URL de déploiement Web Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbw0saQi9GQTn9HqMX7kJND5fqYkm_MQaAXrgq-x9GttvtbONf5adfuGwIiAYMqx3DLy/exec";

const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

// --- Boot ---
document.addEventListener("DOMContentLoaded", () => {
  // Tabs
  qsa(".tab").forEach(btn => btn.addEventListener("click", () => render(btn.dataset.view)));
  render("dashboard");

  // Sync badge de base
  checkConnection();
  const btnSync = qs("#btnSync");
  if (btnSync) btnSync.addEventListener("click", checkConnection);
});

// --- Render ---
function render(view){
  qsa(".tab").forEach(b => b.classList.toggle("active", b.dataset.view===view));
  const tpl = qs(`#tpl-${view}`);
  qs("#app").innerHTML = tpl ? tpl.innerHTML : "<div class='section'><div class='card'>Vue inconnue</div></div>";

  if (view==="dashboard") mountDashboard();
  if (view==="pertes")    mountPertes();
  if (view==="invj")      mountInvJ();
  if (view==="invm")      mountInvM();
  if (view==="recettes")  mountRecettes();
  if (view==="settings")  mountSettings();
}

// --- Status / Ping ---
function setStatus(mode){
  const badge = qs("#syncBadge");
  if(!badge) return;
  badge.className = "status-badge " + mode;
  badge.textContent = ( {online:"En ligne", offline:"Hors ligne", error:"Erreur"}[mode] || "—" );
}
async function checkConnection(){
  try{
    const r = await fetch(`${API_URL}?action=getEtatStock`, { cache:"no-store" });
    const data = await r.json();
    setStatus(data.status==="success" ? "online" : "error");
  }catch{ setStatus(navigator.onLine ? "error" : "offline"); }
}

// --- API helper ---
async function api(action, data=null){
  const url = data ? API_URL : `${API_URL}?action=${encodeURIComponent(action)}`;
  const opt = data ? { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ action, ...data }) } : {};
  const res = await fetch(url, opt);
  return res.json();
}

// ---------- Dashboard ----------
async function mountDashboard(){
  try{
    const etat = await api("getEtatStock");
    if (etat.status==="success"){
      qs("#kpiStock").textContent = "€ " + Number(etat.valeurTotale||0).toFixed(2);
      qs("#kpiStockQte").textContent = (etat.quantiteTotale||0) + " unités";
    }
  }catch{ /* ignore */ }

  try{
    const det = await api("getStockDetail");
    const tbody = qs("#tableStockDetail tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (det.status==="success"){
      det.stock.forEach(it=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${it.produit||""}</td>
          <td style="text-align:right">${Number(it.quantite||0)}</td>
          <td>${it.unite||""}</td>
          <td style="text-align:right">${Number(it.prix||0).toFixed(2)}</td>
          <td style="text-align:right">${Number(it.valeur||0).toFixed(2)}</td>
          <td>${it.zone||""}</td>`;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = `<tr><td colspan="6">⚠️ Erreur de chargement</td></tr>`;
    }
  }catch{ /* ignore */ }

  // (Graph demo déjà présent dans ton HTML – tu pourras brancher sur Pertes_xxx si besoin)
}

// ---------- Pertes ----------
async function populateProduitsDatalist(){
  try{
    const res = await api("produitsList");
    const dl = qs("#produitsList");
    if (!dl) return;
    dl.innerHTML = (res.status==="success" ? res.produits : []).map(p=>`<option value="${p}">`).join("");
  }catch{/* ignore */}
}

function mountPertes(){
  populateProduitsDatalist();

  const btnSave = qs("#btnSavePerte");
  const btnReset = qs("#btnResetPerte");
  if (!btnSave) return;

  btnSave.addEventListener("click", async ()=>{
    const data = {
      produit: qs("#pertesProduit").value.trim(),
      qte: qs("#pertesQte").value.trim(),
      unite: qs("#pertesUnite").value.trim(),
      motif: qs("#pertesMotif").value.trim(),
      comment: qs("#pertesComment").value.trim()
    };
    if(!data.produit || !data.qte || !data.unite){ alert("Produit, quantité et unité sont obligatoires."); return; }
    const res = await api("pertesAdd", data);
    alert(res.status==="success" ? "Perte enregistrée." : ("Erreur : "+(res.message||"inconnue")));
    // Réinitialisation auto
    ["#pertesProduit","#pertesQte","#pertesUnite","#pertesMotif","#pertesComment"].forEach(id => { const el=qs(id); if(el) el.value=""; });
    checkConnection();
  });

  if (btnReset) btnReset.addEventListener("click", ()=>{
    ["#pertesProduit","#pertesQte","#pertesUnite","#pertesMotif","#pertesComment"].forEach(id => { const el=qs(id); if(el) el.value=""; });
  });
}

// ---------- Inventaire journalier ----------
function mountInvJ(){
  populateProduitsDatalist(); // réutilise la même datalist

  const btnEntree = qs("#btnInvJEntree");
  const btnSortie = qs("#btnInvJSortie");
  const btnReset  = qs("#btnResetInvJ");

  const handler = async (type)=>{
    const data = {
      type,
      produit: qs("#invjProduit").value.trim(),
      qte: qs("#invjQte").value.trim(),
      unite: qs("#invjUnite").value.trim()
    };
    if(!data.produit || !data.qte || !data.unite){ alert("Produit, quantité et unité sont obligatoires."); return; }
    const res = await api("inventaireJournalier", data);
    alert(res.status==="success" ? `${type==="sortie"?"Sortie":"Entrée"} enregistrée.` : ("Erreur : "+(res.message||"inconnue")));
    // Réinitialisation auto
    ["#invjProduit","#invjQte","#invjUnite"].forEach(id => { const el=qs(id); if(el) el.value=""; });
    checkConnection();
  };

  if (btnEntree) btnEntree.addEventListener("click", ()=>handler("entree"));
  if (btnSortie) btnSortie.addEventListener("click", ()=>handler("sortie"));
  if (btnReset)  btnReset.addEventListener("click", ()=>{
    ["#invjProduit","#invjQte","#invjUnite"].forEach(id => { const el=qs(id); if(el) el.value=""; });
  });
}

// ---------- Inventaire mensuel ----------
async function populateZonesSelect(){
  try{
    const res = await api("zonesList");
    const sel = qs("#invmZone");
    if(!sel) return;
    sel.innerHTML = (res.status==="success" ? res.zones : []).map(z=>`<option>${z}</option>`).join("");
  }catch{/* ignore */}
}

function mountInvM(){
  populateZonesSelect();
  populateProduitsDatalist(); // pour réutiliser les produits si tu veux un datalist (tu as un input simple)

  const btnGen = qs("#btnInvmGenerate");
  const btnSave = qs("#btnInvmSave");
  const btnReset= qs("#btnInvmReset");

  if (btnGen) btnGen.addEventListener("click", async ()=>{
    const data = { zone: qs("#invmZone").value, mois: qs("#invmMois").value || new Date().toISOString().slice(0,7) };
    const res = await api("createInventaireMensuel", data);
    alert(res.status==="success" ? `Feuille ${res.sheet} prête.` : ("Erreur : "+(res.message||"inconnue")));
  });

  if (btnSave) btnSave.addEventListener("click", async ()=>{
    const data = {
      zone: qs("#invmZone").value,
      mois: qs("#invmMois").value || new Date().toISOString().slice(0,7),
      produits: qs("#invmProduit").value.trim(),
      quantite: qs("#invmQte").value.trim(),
      unite: qs("#invmUnite").value.trim(),
      commentaires: qs("#invmComment").value.trim()
    };
    if(!data.produits || !data.quantite || !data.unite){ alert("Produit, quantité et unité sont obligatoires."); return; }
    const res = await api("saveInventaireMensuel", data);
    alert(res.status==="success" ? "Inventaire mensuel enregistré." : ("Erreur : "+(res.message||"inconnue")));
    // (Tu peux réinitialiser ici si tu veux)
  });

  if (btnReset) btnReset.addEventListener("click", ()=>{
    ["#invmMois","#invmProduit","#invmQte","#invmUnite","#invmComment"].forEach(id => { const el=qs(id); if(el) el.value=""; });
  });
}

// ---------- Recettes ----------
async function mountRecettes(){
  try{
    const res = await api("getRecettes");
    const list = qs("#recettesList");
    if (!list) return;
    list.innerHTML = "";
    if (res.status==="success"){
      res.recettes.forEach(r=>{
        const div = document.createElement("div");
        div.className = "card";
        div.style.cursor = "pointer";
        div.innerHTML = `<b>${r.nom}</b><br><small>${r.categorie||""} • base ${r.portions||1}p</small>`;
        div.addEventListener("click", ()=> loadRecetteDetail(r.code));
        list.appendChild(div);
      });
    }
    const search = qs("#recetteSearch");
    if (search){
      search.addEventListener("input", e=>{
        const q = e.target.value.toLowerCase();
        [...list.children].forEach(card=>{
          const ok = card.textContent.toLowerCase().includes(q);
          card.style.display = ok ? "" : "none";
        });
      });
    }
  }catch{/* ignore */}
}

async function loadRecetteDetail(code){
  const res = await api("getRecette", { code });
  const container = qs("#recetteDetail");
  if (!container) return;
  if (res.status!=="success"){ container.textContent = "⚠️ Recette introuvable."; return; }
  const r = res.recette;

  container.innerHTML = `<div class="card">
    <h3>${r.nom}</h3>
    <div>Base ${r.portions||1} portions</div>
    <div style="margin:8px 0">
      <label>Multiplier par :</label>
      <input id="multiInput" type="number" value="1" min="0.1" step="0.5" style="width:80px;text-align:center;margin-left:6px">
    </div>
    <table class="list">
      <thead><tr><th>Produit</th><th>Qté</th><th>Unité</th><th>Zone</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>`;

  const tbody = container.querySelector("tbody");
  (r.ingredients||[]).forEach(i=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i.produit}</td>
      <td data-base="${Number(i.quantite||0)}">${Number(i.quantite||0).toFixed(2)}</td>
      <td>${i.unite||""}</td>
      <td>${i.zone||""}</td>`;
    tbody.appendChild(tr);
  });

  container.querySelector("#multiInput").addEventListener("input", e=>{
    const m = Number(e.target.value)||1;
    tbody.querySelectorAll("td[data-base]").forEach(td=>{
      const base = Number(td.getAttribute("data-base"))||0;
      td.textContent = (base*m).toFixed(2);
    });
  });
}

// ---------- Settings ----------
function mountSettings(){
  const btn = qs("#btnSetSave");
  if (!btn) return;
  btn.addEventListener("click", ()=>{
    localStorage.setItem("etab",   qs("#setEtab").value);
    localStorage.setItem("tz",     qs("#setTz").value);
    localStorage.setItem("emailCC",qs("#setEmail").value);
    localStorage.setItem("lang",   qs("#setLang").value);
    alert("Paramètres enregistrés.");
  });
}
